import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import {
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
} from "./queries/notifications";

export const notificationsRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        offset: z.number().int().min(0).default(0),
        unreadOnly: z.boolean().default(false),
      }),
    )
    .query(({ ctx, input }) =>
      listNotifications(ctx.user.id, {
        limit: input.limit,
        offset: input.offset,
        unreadOnly: input.unreadOnly,
      }),
    ),

  unreadCount: authedQuery.query(({ ctx }) => unreadCount(ctx.user.id)),

  markRead: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await markRead(ctx.user.id, input.id);
      if (!ok) throw new TRPCError({ code: "NOT_FOUND", message: "通知不存在" });
      return { ok: true };
    }),

  markAllRead: authedQuery.mutation(async ({ ctx }) => {
    await markAllRead(ctx.user.id);
    return { ok: true };
  }),
});
