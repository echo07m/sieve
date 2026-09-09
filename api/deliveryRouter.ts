import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { deliveries, filingPackages, type Delivery } from "@db/schema";

/**
 * F10 备案代办聚合：材料投递记录、进度跟踪、时限管理与超期预警
 * 注意：本模块只做通道聚合与时限管理，不承诺备案结果。
 */

const CHANNEL_VALUES = ["universal", "hongguo", "fanqie", "kuaishou", "wechat"] as const;
const ADVANCEABLE_STATUSES = ["submitted", "under_review", "accepted", "rejected"] as const;
const ACTIVE_STATUSES: Delivery["status"][] = ["submitted", "under_review"];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 计算超期标记与剩余天数：已完结（通过/驳回）或未投递的记录返回 daysLeft=null */
function computeTiming(d: Delivery): { overdue: boolean; daysLeft: number | null } {
  const resolved = d.status === "accepted" || d.status === "rejected";
  if (!d.submittedAt || resolved) return { overdue: false, daysLeft: null };
  const deadline = d.submittedAt.getTime() + d.deadlineDays * MS_PER_DAY;
  const now = Date.now();
  const overdue = ACTIVE_STATUSES.includes(d.status) && deadline < now;
  const daysLeft = Math.ceil((deadline - now) / MS_PER_DAY);
  return { overdue, daysLeft };
}

export const deliveryRouter = createRouter({
  /** 投递记录列表（联表备案材料包取作品名，附超期/剩余天数计算字段） */
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select({ delivery: deliveries, workTitle: filingPackages.workTitle })
      .from(deliveries)
      .leftJoin(filingPackages, eq(deliveries.filingId, filingPackages.id))
      .where(eq(deliveries.userId, ctx.user.id))
      .orderBy(desc(deliveries.createdAt));
    return rows.map(({ delivery, workTitle }) => ({
      ...delivery,
      workTitle: workTitle ?? "（材料包已删除）",
      ...computeTiming(delivery),
    }));
  }),

  /** 新建投递记录：选择材料包 + 目标通道 + 时限天数，初始状态为待投递 */
  create: authedQuery
    .input(
      z.object({
        filingId: z.number().int().positive("请选择备案材料包"),
        channel: z.enum(CHANNEL_VALUES),
        deadlineDays: z.number().int().min(1, "时限至少 1 天").max(90, "时限最多 90 天").default(15),
        note: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const filings = await db
        .select({ id: filingPackages.id })
        .from(filingPackages)
        .where(and(eq(filingPackages.id, input.filingId), eq(filingPackages.userId, ctx.user.id)))
        .limit(1);
      if (!filings[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "备案材料包不存在或不属于当前用户" });
      }
      const [inserted] = await db.insert(deliveries).values({
        userId: ctx.user.id,
        filingId: input.filingId,
        channel: input.channel,
        deadlineDays: input.deadlineDays,
        note: input.note ?? null,
        status: "preparing",
      });
      return { id: Number(inserted.insertId) };
    }),

  /** 推进投递状态：已投递记 submittedAt；通过/驳回记 resolvedAt；驳回必须填原因 */
  updateStatus: authedQuery
    .input(
      z
        .object({
          id: z.number().int().positive(),
          status: z.enum(ADVANCEABLE_STATUSES),
          receiptNo: z.string().max(128).optional(),
          rejectReason: z.string().max(2000).optional(),
          note: z.string().max(1000).optional(),
        })
        .refine((v) => v.status !== "rejected" || Boolean(v.rejectReason?.trim()), {
          message: "驳回时必须填写驳回原因",
          path: ["rejectReason"],
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const rows = await db
        .select({ id: deliveries.id })
        .from(deliveries)
        .where(and(eq(deliveries.id, input.id), eq(deliveries.userId, ctx.user.id)))
        .limit(1);
      if (!rows[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "投递记录不存在或不属于当前用户" });
      }

      const now = new Date();
      const patch: Partial<typeof deliveries.$inferInsert> = { status: input.status };
      if (input.status === "submitted") patch.submittedAt = now;
      if (input.status === "accepted" || input.status === "rejected") patch.resolvedAt = now;
      if (input.status === "rejected") patch.rejectReason = input.rejectReason!.trim();
      if (input.receiptNo !== undefined) patch.receiptNo = input.receiptNo;
      if (input.note !== undefined) patch.note = input.note;

      await db.update(deliveries).set(patch).where(eq(deliveries.id, input.id));
      return { ok: true };
    }),

  /** 统计：按状态分组计数 + 超期数量 */
  stats: authedQuery.query(async ({ ctx }) => {
    const rows = await getDb()
      .select()
      .from(deliveries)
      .where(eq(deliveries.userId, ctx.user.id));
    const byStatus: Record<Delivery["status"], number> = {
      preparing: 0,
      submitted: 0,
      under_review: 0,
      accepted: 0,
      rejected: 0,
    };
    let overdue = 0;
    for (const d of rows) {
      byStatus[d.status] += 1;
      if (computeTiming(d).overdue) overdue += 1;
    }
    return { byStatus, overdue, total: rows.length };
  }),
});
