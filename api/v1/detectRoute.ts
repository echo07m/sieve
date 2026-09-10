/**
 * F12 开放API：文本检测 REST 端点
 * POST /api/v1/detect —— Bearer API Key 鉴权 + 简易内存限流（60 次/分钟/Key）
 * 与网页端共用同一检测编排器（runDetection），底座规则 + 该用户自定义加严规则叠加生效。
 */
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { apiKeys, customRules } from "@db/schema";
import { REPORT_DISCLAIMER } from "@contracts/constants";
import { runDetection } from "../engine/orchestrator";
import { consumeQuota, getOrCreateSubscription, refundQuota } from "../queries/billing";
import { getActiveRules, getLatestRuleVersion } from "../queries/compliance";
import { getDb } from "../queries/connection";
import { registerOpenApiRoute } from "./openapi";
import { breakDownScript } from "../engine/storyboard";
import {
  createDetectTask,
  getDetectTaskByNo,
  runDetectForKey,
  startDeliveryScanner,
} from "../queries/detectTasks";

const API_KEY_PATTERN = /^jhg_[0-9a-f]{48}$/;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
/** 简易限流：内存 Map 按 keyHash 记录（单实例部署口径；多实例需外置 Redis） */
const rateBuckets = new Map<string, { windowStart: number; count: number }>();

function hitRateLimit(keyHash: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(keyHash);
  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(keyHash, { windowStart: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

const PLATFORM_VALUES = ["universal", "hongguo", "fanqie", "kuaishou", "wechat"] as const;

const storyboardBodySchema = z.object({
  workTitle: z.string().min(1).max(255),
  scriptText: z.string().min(10).max(2_000_000),
});

const detectBodySchema = z.object({
  workTitle: z.string().min(1).max(255),
  scriptText: z.string().min(50).max(2_000_000),
  targetPlatform: z.enum(PLATFORM_VALUES).default("universal"),
  workType: z.string().max(64).optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerV1Routes(app: Hono<any>): void {
  app.post("/api/v1/detect", async (c) => {
    // ---------- 鉴权：Authorization: Bearer jhg_<48位hex> ----------
    const authHeader = c.req.header("Authorization") ?? "";
    const token = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1]?.trim() ?? "";
    if (!API_KEY_PATTERN.test(token)) {
      return c.json(
        { error: "缺少或格式错误的 API Key，请携带 Authorization: Bearer jhg_…" },
        401,
      );
    }
    const keyHash = createHash("sha256").update(token).digest("hex");
    const db = getDb();
    const keyRows = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);
    const keyRow = keyRows[0];
    if (!keyRow || keyRow.status !== "active") {
      return c.json({ error: "API Key 无效或已吊销" }, 401);
    }

    // ---------- 限流：60 次/分钟 ----------
    if (hitRateLimit(keyHash)) {
      return c.json({ error: "请求过于频繁，单 Key 限额 60 次/分钟" }, 429);
    }

    // ---------- 请求体校验（先于配额扣减：非法请求不消耗客户额度） ----------
    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "请求体必须是合法 JSON" }, 400);
    }
    const parsed = detectBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json(
        {
          error: "请求参数校验失败：workTitle 必填，scriptText 需 50-2000000 字，targetPlatform 限 universal/hongguo/fanqie/kuaishou/wechat",
          details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        400,
      );
    }
    const { workTitle, scriptText, targetPlatform } = parsed.data;

    // ---------- 配额扣减：企业年框不限量，其余按订阅额度 ----------
    try {
      await consumeQuota(keyRow.userId);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("PRECHECK_QUOTA_EXHAUSTED")) {
        return c.json(
          { error: "检测额度已用尽或订阅已到期，请联系商务续费/升级年框", code: "QUOTA_EXHAUSTED" },
          402,
        );
      }
      return c.json({ error: "计费服务暂不可用，请稍后重试" }, 500);
    }

    // ---------- 执行检测（底座规则 + 该用户自定义规则） ----------
    try {
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
        scriptText,
        workTitle,
        targetPlatform,
        activeRules,
        customRules: userCustomRules,
      });

      // ---------- 留痕存证：SHA-256（hits + ruleVersion + 时间戳） ----------
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

      // 异步更新 lastUsedAt，不阻塞响应
      void db
        .update(apiKeys)
        .set({ lastUsedAt: generatedAt })
        .where(eq(apiKeys.id, keyRow.id))
        .catch(() => {});

      return c.json({
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
      });
    } catch {
      // 系统故障退还配额
      await refundQuota(keyRow.userId).catch(() => {});
      return c.json({ error: "检测执行失败，本次额度已退还，请稍后重试" }, 500);
    }
  });

  // ============ 异步检测：POST /api/v1/detect/async → { taskNo } ============
  app.post("/api/v1/detect/async", async (c) => {
    const authHeader = c.req.header("Authorization") ?? "";
    const token = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1]?.trim() ?? "";
    if (!API_KEY_PATTERN.test(token)) {
      return c.json({ error: "缺少或格式错误的 API Key" }, 401);
    }
    const keyHash = createHash("sha256").update(token).digest("hex");
    const db = getDb();
    const [keyRow] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);
    if (!keyRow || keyRow.status !== "active") {
      return c.json({ error: "API Key 无效或已吊销" }, 401);
    }
    if (hitRateLimit(keyHash)) {
      return c.json({ error: "请求过于频繁，单 Key 限额 60 次/分钟" }, 429);
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "请求体必须是合法 JSON" }, 400);
    }
    const parsed = detectBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json(
        { error: "请求参数校验失败", details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
        400,
      );
    }

    try {
      await consumeQuota(keyRow.userId);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("PRECHECK_QUOTA_EXHAUSTED")) {
        return c.json({ error: "检测额度已用尽或订阅已到期", code: "QUOTA_EXHAUSTED" }, 402);
      }
      return c.json({ error: "计费服务暂不可用，请稍后重试" }, 500);
    }

    const { taskNo } = await createDetectTask(keyRow.userId, keyRow.id, {
      ...parsed.data,
      workType: parsed.data.workType,
    });
    return c.json(
      {
        taskNo,
        status: "pending",
        pollUrl: `/api/v1/tasks/${taskNo}`,
        note: "结果可轮询 pollUrl 获取；配置 Webhook 后将以 detect.done 事件主动推送",
      },
      202,
    );
  });

  // ============ 任务查询：GET /api/v1/tasks/:taskNo ============
  app.get("/api/v1/tasks/:taskNo", async (c) => {
    const authHeader = c.req.header("Authorization") ?? "";
    const token = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1]?.trim() ?? "";
    if (!API_KEY_PATTERN.test(token)) {
      return c.json({ error: "缺少或格式错误的 API Key" }, 401);
    }
    const keyHash = createHash("sha256").update(token).digest("hex");
    const db = getDb();
    const [keyRow] = await db
      .select({ userId: apiKeys.userId })
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);
    if (!keyRow) {
      return c.json({ error: "API Key 无效或已吊销" }, 401);
    }
    const task = await getDetectTaskByNo(c.req.param("taskNo"), keyRow.userId);
    if (!task) {
      return c.json({ error: "任务不存在" }, 404);
    }
    return c.json({
      taskNo: task.taskNo,
      status: task.status,
      workTitle: task.workTitle,
      createdAt: task.createdAt,
      finishedAt: task.finishedAt,
      ...(task.status === "done" ? { result: task.result } : {}),
      ...(task.status === "failed" ? { error: task.error } : {}),
    });
  });

  // ============ 用量查询：GET /api/v1/usage ============
  app.get("/api/v1/usage", async (c) => {
    const authHeader = c.req.header("Authorization") ?? "";
    const token = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1]?.trim() ?? "";
    if (!API_KEY_PATTERN.test(token)) {
      return c.json({ error: "缺少或格式错误的 API Key" }, 401);
    }
    const keyHash = createHash("sha256").update(token).digest("hex");
    const db = getDb();
    const [keyRow] = await db
      .select({ userId: apiKeys.userId })
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);
    if (!keyRow) {
      return c.json({ error: "API Key 无效或已吊销" }, 401);
    }
    const sub = await getOrCreateSubscription(keyRow.userId);
    const unlimited = sub.quotaTotal === -1;
    const expired = Boolean(sub.expiresAt && sub.expiresAt.getTime() < Date.now());
    return c.json({
      planCode: sub.planCode,
      planName: sub.planName,
      status: expired ? "expired" : sub.status,
      unlimited,
      quotaTotal: unlimited ? null : sub.quotaTotal,
      quotaUsed: sub.quotaUsed,
      quotaRemaining: unlimited ? null : Math.max(0, sub.quotaTotal - sub.quotaUsed),
      expiresAt: sub.expiresAt,
    });
  });

  // ---------- 分镜拆解：POST /api/v1/storyboard（不消耗检测配额，共享 60 次/分钟限流） ----------
  app.post("/api/v1/storyboard", async (c) => {
    const authHeader = c.req.header("Authorization") ?? "";
    const token = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1]?.trim() ?? "";
    if (!API_KEY_PATTERN.test(token)) {
      return c.json({ error: "缺少或格式错误的 API Key" }, 401);
    }
    const keyHash = createHash("sha256").update(token).digest("hex");
    const [keyRow] = await getDb()
      .select({ userId: apiKeys.userId, status: apiKeys.status })
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);
    if (!keyRow || keyRow.status !== "active") {
      return c.json({ error: "API Key 无效或已吊销" }, 401);
    }
    if (hitRateLimit(keyHash)) {
      return c.json({ error: "请求过于频繁，单 Key 限额 60 次/分钟" }, 429);
    }
    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "请求体必须是合法 JSON" }, 400);
    }
    const parsed = storyboardBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json(
        { error: "请求参数校验失败：workTitle 必填，scriptText 需 10-2000000 字" },
        400,
      );
    }
    const sb = breakDownScript(parsed.data.workTitle, parsed.data.scriptText);
    if (sb.shotCount === 0) {
      return c.json({ error: "未能从剧本中拆解出有效镜头，请检查文本格式" }, 422);
    }
    return c.json(sb);
  });

  // OpenAPI 规范端点（工具链契约）
  registerOpenApiRoute(app);

  // Webhook 投递定时扫描器（模块注册时启动一次）
  startDeliveryScanner();
}
