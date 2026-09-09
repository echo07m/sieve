import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { webhookDeliveries, webhookEndpoints } from "@db/schema";
import { authedQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import {
  enqueueTestPing,
  generateWebhookSecret,
  redeliver,
} from "./queries/detectTasks";

const urlSchema = z
  .string()
  .url("请填写合法 URL")
  .max(300)
  .refine((u) => u.startsWith("https://") || u.startsWith("http://"), "仅支持 http/https");

/** Webhook 端点管理（登录用户）：配置回调地址，接收异步检测完成事件 */
export const webhooksRouter = createRouter({
  /** 端点列表 */
  listEndpoints: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.userId, ctx.user.id))
      .orderBy(desc(webhookEndpoints.createdAt));
  }),

  /** 新建端点（自动生成签名密钥） */
  createEndpoint: authedQuery
    .input(z.object({ name: z.string().max(64).default(""), url: urlSchema }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [{ c }] = await db
        .select({ c: sql<number>`count(*)` })
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.userId, ctx.user.id));
      if (c >= 5) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "每个账号最多配置 5 个 Webhook 端点" });
      }
      const secret = generateWebhookSecret();
      await db.insert(webhookEndpoints).values({
        userId: ctx.user.id,
        name: input.name,
        url: input.url,
        secret,
      });
      return { ok: true, secret };
    }),

  /** 更新端点（改名/改地址/启停/重置密钥） */
  updateEndpoint: authedQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().max(64).optional(),
        url: urlSchema.optional(),
        isActive: z.boolean().optional(),
        rotateSecret: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [ep] = await db
        .select()
        .from(webhookEndpoints)
        .where(and(eq(webhookEndpoints.id, input.id), eq(webhookEndpoints.userId, ctx.user.id)))
        .limit(1);
      if (!ep) throw new TRPCError({ code: "NOT_FOUND", message: "端点不存在" });
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.url !== undefined) patch.url = input.url;
      if (input.isActive !== undefined) patch.isActive = input.isActive;
      if (input.rotateSecret) patch.secret = generateWebhookSecret();
      await db.update(webhookEndpoints).set(patch).where(eq(webhookEndpoints.id, ep.id));
      return { ok: true, secret: input.rotateSecret ? (patch.secret as string) : undefined };
    }),

  /** 删除端点 */
  deleteEndpoint: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .delete(webhookEndpoints)
        .where(and(eq(webhookEndpoints.id, input.id), eq(webhookEndpoints.userId, ctx.user.id)));
      return { ok: true };
    }),

  /** 投递记录（分页） */
  listDeliveries: authedQuery
    .input(
      z.object({
        endpointId: z.number().int().positive().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const eps = await db
        .select({ id: webhookEndpoints.id })
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.userId, ctx.user.id));
      const epIds = eps.map((e) => e.id);
      if (epIds.length === 0) return { items: [], total: 0 };
      const ids = input.endpointId && epIds.includes(input.endpointId) ? [input.endpointId] : epIds;
      const where = sql`${webhookDeliveries.endpointId} in (${sql.join(ids.map((i) => sql`${i}`), sql`,`)})`;
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)` })
        .from(webhookDeliveries)
        .where(where);
      const items = await db
        .select()
        .from(webhookDeliveries)
        .where(where)
        .orderBy(desc(webhookDeliveries.id))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      return { items, total };
    }),

  /** 手动重推失败投递 */
  redeliver: authedQuery
    .input(z.object({ deliveryId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await redeliver(input.deliveryId, ctx.user.id);
      if (!ok) throw new TRPCError({ code: "NOT_FOUND", message: "投递记录不存在" });
      return { ok: true };
    }),

  /** 发送测试事件 test.ping */
  testPing: authedQuery
    .input(z.object({ endpointId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [ep] = await db
        .select()
        .from(webhookEndpoints)
        .where(and(eq(webhookEndpoints.id, input.endpointId), eq(webhookEndpoints.userId, ctx.user.id)))
        .limit(1);
      if (!ep) throw new TRPCError({ code: "NOT_FOUND", message: "端点不存在" });
      await enqueueTestPing(ep.id);
      return { ok: true };
    }),
});
