import { z } from "zod";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { TRPCError } from "@trpc/server";
import {
  detectionHits,
  ruleVersions,
  leads,
  platformConfigs,
  reports,
  rules,
  submissions,
  subscriptions,
  users,
} from "@db/schema";
import { desc, eq, gte, sql } from "drizzle-orm";

/**
 * 后台管理系统（仅 admin）：运营总览、用户管理、规则库管理、平台配置管理。
 * 线索管理与方案激活在 leadsRouter / billingRouter（同为 admin 级）。
 */
export const adminRouter = createRouter({
  /** 运营总览：核心指标卡 + 近 7 天送检趋势 + 方案分布 + 线索漏斗 */
  overview: adminQuery.query(async () => {
    const db = getDb();
    const since = new Date(Date.now() - 7 * 86400_000);

    const [
      [userCount],
      [submissionCount],
      [reportCount],
      [leadCount],
      [newLeadCount],
      [hitRow],
      planDist,
      daily,
      verdictDist,
    ] = await Promise.all([
      db.select({ n: sql<number>`count(*)` }).from(users),
      db.select({ n: sql<number>`count(*)` }).from(submissions),
      db.select({ n: sql<number>`count(*)` }).from(reports),
      db.select({ n: sql<number>`count(*)` }).from(leads),
      db
        .select({ n: sql<number>`count(*)` })
        .from(leads)
        .where(eq(leads.status, "new")),
      db.select({
        total: sql<number>`count(*)`,
        block: sql<number>`sum(case when ${detectionHits.severity} = 'block' then 1 else 0 end)`,
        high: sql<number>`sum(case when ${detectionHits.severity} = 'high' then 1 else 0 end)`,
        notice: sql<number>`sum(case when ${detectionHits.severity} = 'notice' then 1 else 0 end)`,
      }).from(detectionHits),
      db
        .select({ planCode: subscriptions.planCode, n: sql<number>`count(*)` })
        .from(subscriptions)
        .where(eq(subscriptions.status, "active"))
        .groupBy(subscriptions.planCode),
      db
        .select({
          day: sql<string>`date_format(${submissions.createdAt}, '%m-%d')`,
          n: sql<number>`count(*)`,
        })
        .from(submissions)
        .where(gte(submissions.createdAt, since))
        .groupBy(sql`date_format(${submissions.createdAt}, '%m-%d')`)
        .orderBy(sql`min(${submissions.createdAt})`),
      db
        .select({ verdict: reports.verdict, n: sql<number>`count(*)` })
        .from(reports)
        .groupBy(reports.verdict),
    ]);

    return {
      totals: {
        users: Number(userCount?.n ?? 0),
        submissions: Number(submissionCount?.n ?? 0),
        reports: Number(reportCount?.n ?? 0),
        leads: Number(leadCount?.n ?? 0),
        newLeads: Number(newLeadCount?.n ?? 0),
        hits: {
          total: Number(hitRow?.total ?? 0),
          block: Number(hitRow?.block ?? 0),
          high: Number(hitRow?.high ?? 0),
          notice: Number(hitRow?.notice ?? 0),
        },
      },
      planDist: planDist.map((r) => ({ planCode: r.planCode, n: Number(r.n) })),
      daily: daily.map((r) => ({ day: r.day, n: Number(r.n) })),
      verdictDist: verdictDist.map((r) => ({ verdict: r.verdict, n: Number(r.n) })),
    };
  }),

  /** 用户管理：用户列表 + 当前订阅（左连接取最新一条 active 订阅） */
  users: adminQuery.query(async () => {
    const db = getDb();
    const allUsers = (await db
      .select()
      .from(users)
      .orderBy(desc(users.id))
      .limit(500)).map(({ passwordHash: _ph, ...u }) => u); // 密码哈希不下发
    const subs = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.status, "active"))
      .orderBy(desc(subscriptions.id));
    const subByUser = new Map<number, (typeof subs)[number]>();
    for (const s of subs) {
      if (!subByUser.has(s.userId)) subByUser.set(s.userId, s);
    }
    const usageRows = await db
      .select({ userId: submissions.userId, n: sql<number>`count(*)` })
      .from(submissions)
      .groupBy(submissions.userId);
    const usageByUser = new Map(usageRows.map((r) => [r.userId, Number(r.n)]));
    return allUsers.map((u) => ({
      ...u,
      subscription: subByUser.get(u.id) ?? null,
      submissionCount: usageByUser.get(u.id) ?? 0,
    }));
  }),

  /** 管理员：调整用户角色（提权/降权） */
  setUserRole: adminQuery
    .input(z.object({ userId: z.number().int().positive(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id && input.role === "user") {
        // 防止管理员把自己降权后失联
        return { ok: false as const, reason: "不能取消自己的管理员权限" };
      }
      await getDb().update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      return { ok: true as const };
    }),

  /** 规则管理：全量规则（含停用），供后台筛选查看 */
  rules: adminQuery.query(() =>
    getDb().select().from(rules).orderBy(rules.ruleCode),
  ),

  /** 规则管理：启用/停用底座规则（admin 级热更新） */
  setRuleStatus: adminQuery
    .input(z.object({ ruleCode: z.string().max(32), status: z.enum(["active", "disabled"]) }))
    .mutation(async ({ input }) => {
      await getDb()
        .update(rules)
        .set({ status: input.status })
        .where(eq(rules.ruleCode, input.ruleCode));
      return { ok: true };
    }),

  /** 规则版本历史（含是否有可用快照） */
  ruleVersions: adminQuery.query(async () => {
    const rows = await getDb()
      .select()
      .from(ruleVersions)
      .orderBy(desc(ruleVersions.id));
    return rows.map((r) => ({ ...r, hasSnapshot: r.snapshot != null, snapshot: undefined }));
  }),

  /** 发布新版本：把当前规则全量快照存档（回滚的还原点） */
  publishRuleVersion: adminQuery
    .input(z.object({ version: z.string().min(1).max(32).regex(/^[0-9A-Za-z.\-_]+$/, "版本号仅限数字/字母/./-/_"), note: z.string().max(500).optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const dup = await db.select({ id: ruleVersions.id }).from(ruleVersions).where(eq(ruleVersions.version, input.version)).limit(1);
      if (dup.length > 0) throw new TRPCError({ code: "CONFLICT", message: "版本号已存在，请更换" });
      const allRules = await db.select().from(rules).orderBy(rules.ruleCode);
      await db.insert(ruleVersions).values({
        version: input.version,
        note: input.note ?? "",
        ruleCount: allRules.length,
        snapshot: allRules,
      });
      return { ok: true, ruleCount: allRules.length };
    }),

  /** 回滚到指定版本：事务内用快照覆盖当前规则表（以 ruleCode 为键做 upsert，多余规则停用） */
  rollbackRuleVersion: adminQuery
    .input(z.object({ versionId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(ruleVersions).where(eq(ruleVersions.id, input.versionId)).limit(1);
      const ver = rows[0];
      if (!ver) throw new TRPCError({ code: "NOT_FOUND", message: "版本不存在" });
      const snap = ver.snapshot as (typeof rules.$inferSelect)[] | null;
      if (!snap || snap.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "该版本无快照数据（仅元信息），无法回滚" });
      }
      await db.transaction(async (tx) => {
        const snapCodes = new Set(snap.map((r) => r.ruleCode));
        for (const r of snap) {
          const { id: _id, createdAt: _c, updatedAt: _u, ...restRaw } = r;
          // JSON 快照中时间已序列化为字符串，复原为 Date
          const rest = { ...restRaw, effectiveAt: new Date(restRaw.effectiveAt) };
          await tx
            .insert(rules)
            .values({ ...rest })
            .onDuplicateKeyUpdate({
              set: {
                version: rest.version, status: rest.status, category: rest.category,
                name: rest.name, severity: rest.severity, sourcePolicy: rest.sourcePolicy,
                sourceClause: rest.sourceClause, originalText: rest.originalText,
                sourceConfidence: rest.sourceConfidence, scope: rest.scope,
                keywords: rest.keywords, patterns: rest.patterns, cooccurrence: rest.cooccurrence,
                baseConfidence: rest.baseConfidence, remediationTemplate: rest.remediationTemplate,
                platformOverrides: rest.platformOverrides, effectiveAt: rest.effectiveAt,
              },
            });
        }
        // 快照之外的规则（回滚后多出的）停用而非删除，保留审计痕迹
        await tx
          .update(rules)
          .set({ status: "disabled" })
          .where(sql`${rules.ruleCode} NOT IN (${sql.join([...snapCodes].map((code) => sql`${code}`), sql`, `)})`);
      });
      await db.insert(ruleVersions).values({
        version: `${ver.version}-rollback-${Date.now().toString(36)}`,
        note: `回滚至 ${ver.version}（${snap.length} 条规则）`,
        ruleCount: snap.length,
      });
      return { ok: true, restored: snap.length };
    }),

  /** 平台配置：更新严格度 / 备案通道 / AI 标识规范 / 备注 */
  updatePlatform: adminQuery
    .input(
      z.object({
        code: z.string().max(64),
        name: z.string().min(1).max(128),
        strictness: z.number().int().min(1).max(5),
        filingChannel: z.string().max(255),
        aiMarkingSpec: z.object({
          position: z.string().max(255),
          minFontScale: z.number().min(0).max(1),
          minDurationSec: z.number().min(0).max(600),
          requiredText: z.string().max(255),
        }),
        notes: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { code, ...fields } = input;
      await getDb()
        .update(platformConfigs)
        .set(fields)
        .where(eq(platformConfigs.code, code));
      return { ok: true };
    }),
});
