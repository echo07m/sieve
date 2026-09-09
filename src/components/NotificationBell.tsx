import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  formatNotificationTime,
  NotificationTypeBadge,
} from "@/pages/Notifications";
import { trpc, type RouterOutputs } from "@/providers/trpc";
import { Bell } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

type NotificationItem = RouterOutputs["notifications"]["list"]["items"][number];

/** 顶栏通知铃铛：角标显示未读数（30s 轮询），下拉展示最近 5 条 */
export function NotificationBell() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);

  const { data: unread } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const { data, isLoading } = trpc.notifications.list.useQuery(
    { limit: 5, offset: 0, unreadOnly: false },
    { enabled: open },
  );

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const onItemClick = (n: NotificationItem) => {
    if (!n.isRead) markRead.mutate({ id: n.id });
    if (n.type === "detection_done" && n.refId != null) {
      setOpen(false);
      navigate(`/submissions/${n.refId}`);
    }
  };

  const unreadLabel = (unread ?? 0) > 99 ? "99+" : String(unread ?? 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="通知"
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
          {(unread ?? 0) > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 justify-center rounded-full border-0 bg-red-500 text-[10px] leading-none text-white">
              {unreadLabel}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-medium">通知</span>
          {(unread ?? 0) > 0 && (
            <span className="text-xs text-muted-foreground">{unread} 条未读</span>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data?.items.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">暂无通知</p>
          ) : (
            <div className="divide-y">
              {data.items.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "cursor-pointer px-4 py-3 transition-colors hover:bg-accent/60",
                    !n.isRead && "bg-primary/5",
                  )}
                  onClick={() => onItemClick(n)}
                >
                  <div className="flex items-center gap-2">
                    <NotificationTypeBadge type={n.type} />
                    <span
                      className={cn(
                        "truncate text-sm",
                        n.isRead ? "text-muted-foreground" : "font-medium",
                      )}
                    >
                      {n.title}
                    </span>
                    {!n.isRead && (
                      <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  {n.content && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {n.content}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatNotificationTime(n.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              setOpen(false);
              navigate("/notifications");
            }}
          >
            查看全部
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
