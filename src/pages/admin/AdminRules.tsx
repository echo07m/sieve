/**
 * 后台管理 · 规则库管理（建议路由 /admin/rules）
 * 全量底座规则（含停用）：类别/状态筛选 + 关键词搜索 + 启停开关 + 出处条文展开。
 * 数据接口：trpc.admin.rules / trpc.admin.setRuleStatus
 */
import { useMemo, useState } from "react";
import AuthLayout from "@/components/AuthLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { trpc, type RouterOutputs } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import { CATEGORIES, SEVERITIES, type CategoryKey } from "@contracts/constants";
import {
  ChevronDown,
  ChevronRight,
  History,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

type RuleVersionRow = RouterOutputs["admin"]["ruleVersions"][number];

type StatusFilter = "all" | "active" | "disabled";

const SOURCE_CONFIDENCE_LABELS: Record<string, string> = {
  official_text: "原文直引",
  vendor_interpretation: "企服解读",
};

function categoryMeta(category: string) {
  const meta = CATEGORIES[category as CategoryKey];
  return meta ?? { label: category, color: "#78716c" };
}

function severityMeta(severity: string) {
  const meta = SEVERITIES[severity as keyof typeof SEVERITIES];
  return meta ?? { label: severity, color: "#78716c" };
}

function ForbiddenCard() {
  return (
    <Card className="border-amber-300 bg-amber-50/60">
      <CardContent className="flex items-center gap-3 py-8">
        <ShieldAlert className="h-6 w-6 shrink-0 text-amber-600" />
        <div>
          <p className="font-medium text-amber-900">无权限访问</p>
          <p className="mt-1 text-sm text-amber-800/80">
            该页面仅对管理员开放，当前账号无权管理规则库。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminRules() {
  const utils = trpc.useUtils();
  const { data: rules, isLoading, error } = trpc.admin.rules.useQuery();

  const [category, setCategory] = useState<"all" | CategoryKey>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"rules" | "versions">("rules");

  const setRuleStatus = trpc.admin.setRuleStatus.useMutation({
    onSuccess: async (_res, vars) => {
      toast.success(
        vars.status === "active" ? `规则 ${vars.ruleCode} 已启用` : `规则 ${vars.ruleCode} 已停用`,
      );
      await utils.admin.rules.invalidate();
    },
    onError: (err) => toast.error(err.message || "状态更新失败"),
  });

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return (rules ?? []).filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (status !== "all" && r.status !== status) return false;
      if (kw && !r.name.toLowerCase().includes(kw) && !r.ruleCode.toLowerCase().includes(kw))
        return false;
      return true;
    });
  }, [rules, category, status, keyword]);

  const toggleExpand = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  return (
    <AuthLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">规则库管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              底座规则以监管原文为准，停用后新送检不再命中该规则
            </p>
          </div>
          <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-900">
            <ShieldCheck className="h-3.5 w-3.5" /> 仅管理员可见
          </Badge>
        </div>

        {error ? (
          <ForbiddenCard />
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "rules" | "versions")}>
            <TabsList>
              <TabsTrigger value="rules">规则列表</TabsTrigger>
              <TabsTrigger value="versions">
                <History className="mr-1.5 h-4 w-4" /> 版本历史
              </TabsTrigger>
            </TabsList>
            <TabsContent value="rules" className="mt-4">
          <>
            {/* 筛选栏 */}
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as "all" | CategoryKey)}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="违规类别" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类别</SelectItem>
                  {Object.entries(CATEGORIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">启用</SelectItem>
                  <SelectItem value="disabled">停用</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative min-w-56 flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="搜索规则名称 / ruleCode"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>
              {!isLoading && (
                <span className="text-sm text-muted-foreground">
                  共 {filtered.length} 条
                </span>
              )}
            </div>

            {/* 规则列表 */}
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                没有匹配的规则
              </div>
            ) : (
              <div className="divide-y rounded-lg border">
                {filtered.map((r) => {
                  const cat = categoryMeta(r.category);
                  const sev = severityMeta(r.severity);
                  const isExpanded = expanded.has(r.ruleCode);
                  const isActive = r.status === "active";
                  return (
                    <div key={r.ruleCode}>
                      {/* 行摘要 */}
                      <div
                        className={cn(
                          "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3",
                          !isActive && "opacity-60",
                        )}
                      >
                        <button
                          type="button"
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          onClick={() => toggleExpand(r.ruleCode)}
                          aria-label={isExpanded ? "收起" : "展开"}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <Badge
                          className="shrink-0 text-white"
                          style={{ background: sev.color }}
                        >
                          {sev.label}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{r.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {r.ruleCode} · v{r.version}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ background: cat.color }}
                              />
                              {cat.label}
                            </span>
                            <span>关键词 {r.keywords?.length ?? 0}</span>
                            <span>正则 {r.patterns?.length ?? 0}</span>
                            <span>共现 {r.cooccurrence?.length ?? 0}</span>
                          </div>
                        </div>
                        <div
                          className="flex shrink-0 items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-xs text-muted-foreground">
                            {isActive ? "启用" : "停用"}
                          </span>
                          <Switch
                            checked={isActive}
                            disabled={setRuleStatus.isPending}
                            onCheckedChange={(checked) =>
                              setRuleStatus.mutate({
                                ruleCode: r.ruleCode,
                                status: checked ? "active" : "disabled",
                              })
                            }
                          />
                        </div>
                      </div>

                      {/* 展开详情 */}
                      {isExpanded && (
                        <div className="space-y-4 border-t bg-stone-50/60 px-4 py-4 text-sm dark:bg-stone-900/40">
                          <div>
                            <div className="mb-1 text-xs font-medium text-muted-foreground">
                              出处条文
                            </div>
                            <p className="text-muted-foreground">
                              {r.sourcePolicy} ｜ {r.sourceClause}
                            </p>
                            <p className="mt-1 leading-relaxed">{r.originalText}</p>
                            {r.sourceConfidence === "vendor_interpretation" && (
                              <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/40">
                                <ShieldAlert className="h-3.5 w-3.5" />
                                企服解读，以广电原文为准
                              </p>
                            )}
                            {r.sourceConfidence !== "vendor_interpretation" && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                来源置信度：
                                {SOURCE_CONFIDENCE_LABELS[r.sourceConfidence] ??
                                  r.sourceConfidence}
                              </p>
                            )}
                          </div>
                          <div>
                            <div className="mb-1 text-xs font-medium text-muted-foreground">
                              整改模板
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed">
                              {r.remediationTemplate}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
            </TabsContent>
            <TabsContent value="versions" className="mt-4">
              <RuleVersionsPanel />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AuthLayout>
  );
}

/** 规则版本历史：发布快照 + 回滚 */
function RuleVersionsPanel() {
  const utils = trpc.useUtils();
  const { data: versions, isLoading } = trpc.admin.ruleVersions.useQuery();

  const [publishOpen, setPublishOpen] = useState(false);
  const [versionInput, setVersionInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [rollbackTarget, setRollbackTarget] = useState<RuleVersionRow | null>(null);

  const publish = trpc.admin.publishRuleVersion.useMutation({
    onSuccess: async (res) => {
      toast.success(`版本已发布（快照存档 ${res.ruleCount} 条规则）`);
      setPublishOpen(false);
      setVersionInput("");
      setNoteInput("");
      await utils.admin.ruleVersions.invalidate();
    },
    onError: (err) => toast.error(err.message || "发布失败"),
  });

  const rollback = trpc.admin.rollbackRuleVersion.useMutation({
    onSuccess: async (res) => {
      toast.success(`已回滚，恢复 ${res.restored} 条规则`);
      setRollbackTarget(null);
      await utils.admin.ruleVersions.invalidate();
      await utils.admin.rules.invalidate();
    },
    onError: (err) => toast.error(err.message || "回滚失败"),
  });

  const submitPublish = () => {
    const version = versionInput.trim();
    if (!version) return toast.error("请填写版本号");
    publish.mutate({ version, note: noteInput.trim() || undefined });
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">规则版本历史</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              发布版本将当前规则全量快照存档；回滚以快照覆盖当前全部规则
            </p>
          </div>
          <Button onClick={() => setPublishOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> 发布新版本
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !versions?.length ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            暂无历史版本，点击「发布新版本」创建首个快照
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>版本号</TableHead>
                <TableHead>规则数</TableHead>
                <TableHead>说明</TableHead>
                <TableHead>发布时间</TableHead>
                <TableHead>快照</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono font-medium">{v.version}</TableCell>
                  <TableCell>{v.ruleCount}</TableCell>
                  <TableCell className="max-w-72">
                    <span className="line-clamp-2 text-sm text-muted-foreground">
                      {v.note || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(v.createdAt).toLocaleString("zh-CN")}
                  </TableCell>
                  <TableCell>
                    {v.hasSnapshot ? (
                      <Badge variant="secondary">有快照</Badge>
                    ) : (
                      <Badge variant="outline">无快照</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {v.hasSnapshot ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRollbackTarget(v)}
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> 回滚到此版
                      </Button>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button variant="outline" size="sm" disabled>
                                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> 回滚到此版
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>该版本无快照</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* 发布新版本 */}
        <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>发布规则新版本</DialogTitle>
              <DialogDescription>
                将当前规则全量快照存档，作为后续回滚的还原点。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rule-version">版本号 *</Label>
                <Input
                  id="rule-version"
                  placeholder="如 v1.3.0"
                  value={versionInput}
                  onChange={(e) => setVersionInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  仅限数字/字母/./-/_，且不可与已有版本重复
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-version-note">说明</Label>
                <Textarea
                  id="rule-version-note"
                  rows={3}
                  placeholder="本次规则调整要点（选填）"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPublishOpen(false)}>
                取消
              </Button>
              <Button onClick={submitPublish} disabled={publish.isPending}>
                {publish.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                确认发布
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 回滚确认 */}
        <AlertDialog
          open={rollbackTarget != null}
          onOpenChange={(open) => {
            if (!open) setRollbackTarget(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                确认回滚到版本 {rollbackTarget?.version}？
              </AlertDialogTitle>
              <AlertDialogDescription>
                回滚将以快照覆盖当前全部规则，快照外规则将被停用。该操作立即生效，请确认已完成规则核对。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                disabled={rollback.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  if (rollbackTarget) rollback.mutate({ versionId: rollbackTarget.id });
                }}
              >
                {rollback.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                确认回滚
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
