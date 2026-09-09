import { and, desc, eq, sql } from "drizzle-orm";
import { notifications } from "@db/schema";
import type { Notification } from "@db/schema";
import { getDb } from "./connection";

type NotificationType = Notification["type"];

/** 创建站内通知。失败静默——通知是增强项，不应阻断主流程。 */
export async function createNotification(
  userId: number,
  type: NotificationType,
  title: string,
  content = "",
  refId?: number,
): Promise<void> {
  try {
    await getDb()
      .insert(notifications)
      .values({ userId, type, title, content: content.slice(0, 1000), refId });
  } catch (e) {
    console.error("[notifications] create failed:", e);
  }
}

export async function listNotifications(
  userId: number,
  opts: { limit: number; offset: number; unreadOnly: boolean },
): Promise<{ items: Notification[]; total: number }> {
  const db = getDb();
  const where = opts.unreadOnly
    ? and(eq(notifications.userId, userId), eq(notifications.isRead, false))
    : eq(notifications.userId, userId);
  const items = await db
    .select()
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.id))
    .limit(opts.limit)
    .offset(opts.offset);
  const totalRows = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(where);
  return { items, total: Number(totalRows[0]?.c ?? 0) };
}

export async function unreadCount(userId: number): Promise<number> {
  const rows = await getDb()
    .select({ c: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return Number(rows[0]?.c ?? 0);
}

/** 仅允许标记自己的通知，返回是否命中 */
export async function markRead(userId: number, id: number): Promise<boolean> {
  const r = await getDb()
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  return (r[0]?.affectedRows ?? 0) > 0;
}

export async function markAllRead(userId: number): Promise<void> {
  await getDb()
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}
