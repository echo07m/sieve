import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { policyUpdates, rules } from "@db/schema";
import { adminQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";

const policyInput = z.object({
  title: z.string().min(2).max(255),
  source: z.string().max(128).default(""),
  sourceUrl: z.string().max(300).default(""),
  publishedAt: z.coerce.date().nullable().optional(),
  summary: z.string().min(10).max(1000),
  impactAssessment: z.string().max(1000).default(""),
  relatedRuleCodes: z.array(z.string().max(32)).max(10),
});

/**
 * 政策雷达（admin）：录入监管/平台新规动态，做影响评估，
 * 可将确认影响的条目一键转为规则草稿（disabled 状态，走既有规则发布流程）。
 */
export const policyRouter = createRouter({
  list: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(policyUpdates).orderBy(desc(policyUpdates.createdAt));
  }),

  create: adminQuery.input(policyInput).mutation(async ({ input }) => {
    const db = getDb();
    await db.insert(policyUpdates).values({
      ...input,
      publishedAt: input.publishedAt ?? null,
      status: "pending",
    });
    return { ok: true };
  }),

  update: adminQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        data: policyInput.partial(),
        status: z.enum(["pending", "reviewed", "converted"]).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const patch: Record<string, unknown> = { ...input.data };
      if (input.data.publishedAt !== undefined) {
        patch.publishedAt = input.data.publishedAt ?? null;
      }
      if (input.status) patch.status = input.status;
      await db.update(policyUpdates).set(patch).where(eq(policyUpdates.id, input.id));
      return { ok: true };
    }),

  remove: adminQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(policyUpdates).where(eq(policyUpdates.id, input.id));
      return { ok: true };
    }),

  /**
   * 转为规则草稿：以政策条目为来源生成一条 disabled 规则（关键词留空待补），
   * 管理员在规则管理中完善后随版本发布生效。
   */
  convertToRuleDraft: adminQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        category: z.enum([
          "child_harm",
          "soft_porn",
          "money_worship",
          "marriage_distortion",
          "feudal_dregs",
          "violent_revenge",
          "vulgar_title",
          "ip_infringement",
        ]),
        severity: z.enum(["block", "high", "notice"]).default("notice"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [p] = await db
        .select()
        .from(policyUpdates)
        .where(eq(policyUpdates.id, input.id))
        .limit(1);
      if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "政策条目不存在" });
      if (p.status === "converted") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "该条目已转换过规则草稿" });
      }

      // 生成唯一 ruleCode：PX-年份-政策ID
      const ruleCode = `PX-${new Date().getFullYear()}-${String(p.id).padStart(3, "0")}`;
      await db.insert(rules).values({
        ruleCode,
        version: "1.0.0",
        status: "disabled", // 草稿：默认停用，完善关键词/正则后随版本发布
        category: input.category,
        name: `【政策草稿】${p.title}`.slice(0, 255),
        severity: input.severity,
        sourcePolicy: p.source || p.title.slice(0, 255),
        sourceClause: "待补充",
        originalText: p.summary.slice(0, 5000),
        sourceConfidence: "official_text",
        scope: ["full_text"],
        keywords: [],
        patterns: [],
        cooccurrence: [],
        baseConfidence: "0.70",
        remediationTemplate: p.impactAssessment || "待根据政策原文完善整改建议。",
        platformOverrides: {},
      });
      await db
        .update(policyUpdates)
        .set({ status: "converted", draftRuleCode: ruleCode })
        .where(eq(policyUpdates.id, p.id));
      return { ok: true, ruleCode };
    }),
});
