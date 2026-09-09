import { useState } from "react";
import AuthLayout from "@/components/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import { PLANS, PLAN_ORDER, type PlanCode } from "@contracts/constants";
import { ArrowRightLeft, ShieldAlert, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

type LeadStatus = "new" | "contacted" | "converted";

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "新线索",
  contacted: "已联系",
  converted: "已转化",
};

const SOURCE_LABELS: Record<string, string> = {
  pricing: "定价页",
  paywall: "配额弹窗",
  docs: "文档页",
  api: "API 页",
};

function formatTime(d: Date | string) {
  return new Date(d).toLocaleString("zh-CN", { hour12: false });
}

function planLabel(code: string) {
  return (PLANS as Record<string, { name: string }>)[code]?.name ?? code ?? "—";
}

/** 无权限（如 403）警示卡片 */
function ForbiddenCard() {
  return (
    <Card className="border-amber-700/40 bg-amber-50/50">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <ShieldAlert className="h-10 w-10 text-amber-800" />
        <p className="font-medium">无权限访问：该页面仅管理员可见</p>
        <p className="text-sm text-muted-foreground">
          如需访问线索与方案管理，请联系管理员开通权限。
        </p>
        <Button asChild variant="outline" className="mt-2">
          <Link to="/dashboard">返回工作台</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

type ConvertLead = {
  id: number;
  name: string;
  planInterest: string | null;
};

/** 线索转订单对话框 */
function ConvertLeadDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: ConvertLead | null;
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
  const [lastLeadId, setLastLeadId] = useState<number | null>(null);

  // 打开新线索时按意向方案预填表单
  if (lead && lead.id !== lastLeadId) {
    setLastLeadId(lead.id);
    setPlanCode(
      lead.planInterest && (PLAN_ORDER as string[]).includes(lead.planInterest)
        ? (lead.planInterest as PlanCode)
        : "team",
    );
    setUserId("");
    setAmount("");
    setContractNo("");
    setNote("");
  }

  const updateStatus = trpc.leads.updateStatus.useMutation();
  const create = trpc.orders.create.useMutation({
    onSuccess: async (res) => {
      toast.success(`已生成订单 ${res.orderNo}`);
      if (lead) {
        try {
          await updateStatus.mutateAsync({
            id: lead.id,
            status: "converted" as LeadStatus,
          });
        } catch {
          toast.error("订单已生成，但线索状态更新失败");
        }
      }
      onOpenChange(false);
      await Promise.all([
        utils.orders.list.invalidate(),
        utils.leads.list.invalidate(),
      ]);
    },
    onError: (err) => toast.error(err.message || "订单创建失败"),
  });

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
          <DialogTitle>线索转订单</DialogTitle>
          <DialogDescription>
            将线索「{lead?.name}」转化为订单，成功后该线索将标记为「已转化」
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>客户</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="选择客户（必选）" />
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
            <Label>方案（已按意向方案预填，可修改）</Label>
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
              placeholder="选填"
              maxLength={255}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending ? "提交中…" : "生成订单"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 销售线索 Tab */
function LeadsTab() {
  const utils = trpc.useUtils();
  const { data: leads, isLoading, error } = trpc.leads.list.useQuery();
  const [convertTarget, setConvertTarget] = useState<ConvertLead | null>(null);
  const updateStatus = trpc.leads.updateStatus.useMutation({
    onSuccess: () => utils.leads.list.invalidate(),
    onError: (err) => toast.error(err.message || "状态更新失败"),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return <ForbiddenCard />;
  }

  if (!leads || leads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        暂无销售线索。留资表单提交的线索会显示在这里。
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">时间</TableHead>
            <TableHead>称呼</TableHead>
            <TableHead>公司</TableHead>
            <TableHead>联系方式</TableHead>
            <TableHead>意向方案</TableHead>
            <TableHead>来源</TableHead>
            <TableHead className="max-w-56">留言</TableHead>
            <TableHead className="w-56">状态 / 操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatTime(lead.createdAt)}
              </TableCell>
              <TableCell className="font-medium">{lead.name}</TableCell>
              <TableCell>{lead.company || "—"}</TableCell>
              <TableCell>{lead.contact}</TableCell>
              <TableCell>{lead.planInterest ? planLabel(lead.planInterest) : "—"}</TableCell>
              <TableCell>{SOURCE_LABELS[lead.source] ?? lead.source}</TableCell>
              <TableCell className="max-w-56 truncate text-muted-foreground">
                {lead.message || "—"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Select
                    value={lead.status}
                    onValueChange={(v) =>
                      updateStatus.mutate({ id: lead.id, status: v as LeadStatus })
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {lead.status !== "converted" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 whitespace-nowrap"
                      onClick={() =>
                        setConvertTarget({
                          id: lead.id,
                          name: lead.name,
                          planInterest: lead.planInterest,
                        })
                      }
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" /> 转为订单
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ConvertLeadDialog
        lead={convertTarget}
        open={!!convertTarget}
        onOpenChange={(open) => !open && setConvertTarget(null)}
      />
    </div>
  );
}

/** 方案激活 Tab */
function ActivateTab() {
  const utils = trpc.useUtils();
  const { data: users, isLoading, error } = trpc.billing.users.useQuery();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [planCode, setPlanCode] = useState<PlanCode>("team");
  const [note, setNote] = useState("");

  const activate = trpc.billing.activate.useMutation({
    onSuccess: async () => {
      toast.success("方案已开通");
      setNote("");
      await Promise.all([
        utils.billing.users.invalidate(),
        utils.billing.myPlan.invalidate(),
      ]);
    },
    onError: (err) => toast.error(err.message || "开通失败"),
  });

  const selectedUser = users?.find((u) => u.id === selectedUserId) ?? null;

  const handleActivate = () => {
    if (!selectedUserId) {
      return toast.error("请先在左侧选择用户");
    }
    activate.mutate({
      userId: selectedUserId,
      planCode,
      note: note.trim() || undefined,
    });
  };

  if (error) {
    return <ForbiddenCard />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        留资转化后在此为用户开通付费方案
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {/* 用户列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">选择用户</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !users || users.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无用户</p>
            ) : (
              <div className="max-h-96 space-y-1 overflow-y-auto pr-1">
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUserId(u.id)}
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      selectedUserId === u.id
                        ? "border-amber-700/50 bg-amber-50/60"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{u.name || "未命名用户"}</span>
                      {u.role === "admin" && (
                        <Badge variant="secondary">管理员</Badge>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {u.email || "—"} · 注册于 {formatTime(u.createdAt)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 激活表单 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">开通 / 调整方案</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>选中用户</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {selectedUser
                  ? `${selectedUser.name || "未命名用户"}（${selectedUser.email || `ID ${selectedUser.id}`}）`
                  : "尚未选择用户"}
              </div>
            </div>
            <div className="space-y-2">
              <Label>方案</Label>
              <Select value={planCode} onValueChange={(v) => setPlanCode(v as PlanCode)}>
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
            <Button
              className="w-full"
              onClick={handleActivate}
              disabled={activate.isPending || !selectedUserId}
            >
              确认开通
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** 管理员线索管理页 */
export default function LeadsAdmin() {
  return (
    <AuthLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">线索与方案管理</h1>
            <p className="text-sm text-muted-foreground mt-1">
              跟进留资线索，并为已转化用户开通付费方案
            </p>
          </div>
          <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-900">
            <ShieldCheck className="h-3.5 w-3.5" /> 仅管理员可见
          </Badge>
        </div>

        <Tabs defaultValue="leads">
          <TabsList>
            <TabsTrigger value="leads">销售线索</TabsTrigger>
            <TabsTrigger value="activate">方案激活</TabsTrigger>
          </TabsList>
          <TabsContent value="leads" className="mt-4">
            <LeadsTab />
          </TabsContent>
          <TabsContent value="activate" className="mt-4">
            <ActivateTab />
          </TabsContent>
        </Tabs>
      </div>
    </AuthLayout>
  );
}
