import { createHash } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { authChains, copyrightChecks, ipReferences } from "@db/schema";
import { computeSimilarity } from "./engine/shingle";

/** 授权链六节点（顺序固定：授权申请→改编红线→关键剧情确认→中期审查→成片审查→成片备案） */
export const AUTH_NODE_VALUES = [
  "authorization_application",
  "adaptation_boundary",
  "key_plot_confirm",
  "mid_review",
  "final_review",
  "filing_record",
] as const;

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export const copyrightRouter = createRouter({
  /** 经典IP参照库（C4）：前端按 category 分组展示 */
  ipLibrary: authedQuery.query(() =>
    getDb().select().from(ipReferences).orderBy(ipReferences.category, ipReferences.id),
  ),

  /** 桥段级查重：shingle containment 相似度 + 匹配片段 + 双文本 SHA-256 留痕入库 */
  runCheck: authedQuery
    .input(
      z.object({
        workTitle: z.string().min(1, "请填写作品名称").max(255),
        refTitle: z.string().min(1, "请填写参照作品名称").max(255),
        refText: z.string().min(50, "参照原文过短（至少50字）").max(500_000, "参照原文超出上限"),
        targetText: z.string().min(50, "待查剧本过短（至少50字）").max(500_000, "待查剧本超出上限"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { similarity, segments } = computeSimilarity(input.targetText, input.refText);
      const refHash = sha256(input.refText);
      const targetHash = sha256(input.targetText);
      const result = { similarity, segments, refHash, targetHash };

      const db = getDb();
      const [inserted] = await db.insert(copyrightChecks).values({
        userId: ctx.user.id,
        workTitle: input.workTitle,
        refTitle: input.refTitle,
        refText: input.refText,
        targetText: input.targetText,
        result,
      });

      return {
        id: Number(inserted.insertId),
        workTitle: input.workTitle,
        refTitle: input.refTitle,
        createdAt: new Date(),
        result,
      };
    }),

  /** 当前用户的查重记录（排除大文本字段 refText/targetText） */
  listChecks: authedQuery.query(({ ctx }) =>
    getDb()
      .select({
        id: copyrightChecks.id,
        workTitle: copyrightChecks.workTitle,
        refTitle: copyrightChecks.refTitle,
        result: copyrightChecks.result,
        createdAt: copyrightChecks.createdAt,
      })
      .from(copyrightChecks)
      .where(eq(copyrightChecks.userId, ctx.user.id))
      .orderBy(desc(copyrightChecks.id)),
  ),

  /** 单条查重详情（校验归属，含大文本与完整结果） */
  checkDetail: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const rows = await getDb()
        .select()
        .from(copyrightChecks)
        .where(and(eq(copyrightChecks.id, input.id), eq(copyrightChecks.userId, ctx.user.id)))
        .limit(1);
      const row = rows[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "查重记录不存在" });
      return row;
    }),

  /** 授权链六节点留痕查询：按 作品名+IP名 返回已有节点记录 */
  listAuthChains: authedQuery
    .input(
      z.object({
        workTitle: z.string().min(1, "请填写作品名称").max(255),
        ipName: z.string().min(1, "请填写IP名称").max(255),
      }),
    )
    .query(({ ctx, input }) =>
      getDb()
        .select()
        .from(authChains)
        .where(
          and(
            eq(authChains.userId, ctx.user.id),
            eq(authChains.workTitle, input.workTitle),
            eq(authChains.ipName, input.ipName),
          ),
        )
        .orderBy(authChains.id),
    ),

  /** 节点留痕（upsert：同 用户+作品+IP+节点 已存在则更新证据与哈希），status=done */
  addAuthNode: authedQuery
    .input(
      z.object({
        workTitle: z.string().min(1, "请填写作品名称").max(255),
        ipName: z.string().min(1, "请填写IP名称").max(255),
        node: z.enum(AUTH_NODE_VALUES),
        evidenceText: z.string().min(1, "请填写留痕说明").max(5000, "留痕说明过长"),
        operatorName: z.string().min(1, "请填写操作人").max(128),
        occurredAt: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const occurredAt = input.occurredAt ?? new Date();
      // 留痕哈希：作品+IP+节点+证据+时间 的 SHA-256，保证内容可核验、不可抵赖
      const evidenceHash = sha256(
        input.workTitle + input.ipName + input.node + input.evidenceText + occurredAt.toISOString(),
      );

      const db = getDb();
      const existing = await db
        .select({ id: authChains.id })
        .from(authChains)
        .where(
          and(
            eq(authChains.userId, ctx.user.id),
            eq(authChains.workTitle, input.workTitle),
            eq(authChains.ipName, input.ipName),
            eq(authChains.node, input.node),
          ),
        )
        .limit(1);

      const payload = {
        status: "done" as const,
        evidenceText: input.evidenceText,
        evidenceHash,
        operatorName: input.operatorName,
        occurredAt,
      };

      if (existing[0]) {
        await db.update(authChains).set(payload).where(eq(authChains.id, existing[0].id));
        return { id: existing[0].id, evidenceHash, updated: true };
      }

      const [inserted] = await db.insert(authChains).values({
        userId: ctx.user.id,
        workTitle: input.workTitle,
        ipName: input.ipName,
        node: input.node,
        ...payload,
      });
      return { id: Number(inserted.insertId), evidenceHash, updated: false };
    }),
});
