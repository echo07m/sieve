import AuthLayout from "@/components/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES } from "@contracts/constants";
import { trpc } from "@/providers/trpc";
import { FilePlus2, Plus, Radar, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Category = keyof typeof CATEGORIES;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "待评估", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  reviewed: { label: "已评估", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  converted: { label: "已转规则", cls: "bg-green-100 text-green-700 border-green-200" },
};

type FormState = {
  title: string;
  source: string;
  sourceUrl: string;
  publishedAt: string;
  summary: string;
  impactAssessment: string;
  relatedRuleCodes: string;
};

const EMPTY: FormState = {
  title: "",
  source: "",
  sourceUrl: "",
  publishedAt: "",
  summary: "",
  impactAssessment: "",
  relatedRuleCodes: "",
};

/** 后台 · 政策雷达：新规动态录入 → 影响评估 → 一键转规则草稿 */
export default function AdminPolicy() {
  const utils = trpc.useUtils();
  const list = trpc.policy.list.useQuery();
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [convertId, setConvertId] = useState<number | null>(null);
  const [category, setCategory] = useState<Category>("ip_infringement");
  const [severity, setSeverity] = useState<"block" | "high" | "notice">("notice");

  const invalidate = () => utils.policy.list.invalidate();
  const create = trpc.policy.create.useMutation({
    onSuccess: () => { toast.success("已录入"); setEditing(null); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.policy.update.useMutation({
    onSuccess: () => { toast.success("已保存"); setEditing(null); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.policy.remove.useMutation({
    onSuccess: () => { toast.success("已删除"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const convert = trpc.policy.convertToRuleDraft.useMutation({
    onSuccess: (r) => {
      toast.success(`已生成规则草稿 ${r.ruleCode}（默认停用，请在规则管理中完善后发布）`);
      setConvertId(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openEdit = (id: number) => {
    const p = list.data?.find((x) => x.id === id);
    if (!p) return;
    setForm({
      title: p.title,
      source: p.source,
      sourceUrl: p.sourceUrl,
      publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString().slice(0, 10) : "",
      summary: p.summary,
      impactAssessment: p.impactAssessment,
      relatedRuleCodes: p.relatedRuleCodes.join(", "),
    });
    setEditing(id);
  };

  const submit = () => {
    const payload = {
      title: form.title.trim(),
      source: form.source.trim(),
      sourceUrl: form.sourceUrl.trim(),
      publishedAt: form.publishedAt ? new Date(form.publishedAt) : null,
      summary: form.summary.trim(),
      impactAssessment: form.impactAssessment.trim(),
      relatedRuleCodes: form.relatedRuleCodes
        .split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean).slice(0, 10),
    };
    if (!payload.title || payload.summary.length < 10) {
      toast.error("请填写标题与不少于 10 字的摘要");
      return;
    }
    if (editing === -1) create.mutate(payload);
    else if (editing) update.mutate({ id: editing, data: payload });
  };

  const markReviewed = (id: number) =>
    update.mutate({ id, data: {}, status: "reviewed" });

  return (
    <AuthLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-amber-800" />
              政策雷达（{list.data?.length ?? 0}）
            </CardTitle>
            <Button
              size="sm"
              className="bg-amber-800 hover:bg-amber-900 text-white"
              onClick={() => { setForm(EMPTY); setEditing(-1); }}
            >
              <Plus className="h-4 w-4 mr-1" /> 录入动态
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(list.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                暂无政策动态。建议监控渠道：广电总局公告页、中国网络视听节目服务协会、各平台规则中心、短剧行业周报。
              </p>
            )}
            {(list.data ?? []).map((p) => {
              const meta = STATUS_META[p.status];
              return (
                <div key={p.id} className="border border-stone-200 rounded-lg p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">{p.title}</span>
                    <Badge variant="outline" className={`text-xs ${meta.cls}`}>{meta.label}</Badge>
                    {p.source && <span className="text-xs text-muted-foreground">{p.source}</span>}
                    {p.publishedAt && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(p.publishedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{p.summary}</p>
                  {p.impactAssessment && (
                    <p className="text-xs text-muted-foreground mt-2">
                      <span className="font-medium text-slate-600">影响评估：</span>
                      {p.impactAssessment}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {p.relatedRuleCodes.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        受影响规则：{p.relatedRuleCodes.join("、")}
                      </span>
                    )}
                    {p.draftRuleCode && (
                      <Badge variant="outline" className="text-xs">草稿 {p.draftRuleCode}</Badge>
                    )}
                    <div className="ml-auto flex gap-1.5">
                      {p.status === "pending" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markReviewed(p.id)}>
                          标记已评估
                        </Button>
                      )}
                      {p.status !== "converted" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-amber-300 text-amber-800"
                          onClick={() => setConvertId(p.id)}
                        >
                          <FilePlus2 className="h-3 w-3 mr-1" /> 转规则草稿
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(p.id)}>
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-red-600"
                        onClick={() => {
                          if (window.confirm(`确认删除「${p.title}」？`)) remove.mutate({ id: p.id });
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 录入/编辑对话框 */}
        <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing === -1 ? "录入政策动态" : "编辑政策动态"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="标题（如：广电总局关于加强微短剧片名审核的通知）" value={form.title} onChange={(e) => set("title")(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="来源（广电总局/红果公告…）" value={form.source} onChange={(e) => set("source")(e.target.value)} />
                <Input type="date" value={form.publishedAt} onChange={(e) => set("publishedAt")(e.target.value)} />
              </div>
              <Input placeholder="来源链接 https://…" value={form.sourceUrl} onChange={(e) => set("sourceUrl")(e.target.value)} />
              <Textarea placeholder="政策要点摘要（不少于 10 字）" rows={4} value={form.summary} onChange={(e) => set("summary")(e.target.value)} />
              <Textarea placeholder="影响评估：对现有规则库哪些条目有影响、需要新增/调整什么口径" rows={3} value={form.impactAssessment} onChange={(e) => set("impactAssessment")(e.target.value)} />
              <Input placeholder="受影响规则 code，逗号分隔（可留空）" value={form.relatedRuleCodes} onChange={(e) => set("relatedRuleCodes")(e.target.value)} />
              <Button
                className="w-full bg-amber-800 hover:bg-amber-900 text-white"
                disabled={create.isPending || update.isPending}
                onClick={submit}
              >
                保存
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* 转规则草稿对话框 */}
        <Dialog open={convertId !== null} onOpenChange={(o) => !o && setConvertId(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>转为规则草稿</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                将生成一条 <b>默认停用</b> 的规则（code 形如 PX-2026-001），关键词/正则留空，
                请在「规则管理」中完善后随版本发布生效。
              </p>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger><SelectValue placeholder="违规类别" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
                <SelectTrigger><SelectValue placeholder="严重级" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="block">拦截级</SelectItem>
                  <SelectItem value="high">高风险</SelectItem>
                  <SelectItem value="notice">提示级</SelectItem>
                </SelectContent>
              </Select>
              <Button
                className="w-full bg-amber-800 hover:bg-amber-900 text-white"
                disabled={convert.isPending}
                onClick={() => convertId && convert.mutate({ id: convertId, category, severity })}
              >
                生成草稿
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AuthLayout>
  );
}
