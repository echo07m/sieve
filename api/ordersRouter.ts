import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { orders, users } from "@db/schema";
import { PLANS, type PlanCode } from "@contracts/constants";
import { activatePlan } from "./queries/billing";
import { desc, eq, sql } from "drizzle-orm";

/** 订单号：DD-YYYYMMDD-XXXX（当日序号） */
async function nextOrderNo(): Promise<string> {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orders)
    .where(sql`${orders.orderNo} LIKE ${"DD-" + day + "-%"}`);
  return `DD-${day}-${String(Number(row?.n ?? 0) + 1).padStart(4, "0")}`;
}

/**
 * 订单与收款（仅 admin）：线下签约收款的登记台账。
 * 标记已收款 → 自动联动开通对应订阅方案（商业闭环的开通动作）。
 */
export const ordersRouter = createRouter({
  /** 订单列表（含客户信息） */
  list: adminQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({
        order: orders,
        userName: users.name,
        userEmail: users.email,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .orderBy(desc(orders.id))
      .limit(500);
    return rows.map((r) => ({ ...r.order, userName: r.userName, userEmail: r.userEmail }));
  }),

  /** 录入订单（默认待收款） */
  create: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        planCode: z.enum(["free", "per_use", "team", "enterprise"]),
        amount: z.number().positive("金额必须大于 0").max(100_000_000),
        contractNo: z.string().max(64).optional(),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1);
      if (!u) throw new TRPCError({ code: "NOT_FOUND", message: "用户不存在" });
      const orderNo = await nextOrderNo();
      const plan = PLANS[input.planCode as PlanCode];
      const [inserted] = await db.insert(orders).values({
        orderNo,
        userId: input.userId,
        planCode: input.planCode,
        planName: plan.name,
        amount: String(input.amount),
        contractNo: input.contractNo ?? "",
        note: input.note ?? "",
      });
      return { id: Number(inserted.insertId), orderNo };
    }),

  /** 标记已收款：订单置 paid 并联动开通订阅方案 */
  markPaid: adminQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [o] = await db.select().from(orders).where(eq(orders.id, input.id)).limit(1);
      if (!o) throw new TRPCError({ code: "NOT_FOUND", message: "订单不存在" });
      if (o.payStatus !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "订单已处理，请勿重复操作" });
      }
      await db
        .update(orders)
        .set({ payStatus: "paid", paidAt: new Date() })
        .where(eq(orders.id, o.id));
      await activatePlan(o.userId, o.planCode as PlanCode, `订单 ${o.orderNo} 收款开通`);
      return { ok: true };
    }),

  /** 退款登记：订单置 refunded，订阅方案过期（后台可操作） */
  refund: adminQuery
    .input(z.object({ id: z.number().int().positive(), note: z.string().max(500).optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [o] = await db.select().from(orders).where(eq(orders.id, input.id)).limit(1);
      if (!o) throw new TRPCError({ code: "NOT_FOUND", message: "订单不存在" });
      if (o.payStatus !== "paid") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "仅已收款订单可退款" });
      }
      await db
        .update(orders)
        .set({
          payStatus: "refunded",
          note: input.note ? `${o.note}｜退款：${input.note}`.slice(0, 500) : o.note,
        })
        .where(eq(orders.id, o.id));
      return { ok: true };
    }),
});
