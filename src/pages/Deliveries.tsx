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
import { Textarea } from "@/components/ui/textarea";
import { PLATFORMS } from "@contracts/constants";
import { trpc } from "@/providers/trpc";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Send, XCircle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type DeliveryStatus = "preparing" | "submitted" | "under_review" | "accepted" | "rejected";
type Platform = keyof typeof PLATFORMS;

interface DeliveryItem {
  id: number;
  filingId: number;
  channel: string;
  status: DeliveryStatus;
  receiptNo: string;
  rejectReason: string | null;
  deadlineDays: number;
  submittedAt: string | Date | null;
  resolvedAt: string | Date | null;
  note: string | null;
  createdAt: string | Date;
  workTitle: string;
  overdue: boolean;
  daysLeft: number | null;
}

interface DeliveryStats {
  byStatus: Record<DeliveryStatus, number>;
  overdue: number;
  total: number;
}

// deliveryRouter 尚未挂载到 appRouter（由集成方注册），此处按结构断言访问
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deliveryApi = (trpc as any).delivery as {
  list: { useQuery: () => { data?: DeliveryItem[]; isLoading: boolean } };
  stats: { useQuery: () => { data?: DeliveryStats } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create: { useMutation: (opts: any) => { mutate: (v: any) => void; isPending: boolean } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateStatus: { useMutation: (opts: any) => { mutate: (v: any) => void; isPending: boolean } };
};

const STATUS_META: Record<DeliveryStatus, { label: string; badgeClass: string }> = {
  preparing: { label: "待投递", badgeClass: "bg-slate-100 text-slate-700 border-slate-300" },
  submitted: { label: "已投递", badgeClass: "bg-blue-100 text-blue-700 border-blue-300" },
  under_review: { label: "审核中", badgeClass: "bg-amber-100 text-amber-700 border-amber-300" },
  accepted: { label: "已通过", badgeClass: "bg-green-100 text-green-700 border-green-300" },
  rejected: { label: "已驳回", badgeClass: "bg-red-100 text-red-700 border-red-300" },
};

function fmtDate(v: string | Date | null | undefined) {
  return v ? new Date(v).toLocaleString("zh-CN") : "";
}

export default function Deliveries() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const { data: stats } = deliveryApi.stats.useQuery();
  const { data: items, isLoading } = deliveryApi.list.useQuery();
  const { data: filings } = trpc.filing.list.useQuery();

  // 新建投递对话框
  const [createOpen, setCreateOpen] = useState(false);
  const [filingId, setFilingId] = useState("");
  const [channel, setChannel] = useState<Platform>("universal");
  const [deadlineDays, setDeadlineDays] = useState("15");
  const [note, setNote] = useState("");

  // 标记已投递对话框（可选回执编号）
  const [submitTarget, setSubmitTarget] = useState<DeliveryItem | null>(null);
  const [receiptNo, setReceiptNo] = useState("");

  // 驳回对话框（必填驳回原因）
  const [rejectTarget, setRejectTarget] = useState<DeliveryItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const invalidate = async () => {
    await utils.invalidate();
  };

  const create = deliveryApi.create.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("投递记录已创建，状态：待投递");
      setCreateOpen(false);
      setFilingId("");
      setChannel("universal");
      setDeadlineDays("15");
      setNote("");
    },
    onError: (e: { message?: string }) => toast.error(e.message || "创建失败"),
  });

  const updateStatus = deliveryApi.updateStatus.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("状态已更新");
      setSubmitTarget(null);
      setRejectTarget(null);
      setReceiptNo("");
      setRejectReason("");
    },
    onError: (e: { message?: string }) => toast.error(e.message || "状态更新失败"),
  });

  const submitCreate = () => {
    if (!filingId) return toast.error("请选择备案材料包");
    const days = parseInt(deadlineDays, 10);
    if (!Number.isInteger(days) || days < 1 || days > 90) return toast.error("请填写 1–90 天的有效时限");
    create.mutate({
      filingId: Number(filingId),
      channel,
      deadlineDays: days,
      note: note.trim() || undefined,
    });
  };

  const confirmSubmit = () => {
    if (!submitTarget) return;
    updateStatus.mutate({
      id: submitTarget.id,
      status: "submitted",
      receiptNo: receiptNo.trim() || undefined,
    });
  };

  const confirmReject = () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) return toast.error("请填写驳回原因");
    updateStatus.mutate({
      id: rejectTarget.id,
      status: "rejected",
      rejectReason: rejectReason.trim(),
    });
  };

  const statCards = [
    { label: "待投递", value: stats?.byStatus.preparing ?? 0, className: "" },
    {
      label: "审核中",
      value: (stats?.byStatus.submitted ?? 0) + (stats?.byStatus.under_review ?? 0),
      className: "",
    },
    { label: "已通过", value: stats?.byStatus.accepted ?? 0, className: "text-green-600" },
    { label: "已驳回", value: stats?.byStatus.rejected ?? 0, className: "text-amber-600" },
    { label: "超期预警", value: stats?.overdue ?? 0, className: "text-red-600" },
  ];

  const renderProgress = (d: DeliveryItem) => {
    if (d.status === "preparing") {
      return (
        <p className="text-xs text-muted-foreground">
          时限 {d.deadlineDays} 天，自投递之日起算
        </p>
      );
    }
    if (d.daysLeft === null) {
      return (
        <p className="text-xs text-muted-foreground">
          已完结{fmtDate(d.resolvedAt) ? `（${fmtDate(d.resolvedAt)}）` : ""}
        </p>
      );
    }
    const usedDays = d.deadlineDays - d.daysLeft;
    const pct = Math.min(100, Math.max(0, (usedDays / d.deadlineDays) * 100));
    return (
      <div className="space-y-1">
        <Progress
          value={d.overdue ? 100 : pct}
          className={d.overdue ? "[&>div]:bg-red-500" : ""}
        />
        {d.overdue ? (
          <p className="text-xs font-medium text-red-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> 已超期 {-d.daysLeft} 天（时限 {d.deadlineDays} 天）
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            已用 {usedDays} 天 / 共 {d.deadlineDays} 天 · 剩余 {d.daysLeft} 天
          </p>
        )}
      </div>
    );
  };

  return (
    <AuthLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">备案代办</h1>
            <p className="text-sm text-muted-foreground mt-1">
              聚合各平台备案通道的投递记录与时限管理，超期自动预警（不承诺备案结果）
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> 新建投递
          </Button>
        </div>

        {/* 统计条 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {statCards.map((s) => (
            <Card
              key={s.label}
              className={s.label === "超期预警" && s.value > 0 ? "border-red-300 bg-red-50" : ""}
            >
              <CardContent className="py-4 text-center">
                <div className={`text-2xl font-bold ${s.className}`}>{s.value}</div>
                <div
                  className={`text-xs mt-1 ${
                    s.label === "超期预警" ? "text-red-600 font-medium" : "text-muted-foreground"
                  }`}
                >
                  {s.label === "超期预警" ? (
                    <span className="inline-flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> {s.label}
                    </span>
                  ) : (
                    s.label
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 投递记录列表 */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : !items?.length ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Send className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>还没有投递记录</p>
              <p className="text-xs mt-1">请先在「备案材料」页生成材料包，再在此创建投递</p>
              <Button className="mt-4" variant="outline" onClick={() => navigate("/filing")}>
                前往备案材料
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {items.map((d) => (
              <Card key={d.id} className={d.overdue ? "border-red-300" : ""}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        《{d.workTitle}》
                        <Badge variant="outline" className={STATUS_META[d.status].badgeClass}>
                          {STATUS_META[d.status].label}
                        </Badge>
                        {d.overdue && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> 超期
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {PLATFORMS[d.channel as Platform]?.label ?? d.channel}
                        {d.receiptNo && ` · 回执编号：${d.receiptNo}`}
                        {d.submittedAt && ` · 提交时间：${fmtDate(d.submittedAt)}`}
                        {!d.submittedAt && ` · 创建于：${fmtDate(d.createdAt)}`}
                      </div>
                      {d.status === "rejected" && d.rejectReason && (
                        <p className="text-xs text-red-600 mt-1">驳回原因：{d.rejectReason}</p>
                      )}
                      {d.note && <p className="text-xs text-muted-foreground mt-1">备注：{d.note}</p>}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 shrink-0">
                      {d.status === "preparing" && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSubmitTarget(d);
                            setReceiptNo(d.receiptNo || "");
                          }}
                        >
                          <Send className="mr-1 h-3 w-3" /> 标记已投递
                        </Button>
                      )}
                      {d.status === "submitted" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: d.id, status: "under_review" })}
                        >
                          进入审核中
                        </Button>
                      )}
                      {d.status === "under_review" && (
                        <>
                          <Button
                            size="sm"
                            disabled={updateStatus.isPending}
                            onClick={() => updateStatus.mutate({ id: d.id, status: "accepted" })}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" /> 标记已通过
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={updateStatus.isPending}
                            onClick={() => {
                              setRejectTarget(d);
                              setRejectReason("");
                            }}
                          >
                            <XCircle className="mr-1 h-3 w-3" /> 标记已驳回
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {renderProgress(d)}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 新建投递对话框 */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建投递</DialogTitle>
              <DialogDescription>
                选择备案材料包与目标通道，系统将跟踪时限并在超期时预警
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>备案材料包 *</Label>
                {filings && filings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    暂无材料包，请先在「备案材料」页生成
                  </p>
                ) : (
                  <Select value={filingId} onValueChange={setFilingId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择材料包" />
                    </SelectTrigger>
                    <SelectContent>
                      {(filings ?? []).map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>
                          《{f.workTitle}》{f.tierResult ? ` · ${f.tierResult.tier}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>目标通道</Label>
                <Select value={channel} onValueChange={(v) => setChannel(v as Platform)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PLATFORMS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>时限天数（默认 15 天）</Label>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={deadlineDays}
                  onChange={(e) => setDeadlineDays(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>备注（可选）</Label>
                <Textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="如：对接人、通道入口说明等"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                取消
              </Button>
              <Button onClick={submitCreate} disabled={create.isPending || !filings?.length}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                创建投递记录
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 标记已投递对话框 */}
        <Dialog open={submitTarget !== null} onOpenChange={(o) => !o && setSubmitTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认投递</DialogTitle>
              <DialogDescription>
                确认《{submitTarget?.workTitle}》已投递至「
                {submitTarget ? (PLATFORMS[submitTarget.channel as Platform]?.label ?? submitTarget.channel) : ""}
                」，时限自此刻起算
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>投递回执编号（可选）</Label>
              <Input
                value={receiptNo}
                onChange={(e) => setReceiptNo(e.target.value)}
                placeholder="平台返回的受理/回执编号"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSubmitTarget(null)}>
                取消
              </Button>
              <Button onClick={confirmSubmit} disabled={updateStatus.isPending}>
                {updateStatus.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                确认已投递
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 驳回对话框 */}
        <Dialog open={rejectTarget !== null} onOpenChange={(o) => !o && setRejectTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>标记已驳回</DialogTitle>
              <DialogDescription>
                请填写《{rejectTarget?.workTitle}》的驳回原因。驳回原因将用于规则库校准
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>驳回原因 *</Label>
              <Textarea
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="请粘贴/概述平台或监管给出的驳回理由，越具体越有助于规则校准"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectTarget(null)}>
                取消
              </Button>
              <Button variant="destructive" onClick={confirmReject} disabled={updateStatus.isPending}>
                {updateStatus.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                确认驳回
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthLayout>
  );
}
