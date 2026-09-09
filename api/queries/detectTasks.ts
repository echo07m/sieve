import { createHash, createHmac, randomBytes } from "node:crypto";
import { and, asc, eq, lte, or, sql } from "drizzle-orm";
import {
  apiKeys,
  customRules,
  detectTasks,
  webhookDeliveries,
  webhookEndpoints,
  type ApiKey,
} from "@db/schema";
import { REPORT_DISCLAIMER } from "@contracts/constants";
import { runDetection } from "../engine/orchestrator";
import { getActiveRules, getLatestRuleVersion } from "./compliance";
import { refundQuota } from "./billing";
import { getDb } from "./connection";

export type DetectTaskInput = {
  workTitle: string;
  scriptText: string;
  targetPlatform: string;
  workType?: string;
};

let taskSeq = 0;
function nextTaskNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  taskSeq = (taskSeq + 1) % 1000000;
  return `DT-${ymd}-${String(Date.now() % 1000000).padStart(6, "0")}${String(taskSeq).padStart(2, "0")}`;
}

/** 创建异步检测任务（配额已在路由层扣减） */
export async function createDetectTask(
  userId: number,
  apiKeyId: number,
  input: DetectTaskInput,
): Promise<{ taskNo: string }> {
  const db = getDb();
  const taskNo = nextTaskNo();
  await db.insert(detectTasks).values({
    taskNo,
    userId,
    apiKeyId,
    workTitle: input.workTitle,
    status: "pending",
    input,
  });
  // 进程内 worker：不阻塞响应，单实例部署口径
  void processDetectTask(taskNo).catch(() => {});
  return { taskNo };
}

/** 按 taskNo 查询（校验归属） */
export async function getDetectTaskByNo(taskNo: string, userId: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(detectTasks)
    .where(and(eq(detectTasks.taskNo, taskNo), eq(detectTasks.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** 检测执行体：同步端点与异步 worker 共用 */
export async function runDetectForKey(
  keyRow: ApiKey,
  input: DetectTaskInput,
): Promise<Record<string, unknown>> {
  const db = getDb();
  const [activeRules, userCustomRules, ruleVersionRow] = await Promise.all([
    getActiveRules(),
    db
      .select()
      .from(customRules)
      .where(and(eq(customRules.userId, keyRow.userId), eq(customRules.status, "active"))),
    getLatestRuleVersion(),
  ]);
  const ruleVersion = ruleVersionRow?.version ?? "unknown";
  const result = await runDetection({
    scriptText: input.scriptText,
    workTitle: input.workTitle,
    targetPlatform: input.targetPlatform,
    activeRules,
    customRules: userCustomRules,
  });
  const generatedAt = new Date();
  const reportHash = createHash("sha256")
    .update(
      JSON.stringify({
        hits: result.hits.map((h) => [h.ruleCode, h.episodeNo, h.location, h.spanText]),
        ruleVersion,
        generatedAt: generatedAt.toISOString(),
      }),
    )
    .digest("hex");
  void db
    .update(apiKeys)
    .set({ lastUsedAt: generatedAt })
    .where(eq(apiKeys.id, keyRow.id))
    .catch(() => {});
  return {
    verdict: result.verdict,
    summary: result.summary,
    hits: result.hits.map((h) => ({
      episodeNo: h.episodeNo,
      location: h.location,
      spanText: h.spanText,
      category: h.category,
      ruleCode: h.ruleCode,
      severity: h.severity,
      confidence: Number(h.confidence.toFixed(2)),
      basis: h.basis,
      remediation: h.remediation,
    })),
    ruleVersion,
    reportHash,
    disclaimer: REPORT_DISCLAIMER,
  };
}

/** 进程内 worker：执行任务并触发 Webhook 投递 */
async function processDetectTask(taskNo: string): Promise<void> {
  const db = getDb();
  const [task] = await db
    .select()
    .from(detectTasks)
    .where(eq(detectTasks.taskNo, taskNo))
    .limit(1);
  if (!task || task.status !== "pending") return;

  await db
    .update(detectTasks)
    .set({ status: "processing" })
    .where(eq(detectTasks.id, task.id));

  const [keyRow] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.id, task.apiKeyId))
    .limit(1);

  try {
    if (!keyRow || keyRow.status !== "active") {
      throw new Error("API Key 已吊销");
    }
    const result = await runDetectForKey(keyRow, task.input);
    await db
      .update(detectTasks)
      .set({ status: "done", result, finishedAt: new Date() })
      .where(eq(detectTasks.id, task.id));
    await enqueueWebhooks(task.userId, task.id, "detect.done", {
      taskNo,
      status: "done",
      workTitle: task.workTitle,
      result,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "检测执行失败";
    await db
      .update(detectTasks)
      .set({ status: "failed", error: message.slice(0, 500), finishedAt: new Date() })
      .where(eq(detectTasks.id, task.id));
    await refundQuota(task.userId).catch(() => {});
    await enqueueWebhooks(task.userId, task.id, "detect.failed", {
      taskNo,
      status: "failed",
      workTitle: task.workTitle,
      error: message,
    });
  }
}

// ============ Webhook 投递 ============

const MAX_ATTEMPTS = 5;

function signPayload(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

/** 任务完成后为用户所有生效端点登记投递 */
export async function enqueueWebhooks(
  userId: number,
  taskId: number | null,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const db = getDb();
  const endpoints = await db
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.userId, userId), eq(webhookEndpoints.isActive, true)));
  for (const ep of endpoints) {
    await db.insert(webhookDeliveries).values({
      endpointId: ep.id,
      taskId,
      event,
      payload: { event, data: payload, timestamp: new Date().toISOString() },
      status: "pending",
      nextRetryAt: new Date(),
    });
  }
  // 立即尝试一轮投递（不阻塞 worker 太久，失败交给扫描器重推）
  void scanDeliveries().catch(() => {});
}

/** 单条投递执行 */
async function deliverOnce(deliveryId: number): Promise<void> {
  const db = getDb();
  const [d] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);
  if (!d || d.status === "success") return;
  const [ep] = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, d.endpointId))
    .limit(1);
  if (!ep) {
    await db
      .update(webhookDeliveries)
      .set({ status: "failed", lastError: "端点已删除" })
      .where(eq(webhookDeliveries.id, d.id));
    return;
  }

  const body = JSON.stringify(d.payload);
  const attempts = d.attempts + 1;
  try {
    const resp = await fetch(ep.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sieve-Event": d.event,
        "X-Sieve-Delivery": String(d.id),
        "X-Sieve-Timestamp": String(Math.floor(Date.now() / 1000)),
        "X-Sieve-Signature": signPayload(ep.secret, body),
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (resp.ok) {
      await db
        .update(webhookDeliveries)
        .set({ status: "success", attempts, responseCode: resp.status, deliveredAt: new Date() })
        .where(eq(webhookDeliveries.id, d.id));
      return;
    }
    throw new Error(`HTTP ${resp.status}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : "投递失败";
    const exhausted = attempts >= MAX_ATTEMPTS;
    await db
      .update(webhookDeliveries)
      .set({
        status: exhausted ? "failed" : "pending",
        attempts,
        lastError: message.slice(0, 500),
        // 退避：1/4/9/16 分钟后重推
        nextRetryAt: exhausted
          ? null
          : new Date(Date.now() + attempts * attempts * 60_000),
      })
      .where(eq(webhookDeliveries.id, d.id));
  }
}

/** 到期待投递扫描（登记时即时触发 + 每分钟定时扫描） */
export async function scanDeliveries(): Promise<void> {
  const db = getDb();
  const due = await db
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.status, "pending"),
        or(
          lte(webhookDeliveries.nextRetryAt, new Date()),
          sql`${webhookDeliveries.nextRetryAt} is null`,
        ),
      ),
    )
    .orderBy(asc(webhookDeliveries.id))
    .limit(20);
  for (const row of due) {
    await deliverOnce(row.id).catch(() => {});
  }
}

/** 手动重推（用户端操作，重置次数） */
export async function redeliver(deliveryId: number, userId: number): Promise<boolean> {
  const db = getDb();
  const [d] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);
  if (!d) return false;
  const [ep] = await db
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, d.endpointId), eq(webhookEndpoints.userId, userId)))
    .limit(1);
  if (!ep) return false;
  await db
    .update(webhookDeliveries)
    .set({ status: "pending", attempts: 0, nextRetryAt: new Date(), lastError: "" })
    .where(eq(webhookDeliveries.id, d.id));
  await deliverOnce(d.id);
  return true;
}

/** 单端点测试投递（test.ping） */
export async function enqueueTestPing(endpointId: number): Promise<void> {
  const db = getDb();
  await db.insert(webhookDeliveries).values({
    endpointId,
    taskId: null,
    event: "test.ping",
    payload: {
      event: "test.ping",
      data: { message: "Sieve Webhook 连通性测试" },
      timestamp: new Date().toISOString(),
    },
    status: "pending",
    nextRetryAt: new Date(),
  });
  void scanDeliveries().catch(() => {});
}

/** 生成 Webhook 签名密钥 */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

/** 定时扫描器（模块加载时启动一次，单实例口径） */
let scannerStarted = false;
export function startDeliveryScanner(): void {
  if (scannerStarted) return;
  scannerStarted = true;
  setInterval(() => void scanDeliveries().catch(() => {}), 60_000).unref();
}
