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
import { trpc } from "@/providers/trpc";
import { Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type CaseType = "platform_action" | "judicial" | "regulatory" | "rights_protection";

const TYPE_LABELS: Record<CaseType, string> = {
  platform_action: "平台处置",
  judicial: "司法判例",
  regulatory: "监管通报",
  rights_protection: "维权事件",
};

type FormState = {
  title: string;
  platform: string;
  caseType: CaseType;
  summary: string;
  violation: string;
  outcome: string;
  source: string;
  sourceUrl: string;
  relatedRuleCodes: string; // 逗号分隔
  occurredAt: string; // YYYY-MM-DD
};

const EMPTY_FORM: FormState = {
  title: "",
  platform: "",
  caseType: "platform_action",
  summary: "",
  violation: "",
  outcome: "",
  source: "",
  sourceUrl: "",
  relatedRuleCodes: "",
  occurredAt: "",
};

function toPayload(f: FormState) {
  return {
    title: f.title.trim(),
    platform: f.platform.trim(),
    caseType: f.caseType,
    summary: f.summary.trim(),
    violation: f.violation.trim(),
    outcome: f.outcome.trim(),
    source: f.source.trim(),
    sourceUrl: f.sourceUrl.trim(),
    relatedRuleCodes: f.relatedRuleCodes
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10),
    occurredAt: f.occurredAt ? new Date(f.occurredAt) : null,
    isActive: true,
  };
}

/** 后台 · 判例库维护：新增/编辑/删除平台处置与司法判例 */
export default function AdminCases() {
  const utils = trpc.useUtils();
  const list = trpc.precedents.adminList.useQuery();
  const [editing, setEditing] = useState<number | null>(null); // id 或 -1 新建
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const invalidate = () => utils.precedents.adminList.invalidate();
  const create = trpc.precedents.create.useMutation({
    onSuccess: () => {
      toast.success("判例已新增");
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.precedents.update.useMutation({
    onSuccess: () => {
      toast.success("判例已更新");
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.precedents.remove.useMutation({
    onSuccess: () => {
      toast.success("判例已删除");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const openEdit = (id: number) => {
    const c = list.data?.find((x) => x.id === id);
    if (!c) return;
    setForm({
      title: c.title,
      platform: c.platform,
      caseType: c.caseType,
      summary: c.summary,
      violation: c.violation,
      outcome: c.outcome,
      source: c.source,
      sourceUrl: c.sourceUrl,
      relatedRuleCodes: c.relatedRuleCodes.join(", "),
      occurredAt: c.occurredAt
        ? new Date(c.occurredAt).toISOString().slice(0, 10)
        : "",
    });
    setEditing(id);
  };

  const submit = () => {
    const payload = toPayload(form);
    if (!payload.title || payload.summary.length < 10) {
      toast.error("请填写标题与不少于 10 字的案例摘要");
      return;
    }
    if (editing === -1) create.mutate(payload);
    else if (editing) update.mutate({ id: editing, data: payload });
  };

  const set = (k: keyof FormState) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <AuthLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-amber-800" />
              判例库管理（{list.data?.length ?? 0}）
            </CardTitle>
            <Button
              size="sm"
              className="bg-amber-800 hover:bg-amber-900 text-white"
              onClick={() => {
                setForm(EMPTY_FORM);
                setEditing(-1);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> 新增判例
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(list.data ?? []).map((c) => (
              <div
                key={c.id}
                className="border border-stone-200 rounded-lg p-4 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">{c.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABELS[c.caseType]}
                    </Badge>
                    {c.platform && (
                      <span className="text-xs text-muted-foreground">{c.platform}</span>
                    )}
                    {!c.isActive && <Badge variant="secondary">已下架</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {c.summary}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    关联规则：{c.relatedRuleCodes.join("、") || "—"}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(c.id)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-red-600"
                    onClick={() => {
                      if (window.confirm(`确认删除判例「${c.title}」？`)) {
                        remove.mutate({ id: c.id });
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing === -1 ? "新增判例" : "编辑判例"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="案例标题" value={form.title} onChange={(e) => set("title")(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="平台（红果/抖音/司法…）" value={form.platform} onChange={(e) => set("platform")(e.target.value)} />
                <Select value={form.caseType} onValueChange={(v) => set("caseType")(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea placeholder="案例摘要（不少于 10 字）" rows={4} value={form.summary} onChange={(e) => set("summary")(e.target.value)} />
              <Input placeholder="违规点概述" value={form.violation} onChange={(e) => set("violation")(e.target.value)} />
              <Input placeholder="处置结果" value={form.outcome} onChange={(e) => set("outcome")(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="来源名称" value={form.source} onChange={(e) => set("source")(e.target.value)} />
                <Input placeholder="来源链接 https://…" value={form.sourceUrl} onChange={(e) => set("sourceUrl")(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="关联规则 code，逗号分隔" value={form.relatedRuleCodes} onChange={(e) => set("relatedRuleCodes")(e.target.value)} />
                <Input type="date" value={form.occurredAt} onChange={(e) => set("occurredAt")(e.target.value)} />
              </div>
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
      </div>
    </AuthLayout>
  );
}
