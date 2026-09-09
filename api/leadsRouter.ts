import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { createLead, listLeads, updateLeadStatus } from "./queries/billing";

/** 公开端点防滥用：同一 IP 每小时最多 5 条留资（单实例内存口径） */
const LEAD_WINDOW_MS = 3600_000;
const LEAD_MAX_PER_WINDOW = 5;
const leadBuckets = new Map<string, { windowStart: number; count: number }>();

function hitLeadLimit(key: string): boolean {
  const now = Date.now();
  const b = leadBuckets.get(key);
  if (!b || now - b.windowStart >= LEAD_WINDOW_MS) {
    leadBuckets.set(key, { windowStart: now, count: 1 });
    return false;
  }
  b.count += 1;
  return b.count > LEAD_MAX_PER_WINDOW;
}

export const leadsRouter = createRouter({
  /** 公开留资：定价页/配额弹窗/文档页共用（防滥用：字段长度与联系方式格式校验） */
  create: publicQuery
    .input(
      z.object({
        name: z.string().min(1, "请填写称呼").max(64),
        company: z.string().max(128).optional(),
        contact: z
          .string()
          .min(5, "请填写有效联系方式（手机/微信/邮箱）")
          .max(128),
        message: z.string().max(1000).optional(),
        source: z.enum(["pricing", "paywall", "docs", "api"]).optional(),
        planInterest: z.string().max(32).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const fwd = ctx.req.headers.get("x-forwarded-for") ?? "";
      const ip = fwd.split(",")[0]?.trim() || "unknown";
      if (hitLeadLimit(ip)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "提交过于频繁，请稍后再试",
        });
      }
      await createLead(input);
      return { ok: true };
    }),

  /** 管理员：线索列表 */
  list: adminQuery.query(() => listLeads()),

  /** 管理员：更新跟进状态 */
  updateStatus: adminQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["new", "contacted", "converted"]),
      }),
    )
    .mutation(async ({ input }) => {
      await updateLeadStatus(input.id, input.status);
      return { ok: true };
    }),
});
