import { useMemo, useState } from "react";
import AuthLayout from "@/components/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { trpc } from "@/providers/trpc";
import { PLANS, PLAN_ORDER, type PlanCode } from "@contracts/constants";
import {
  ClipboardList,
  Plus,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

type PayStatus = "pending" | "paid" | "refunded";

const STATUS_META: Record<PayStatus, { label: string; className: string }> = {
  pending: { label: "待收款", className: "bg-amber-100 text-amber-900" },
  paid: { label: "已收款", className: "bg-emerald-100 text-emerald-900" },
  refunded: { label: "已退款", className: "bg-stone-200 text-stone-700" },
};

function formatTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("zh-CN", { hour12: false });
}

function formatAmount(amount: string | number) {
  const n = Number(amount);
  if (Number.isNaN(n)) return `¥${amount}`;
  return `¥${n.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

/** 无权限（如 403）警示卡片 */
function ForbiddenCard() {
  return (
    <Card className="border-amber-700/40 bg-amber-50/50">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <ShieldAlert className="h-10 w-10 text-amber-800" />
        <p className="font-medium">无权限访问：该页面仅管理员可见</p>
        <p className="text-sm text-muted-foreground">
          如需访问订单管理，请联系管理员开通权限。
        </p>
        <Button asChild variant="outline" className="mt-2">
          <Link to="/dashboard">返回工作台</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** 录入订单对话框 */
function CreateOrderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const { data: users } = trpc.billing.users.useQuery();
  const [userId, setUserId] = useState<string>("");
  const [planCode, setPlanCode] = useState<PlanCode>("team");
  const [amount, setAmount] = useState<string>("");
  const [contractNo, setContractNo] = useState("");
  const [note, setNote] = useState("");

  const create = trpc.orders.create.useMutation({
    onSuccess: async (res) => {
      toast.success(`订单已生成：${res.orderNo}`);
      reset();
      onOpenChange(false);
      await utils.orders.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "订单创建失败"),
  });

  const reset = () => {
    setUserId("");
    setPlanCode("team");
    setAmount("");
    setContractNo("");
    setNote("");
  };

  const handleSubmit = () => {
    if (!userId) return toast.error("请选择客户");
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value < 0) {
      return toast.error("请输入有效金额（元）");
    }
    create.mutate({
      userId: Number(userId),
      planCode,
      amount: value,
      contractNo: contractNo.trim() || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>录入订单</DialogTitle>
          <DialogDescription>
            为已转化的客户录入订单，确认收款后将自动开通对应方案
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>客户</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="选择客户（昵称 / 邮箱）" />
              </SelectTrigger>
              <SelectContent>
                {(users ?? []).map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name || "未命名用户"}（{u.email || `ID ${u.id}`}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                    {PLANS[code].name}（参考价 {PLANS[code].priceText}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>金额（元）</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="如：1500"
            />
          </div>
          <div className="space-y-2">
            <Label>合同编号</Label>
            <Input
              value={contractNo}
              onChange={(e) => setContractNo(e.target.value)}
              placeholder="线下合同编号（选填）"
              maxLength={64}
            />
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending ? "提交中…" : "确认录入"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 标记收款二次确认对话框 */
function MarkPaidDialog({
  order,
  open,
  onOpenChange,
}: {
  order: { id: number; orderNo: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const markPaid = trpc.orders.markPaid.useMutation({
    onSuccess: async () => {
      toast.success("已确认收款并开通方案");
      onOpenChange(false);
      await utils.orders.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "操作失败"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>确认收款</DialogTitle>
          <DialogDescription>
            订单 {order?.orderNo}：确认已收到款项？将自动为客户开通对应方案。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={() => order && markPaid.mutate({ id: order.id })}
            disabled={markPaid.isPending}
          >
            {markPaid.isPending ? "处理中…" : "确认收款"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 退款对话框 */
function RefundDialog({
  order,
  open,
  onOpenChange,
}: {
  order: { id: number; orderNo: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const [note, setNote] = useState("");
  const refund = trpc.orders.refund.useMutation({
    onSuccess: async () => {
      toast.success("已标记退款");
      setNote("");
      onOpenChange(false);
      await utils.orders.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "操作失败"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>订单退款</DialogTitle>
          <DialogDescription>
            订单 {order?.orderNo}：退款后该订单将标记为「已退款」。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>退款备注</Label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="如：客户取消合作，已原路退回（选填）"
            maxLength={255}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={() =>
              order &&
              refund.mutate({ id: order.id, note: note.trim() || undefined })
            }
            disabled={refund.isPending}
          >
            {refund.isPending ? "处理中…" : "确认退款"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 管理员订单管理页 */
export default function AdminOrders() {
  const { data: orders, isLoading, error } = trpc.orders.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [paidTarget, setPaidTarget] = useState<{
    id: number;
    orderNo: string;
  } | null>(null);
  const [refundTarget, setRefundTarget] = useState<{
    id: number;
    orderNo: string;
  } | null>(null);

  const stats = useMemo(() => {
    const list = orders ?? [];
    const pendingCount = list.filter((o) => o.payStatus === "pending").length;
    const refundedCount = list.filter((o) => o.payStatus === "refunded").length;
    const paidTotal = list
      .filter((o) => o.payStatus === "paid")
      .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    return { pendingCount, refundedCount, paidTotal };
  }, [orders]);

  return (
    <AuthLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">订单管理</h1>
            <p className="text-sm text-muted-foreground mt-1">
              录入线索转化订单，确认收款后自动开通对应方案
            </p>
          </div>
          <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-900">
            <ShieldCheck className="h-3.5 w-3.5" /> 仅管理员可见
          </Badge>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        ) : error ? (
          <ForbiddenCard />
        ) : (
          <>
            {/* 统计条 */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-amber-700/30 bg-amber-50/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    待收款订单
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-amber-800">
                    {stats.pendingCount}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-emerald-700/30 bg-emerald-50/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    已收款总额
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-emerald-800">
                    {formatAmount(stats.paidTotal)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-stone-400/30 bg-stone-50/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    退款订单
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-stone-700">
                    {stats.refundedCount}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button className="gap-1" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> 录入订单
              </Button>
            </div>

            {!orders || orders.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
                暂无订单，线索转化后在此录入
              </div>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">订单号</TableHead>
                      <TableHead>客户</TableHead>
                      <TableHead>方案</TableHead>
                      <TableHead className="whitespace-nowrap">金额</TableHead>
                      <TableHead>合同号</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="whitespace-nowrap">创建时间</TableHead>
                      <TableHead className="whitespace-nowrap">收款时间</TableHead>
                      <TableHead className="max-w-48">备注</TableHead>
                      <TableHead className="w-28">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {order.orderNo}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {order.userName || "未命名用户"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {order.userEmail || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {order.planName ||
                            PLANS[order.planCode as PlanCode]?.name ||
                            order.planCode}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatAmount(order.amount)}
                        </TableCell>
                        <TableCell>{order.contractNo || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              STATUS_META[order.payStatus as PayStatus]
                                ?.className
                            }
                          >
                            {STATUS_META[order.payStatus as PayStatus]?.label ??
                              order.payStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatTime(order.createdAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatTime(order.paidAt)}
                        </TableCell>
                        <TableCell className="max-w-48 truncate text-muted-foreground">
                          {order.note || "—"}
                        </TableCell>
                        <TableCell>
                          {order.payStatus === "pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 whitespace-nowrap"
                              onClick={() =>
                                setPaidTarget({
                                  id: order.id,
                                  orderNo: order.orderNo,
                                })
                              }
                            >
                              <Receipt className="h-3.5 w-3.5" /> 标记收款
                            </Button>
                          )}
                          {order.payStatus === "paid" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 whitespace-nowrap"
                              onClick={() =>
                                setRefundTarget({
                                  id: order.id,
                                  orderNo: order.orderNo,
                                })
                              }
                            >
                              <Undo2 className="h-3.5 w-3.5" /> 退款
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}

        <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen} />
        <MarkPaidDialog
          order={paidTarget}
          open={!!paidTarget}
          onOpenChange={(open) => !open && setPaidTarget(null)}
        />
        <RefundDialog
          order={refundTarget}
          open={!!refundTarget}
          onOpenChange={(open) => !open && setRefundTarget(null)}
        />
      </div>
    </AuthLayout>
  );
}
