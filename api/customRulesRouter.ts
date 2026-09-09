import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { customRules, rules } from "@db/schema";

const CATEGORIES_ENUM = [
  "child_harm",
  "soft_porn",
  "money_worship",
  "marriage_distortion",
  "feudal_dregs",
  "violent_revenge",
  "vulgar_title",
  "ip_infringement",
] as const;

/** 校验自定义规则归属当前用户，否则抛 NOT_FOUND */
async function findOwnedRule(id: number, userId: number) {
  const rows = await getDb()
    .select()
    .from(customRules)
    .where(eq(customRules.id, id))
    .limit(1);
  const rule = rows[0];
  if (!rule || rule.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "自定义规则不存在" });
  }
  return rule;
}

/** F13 客户规则自定义：在底座规则之上叠加用户自有加严规则 */
export const customRulesRouter = createRouter({
  /** 当前用户的自定义规则列表 */
  list: authedQuery.query(async ({ ctx }) => {
    return getDb()
      .select()
      .from(customRules)
      .where(eq(customRules.userId, ctx.user.id))
      .orderBy(desc(customRules.createdAt));
  }),

  /**
   * 新建自定义规则：正则逐条合法性校验；与底座规则（同类别、active）做关键词冲突检测，
   * 冲突不阻断创建，响应携带 conflicts 供前端显式告警
   */
  create: authedQuery
    .input(
      z.object({
        name: z.string().min(1, "请填写规则名称").max(255),
        category: z.enum(CATEGORIES_ENUM),
        severity: z.enum(["block", "high", "notice"]),
        keywords: z.array(z.string().min(1).max(64)).max(100).default([]),
        patterns: z.array(z.string().min(1).max(500)).max(50).default([]),
        remediationTemplate: z.string().max(2000).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      for (const p of input.patterns) {
        // 与执行侧一致用 unicode 模式校验，避免“创建通过、运行被静默跳过”
        try {
          new RegExp(p, "u");
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `正则表达式无效（unicode 模式）：${p}`,
          });
        }
        // 反灾难回溯（ReDoS）启发式拦截：嵌套量词如 (x+)+ / (x*)* / (x{2,})+
        if (/\([^)]*[+*}][^)]*\)\s*[+*{]/.test(p)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `正则存在嵌套量词，可能导致匹配性能问题，请改写：${p}`,
          });
        }
      }

      const db = getDb();
      // 冲突检测：底座 rules 表同 category 的 active 规则，关键词交集
      const baseRules = await db
        .select({
          ruleCode: rules.ruleCode,
          name: rules.name,
          keywords: rules.keywords,
        })
        .from(rules)
        .where(
          and(eq(rules.category, input.category), eq(rules.status, "active")),
        );
      const mine = new Set(input.keywords);
      const conflicts = baseRules
        .map((r) => ({
          ruleCode: r.ruleCode,
          name: r.name,
          overlap: (r.keywords ?? []).filter((k) => mine.has(k)),
        }))
        .filter((c) => c.overlap.length > 0);

      const ruleCode = `CU-${ctx.user.id}-${Date.now().toString(36)}`;
      const [inserted] = await db.insert(customRules).values({
        userId: ctx.user.id,
        ruleCode,
        name: input.name,
        category: input.category,
        severity: input.severity,
        keywords: input.keywords,
        patterns: input.patterns,
        remediationTemplate: input.remediationTemplate,
        status: "active",
      });

      return {
        id: Number(inserted.insertId),
        ruleCode,
        conflicts,
      };
    }),

  /** 启用/停用自定义规则（校验归属） */
  setStatus: authedQuery
    .input(
      z.object({
        id: z.number().int().min(1),
        status: z.enum(["active", "disabled"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await findOwnedRule(input.id, ctx.user.id);
      await getDb()
        .update(customRules)
        .set({ status: input.status })
        .where(eq(customRules.id, input.id));
      return { ok: true };
    }),

  /** 删除自定义规则（校验归属） */
  remove: authedQuery
    .input(z.object({ id: z.number().int().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await findOwnedRule(input.id, ctx.user.id);
      await getDb().delete(customRules).where(eq(customRules.id, input.id));
      return { ok: true };
    }),
});
