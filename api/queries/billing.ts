import { getDb } from "./connection";
import { subscriptions, leads, type Subscription } from "@db/schema";
import { PLANS, type PlanCode } from "@contracts/constants";
import { eq, desc, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

/**
 * 取用户当前有效订阅；无记录则按免费档创建（注册即享 3 次试检）。
 */
export async function getOrCreateSubscription(
  userId: number,
): Promise<Subscription> {
  const db = getDb();
  const existing = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
    .orderBy(desc(subscriptions.id));
  if (existing.length > 0) {
    // 并发重复建订阅的自愈：保留最新一条 active，其余立即过期（免费额度不被放大）
    if (existing.length > 1) {
      const staleIds = existing.slice(1).map((s) => s.id);
      await db
        .update(subscriptions)
        .set({ status: "expired" })
        .where(
          and(
            eq(subscriptions.userId, userId),
            sql`${subscriptions.id} IN (${sql.join(staleIds.map((id) => sql`${id}`), sql`, `)})`,
          ),
        );
    }
    return existing[0];
  }

  const free = PLANS.free;
  await db.insert(subscriptions).values({
    userId,
    planCode: free.code,
    planName: free.name,
    quotaTotal: free.quota,
    quotaUsed: 0,
  });
  const created = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.id))
    .limit(1);
  return created[0]!;
}

/**
 * 配额预检 + 原子扣减。额度耗尽抛 PRECHECK_QUOTA_EXHAUSTED，
 * 前端据此弹出转化留资弹窗。quotaTotal = -1 表示不限量（企业年框）。
 */
export async function consumeQuota(userId: number): Promise<Subscription> {
  const sub = await getOrCreateSubscription(userId);
  // 到期检查优先于不限量判定：过期年框不能继续放行
  if (sub.expiresAt && sub.expiresAt.getTime() < Date.now()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "PRECHECK_QUOTA_EXHAUSTED:订阅已到期，请续费或升级方案",
    });
  }
  if (sub.quotaTotal === -1) return sub; // 不限量（有效期内）
  const db = getDb();
  const [result] = await db
    .update(subscriptions)
    .set({ quotaUsed: sql`${subscriptions.quotaUsed} + 1` })
    .where(
      and(
        eq(subscriptions.id, sub.id),
        sql`${subscriptions.quotaUsed} < ${subscriptions.quotaTotal}`,
      ),
    );
  const affected = (result as { affectedRows?: number }).affectedRows ?? 0;
  if (affected === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "PRECHECK_QUOTA_EXHAUSTED:检测额度已用尽，请升级方案或留资开通",
    });
  }
  const remaining = sub.quotaTotal - sub.quotaUsed - 1;
  if (remaining <= 1) {
    const { createNotification } = await import("./notifications");
    await createNotification(
      userId,
      "quota_low",
      remaining === 0 ? "检测额度已用尽" : "检测额度即将用尽",
      remaining === 0
        ? "本次为最后一次可用检测。请前往定价页升级方案或留资开通。"
        : `剩余 ${remaining} 次检测额度，建议提前升级或留资续购。`,
    );
  }
  return { ...sub, quotaUsed: sub.quotaUsed + 1 };
}

/** 批量提交原子扣 N 次额度：不足 N 次整体失败（不落部分扣减） */
export async function consumeQuotaMulti(userId: number, n: number): Promise<Subscription> {
  const sub = await getOrCreateSubscription(userId);
  if (sub.expiresAt && sub.expiresAt.getTime() < Date.now()) {
    throw new TRPCError({ code: "FORBIDDEN", message: "PRECHECK_QUOTA_EXHAUSTED:订阅已到期，请续费或升级方案" });
  }
  if (sub.quotaTotal === -1) return sub;
  if (sub.quotaTotal - sub.quotaUsed < n) {
    throw new TRPCError({ code: "FORBIDDEN", message: `PRECHECK_QUOTA_EXHAUSTED:批量提交需 ${n} 次额度，当前剩余 ${sub.quotaTotal - sub.quotaUsed} 次` });
  }
  const db = getDb();
  const [result] = await db
    .update(subscriptions)
    .set({ quotaUsed: sql`${subscriptions.quotaUsed} + ${n}` })
    .where(and(eq(subscriptions.id, sub.id), sql`${subscriptions.quotaUsed} + ${n} <= ${subscriptions.quotaTotal}`));
  const affected = (result as { affectedRows?: number }).affectedRows ?? 0;
  if (affected === 0) {
    throw new TRPCError({ code: "FORBIDDEN", message: "PRECHECK_QUOTA_EXHAUSTED:检测额度不足，请升级方案" });
  }
  return { ...sub, quotaUsed: sub.quotaUsed + n };
}

/** 批量任务中按实际失败数退还配额 */
export async function refundQuotaMulti(userId: number, n: number): Promise<void> {
  if (n <= 0) return;
  const sub = await getOrCreateSubscription(userId);
  if (sub.quotaTotal === -1) return;
  await getDb()
    .update(subscriptions)
    .set({ quotaUsed: sql`GREATEST(${subscriptions.quotaUsed} - ${n}, 0)` })
    .where(eq(subscriptions.id, sub.id));
}

/** 检测系统故障时退还 1 次配额（不把系统失败的成本转嫁给用户） */
export async function refundQuota(userId: number): Promise<void> {
  const db = getDb();
  await db
    .update(subscriptions)
    .set({ quotaUsed: sql`GREATEST(${subscriptions.quotaUsed} - 1, 0)` })
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")));
}

/** 公开留资（无需登录） */
export async function createLead(input: {
  name: string;
  company?: string;
  contact: string;
  message?: string;
  source?: string;
  planInterest?: string;
}) {
  const db = getDb();
  await db.insert(leads).values({
    name: input.name,
    company: input.company ?? "",
    contact: input.contact,
    message: input.message ?? "",
    source: input.source ?? "pricing",
    planInterest: input.planInterest ?? "",
  });
}

export async function listLeads() {
  return getDb().select().from(leads).orderBy(desc(leads.id)).limit(500);
}

export async function updateLeadStatus(
  id: number,
  status: "new" | "contacted" | "converted",
) {
  await getDb().update(leads).set({ status }).where(eq(leads.id, id));
}

/** 管理员：为用户激活/调整订阅方案（留资转化后的开通动作） */
export async function activatePlan(
  userId: number,
  planCode: PlanCode,
  note = "",
) {
  const plan = PLANS[planCode];
  const db = getDb();
  await db
    .update(subscriptions)
    .set({ status: "expired" })
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")));
  const expiresAt =
    planCode === "team"
      ? new Date(Date.now() + 30 * 86400_000)
      : planCode === "enterprise"
        ? new Date(Date.now() + 365 * 86400_000)
        : null;
  await db.insert(subscriptions).values({
    userId,
    planCode: plan.code,
    planName: plan.name,
    status: "active",
    quotaTotal: plan.quota,
    quotaUsed: 0,
    expiresAt,
    note,
  });
  const { createNotification } = await import("./notifications");
  await createNotification(
    userId,
    "plan_activated",
    `套餐已开通：${plan.name}`,
    `${note ? note + "；" : ""}额度 ${plan.quota === -1 ? "不限量" : plan.quota + " 次"}${expiresAt ? `，有效期至 ${expiresAt.toISOString().slice(0, 10)}` : ""}`,
  );
}
