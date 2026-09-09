/**
 * F12 开放API：API Key 管理 tRPC 路由
 * 存储口径：只存 SHA-256 哈希与前缀，完整明文 Key 仅在创建时返回一次。
 */
import { createHash, randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { apiKeys } from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";

export const apiKeysRouter = createRouter({
  /** 当前用户的 Key 列表（不返回 keyHash） */
  list: authedQuery.query(({ ctx }) =>
    getDb()
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        status: apiKeys.status,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, ctx.user.id))
      .orderBy(desc(apiKeys.createdAt)),
  ),

  /** 创建 Key：生成 jhg_ + 48位hex，存 SHA-256，完整明文仅此一次返回 */
  create: authedQuery
    .input(z.object({ name: z.string().min(1, "请填写 Key 名称").max(128, "名称过长") }))
    .mutation(async ({ ctx, input }) => {
      const plainKey = `jhg_${randomBytes(24).toString("hex")}`;
      const keyHash = createHash("sha256").update(plainKey).digest("hex");
      const prefix = plainKey.slice(0, 12); // jhg_ + 前8位，用于列表识别
      const db = getDb();
      const [inserted] = await db.insert(apiKeys).values({
        userId: ctx.user.id,
        name: input.name,
        prefix,
        keyHash,
      });
      return {
        id: Number(inserted.insertId),
        name: input.name,
        prefix,
        key: plainKey, // 完整明文仅此一次展示
        createdAt: new Date(),
      };
    }),

  /** 吊销 Key：校验归属后置为 revoked（立即生效，不可恢复） */
  revoke: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const rows = await db
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(and(eq(apiKeys.id, input.id), eq(apiKeys.userId, ctx.user.id)))
        .limit(1);
      if (!rows[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "API Key 不存在或无权限操作" });
      }
      await db.update(apiKeys).set({ status: "revoked" }).where(eq(apiKeys.id, input.id));
      return { ok: true };
    }),
});
