import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import {
  getOrCreateSubscription,
  activatePlan,
} from "./queries/billing";
import { PLANS, PLAN_ORDER } from "@contracts/constants";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { desc } from "drizzle-orm";

export const billingRouter = createRouter({
  /** 当前用户订阅与用量（前端计费页/配额提示） */
  myPlan: authedQuery.query(async ({ ctx }) => {
    const sub = await getOrCreateSubscription(ctx.user.id);
    const plan = PLANS[sub.planCode as keyof typeof PLANS] ?? PLANS.free;
    return { subscription: sub, plan };
  }),

  /** 全部定价方案（公开展示用，前端直接读 contracts 亦可，这里供管理台核对） */
  plans: authedQuery.query(() =>
    PLAN_ORDER.map((code) => PLANS[code]),
  ),

  /** 管理员：留资转化后为用户开通/调整方案 */
  activate: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        planCode: z.enum(["free", "per_use", "team", "enterprise"]),
        note: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await activatePlan(input.userId, input.planCode, input.note ?? "");
      return { ok: true };
    }),

  /** 管理员：用户列表（用于激活方案时选人） */
  users: adminQuery.query(() =>
    getDb()
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.id))
      .limit(200),
  ),
});
