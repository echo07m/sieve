/**
 * 后台管理 · 用户管理（建议路由 /admin/users）
 * 用户列表 + 订阅方案调整 + 管理员角色切换，支持昵称/邮箱本地搜索。
 * 数据接口：trpc.admin.users / trpc.admin.setUserRole / trpc.billing.activate
 */
import { useState } from "react";
import AuthLayout from "@/components/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc, type RouterOutputs } from "@/providers/trpc";
import { PLANS, PLAN_ORDER, type PlanCode } from "@contracts/constants";
import { Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("zh-CN");
}

function planLabel(code: string) {
  return (PLANS as Record<string, { name: string }>)[code]?.name ?? code;
}

function ForbiddenCard() {
  return (
    <Card className="border-amber-300 bg-amber-50/60">
      <CardContent className="flex items-center gap-3 py-8">
        <ShieldAlert className="h-6 w-6 shrink-0 text-amber-600" />
        <div>
          <p className="font-medium text-amber-900">无权限访问</p>
          <p className="mt-1 text-sm text-amber-800/80">
            该页面仅对管理员开放，当前账号无权管理用户。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

type AdminUser = RouterOutputs["admin"]["users"][number];

export default function AdminUsers() {
  const utils = trpc.useUtils();
  const { data: users, isLoading, error } = trpc.admin.users.useQuery();
  const [keyword, setKeyword] = useState("");

  // 调整方案 Dialog 状态
  const [planDialogUser, setPlanDialogUser] = useState<AdminUser | null>(null);
  const [planCode, setPlanCode] = useState<PlanCode>("team");
  const [note, setNote] = useState("");

  const activate = trpc.billing.activate.useMutation({
    onSuccess: async () => {
      toast.success("方案已调整");
      setPlanDialogUser(null);
      setNote("");
      await utils.admin.users.invalidate();
    },
    onError: (err) => toast.error(err.message || "方案调整失败"),
  });

  const setRole = trpc.admin.setUserRole.useMutation({
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(res.reason ?? "操作失败");
        return;
      }
      toast.success("角色已更新");
      await utils.admin.users.invalidate();
    },
    onError: (err) => toast.error(err.message || "角色更新失败"),
  });

  const openPlanDialog = (u: AdminUser) => {
    setPlanDialogUser(u);
    setPlanCode((u.subscription?.planCode as PlanCode) ?? "free");
    setNote("");
  };

  const filtered = (users ?? []).filter((u) => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return true;
    return (
      (u.name ?? "").toLowerCase().includes(kw) ||
      (u.email ?? "").toLowerCase().includes(kw)
    );
  });

  return (
    <AuthLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">用户管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              查看注册用户、调整订阅方案与管理员角色
            </p>
          </div>
          <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-900">
            <ShieldCheck className="h-3.5 w-3.5" /> 仅管理员可见
          </Badge>
        </div>

        {error ? (
          <ForbiddenCard />
        ) : (
          <>
            {/* 搜索 */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="按昵称 / 邮箱搜索"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                {keyword ? "没有匹配的用户" : "暂无注册用户"}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">ID</TableHead>
                      <TableHead>昵称</TableHead>
                      <TableHead>邮箱</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead className="whitespace-nowrap">注册时间</TableHead>
                      <TableHead className="text-right">送检数</TableHead>
                      <TableHead>当前方案</TableHead>
                      <TableHead className="w-36">用量</TableHead>
                      <TableHead className="whitespace-nowrap">到期时间</TableHead>
                      <TableHead className="w-44">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((u) => {
                      const sub = u.subscription;
                      const quotaPct =
                        sub && sub.quotaTotal > 0
                          ? Math.min(100, (sub.quotaUsed / sub.quotaTotal) * 100)
                          : 0;
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {u.id}
                          </TableCell>
                          <TableCell className="font-medium">
                            {u.name || "未命名用户"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {u.email || "—"}
                          </TableCell>
                          <TableCell>
                            {u.role === "admin" ? (
                              <Badge className="bg-amber-600 text-white">管理员</Badge>
                            ) : (
                              <Badge variant="secondary">用户</Badge>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {formatDate(u.createdAt)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {u.submissionCount}
                          </TableCell>
                          <TableCell>
                            {sub ? (
                              <Badge variant="outline">
                                {sub.planName || planLabel(sub.planCode)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {!sub ? (
                              <span className="text-muted-foreground">—</span>
                            ) : sub.quotaTotal === -1 ? (
                              <span className="text-sm text-muted-foreground">不限量</span>
                            ) : (
                              <div className="space-y-1">
                                <Progress value={quotaPct} className="h-1.5" />
                                <div className="text-xs tabular-nums text-muted-foreground">
                                  {sub.quotaUsed} / {sub.quotaTotal}
                                </div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {sub?.expiresAt ? formatDate(sub.expiresAt) : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openPlanDialog(u)}
                              >
                                调整方案
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={setRole.isPending}
                                onClick={() =>
                                  setRole.mutate({
                                    userId: u.id,
                                    role: u.role === "admin" ? "user" : "admin",
                                  })
                                }
                              >
                                {u.role === "admin" ? "取消管理员" : "设为管理员"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}

        {/* 调整方案 Dialog */}
        <Dialog
          open={planDialogUser !== null}
          onOpenChange={(open) => {
            if (!open) setPlanDialogUser(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>调整订阅方案</DialogTitle>
              <DialogDescription>
                {planDialogUser
                  ? `为「${planDialogUser.name || "未命名用户"}」（${planDialogUser.email || `ID ${planDialogUser.id}`}）激活或调整订阅方案`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>方案</Label>
                <Select
                  value={planCode}
                  onValueChange={(v) => setPlanCode(v as PlanCode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_ORDER.map((code) => (
                      <SelectItem key={code} value={code}>
                        {PLANS[code].name}（{PLANS[code].priceText}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>备注</Label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="如：来自定价页留资，已线下签约（选填）"
                  maxLength={255}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPlanDialogUser(null)}>
                取消
              </Button>
              <Button
                disabled={activate.isPending || !planDialogUser}
                onClick={() => {
                  if (!planDialogUser) return;
                  activate.mutate({
                    userId: planDialogUser.id,
                    planCode,
                    note: note.trim() || undefined,
                  });
                }}
              >
                确认调整
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthLayout>
  );
}
