import AuthLayout from "@/components/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { cn } from "@/lib/utils";
import { trpc, type RouterOutputs } from "@/providers/trpc";
import { Bell, CheckCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type NotificationItem = RouterOutputs["notifications"]["list"]["items"][number];
type NotificationType = NotificationItem["type"];

const PAGE_SIZE = 20;

const TYPE_META: Record<NotificationType, { label: string; badgeClass: string }> = {
  detection_done: { label: "检测完成", badgeClass: "bg-green-100 text-green-800 border-green-200" },
  detection_failed: { label: "检测失败", badgeClass: "bg-red-100 text-red-800 border-red-200" },
  quota_low: { label: "额度提醒", badgeClass: "bg-amber-100 text-amber-800 border-amber-200" },
  plan_activated: { label: "套餐生效", badgeClass: "bg-blue-100 text-blue-800 border-blue-200" },
  plan_expiring: { label: "套餐到期", badgeClass: "bg-stone-100 text-stone-600 border-stone-200" },
  system: { label: "系统通知", badgeClass: "bg-stone-100 text-stone-600 border-stone-200" },
};

export function formatNotificationTime(input: Date | string): string {
  const date = new Date(input);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function NotificationTypeBadge({ type }: { type: NotificationType }) {
  const meta = TYPE_META[type] ?? { label: type, badgeClass: "bg-stone-100 text-stone-600 border-stone-200" };
  return (
    <Badge variant="outline" className={cn("shrink-0 border", meta.badgeClass)}>
      {meta.label}
    </Badge>
  );
}

export default function Notifications() {
  useDocumentTitle("通知中心 - 剧合规");
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.notifications.list.useQuery({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    unreadOnly,
  });

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      toast.success("已全部标记为已读");
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
    onError: (e) => toast.error(e.message || "操作失败"),
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const onItemClick = (n: NotificationItem) => {
    if (!n.isRead) markRead.mutate({ id: n.id });
    if (n.type === "detection_done" && n.refId != null) {
      navigate(`/submissions/${n.refId}`);
    }
  };

  return (
    <AuthLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">通知中心</h1>
            <p className="text-sm text-muted-foreground mt-1">
              检测完成、额度与套餐动态会在此提醒，共 {total} 条
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="unread-only"
                checked={unreadOnly}
                onCheckedChange={(v) => {
                  setUnreadOnly(v);
                  setPage(1);
                }}
              />
              <Label htmlFor="unread-only" className="text-sm">
                仅看未读
              </Label>
            </div>
            <Button
              variant="outline"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="mr-2 h-4 w-4" /> 全部已读
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !data?.items.length ? (
              <div className="py-12 text-center text-muted-foreground">
                <Bell className="mx-auto mb-3 h-10 w-10 opacity-40" />
                {unreadOnly ? "没有未读通知" : "暂无通知"}
              </div>
            ) : (
              <div className="divide-y">
                {data.items.map((n) => {
                  const clickable = n.type === "detection_done" && n.refId != null;
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        "flex items-start gap-3 px-3 py-4 transition-colors",
                        !n.isRead && "bg-primary/5",
                        clickable && "cursor-pointer hover:bg-accent/60",
                      )}
                      onClick={() => onItemClick(n)}
                    >
                      <span
                        className={cn(
                          "mt-2 h-2 w-2 shrink-0 rounded-full",
                          n.isRead ? "bg-transparent" : "bg-primary",
                        )}
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <NotificationTypeBadge type={n.type} />
                          <span
                            className={cn(
                              "text-sm",
                              n.isRead ? "text-muted-foreground" : "font-medium",
                            )}
                          >
                            {n.title}
                          </span>
                        </div>
                        {n.content && (
                          <p className="text-sm text-muted-foreground">{n.content}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatNotificationTime(n.createdAt)}
                        </p>
                      </div>
                      {!n.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            markRead.mutate({ id: n.id });
                          }}
                        >
                          标为已读
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationLink
                  size="default"
                  className={cn(
                    "cursor-pointer gap-1 px-2.5",
                    page <= 1 && "pointer-events-none opacity-50",
                  )}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一页
                </PaginationLink>
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink className="cursor-pointer" isActive={p === page} onClick={() => setPage(p)}>
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  className={cn(page >= totalPages && "pointer-events-none opacity-50")}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  下一页
                </PaginationNext>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </AuthLayout>
  );
}
