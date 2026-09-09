import AuthLayout from "@/components/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CATEGORIES, PLATFORMS, SEVERITIES, VERDICTS, WORK_TYPES } from "@contracts/constants";
import { trpc, type RouterOutputs } from "@/providers/trpc";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  FileCode2,
  FileDown,
  FileJson,
  FileText,
  Fingerprint,
  GitCompareArrows,
  Landmark,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const submissionId = Number(id);
  const [sevFilter, setSevFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [viewPlatform, setViewPlatform] = useState<string>("origin");
  const { data, isLoading } = trpc.submissions.detail.useQuery(
    {
      id: submissionId,
      viewPlatform: viewPlatform === "origin" ? undefined : viewPlatform,
    },
    { enabled: Number.isFinite(submissionId) },
  );

  const review = trpc.submissions.reviewHit.useMutation({
    onSuccess: () => utils.submissions.detail.invalidate({ id: submissionId }),
    onError: () => toast.error("操作失败"),
  });

  /** 导出 Word 报告（服务端生成 .docx，base64 返回） */
  const exportWord = trpc.submissions.exportWord.useMutation({
    onSuccess: (res) => {
      const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Word 报告已导出");
    },
    onError: (e) => toast.error(e.message || "导出失败"),
  });

  /** 导出工具链标准格式（SARIF/JUnit，base64 文本返回） */
  const downloadBase64Text = (res: { filename: string; base64: string }, mime: string, label: string) => {
    const blob = new Blob([atob(res.base64)], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${label} 已导出`);
  };
  const exportSarif = trpc.submissions.exportSarif.useMutation({
    onSuccess: (res) => downloadBase64Text(res, "application/sarif+json", "SARIF 报告"),
    onError: (e) => toast.error(e.message || "导出失败"),
  });
  const exportJunit = trpc.submissions.exportJunit.useMutation({
    onSuccess: (res) => downloadBase64Text(res, "application/xml", "JUnit 报告"),
    onError: (e) => toast.error(e.message || "导出失败"),
  });

  const hits = useMemo(() => {
    const all = data?.hits ?? [];
    return all.filter(
      (h) =>
        (sevFilter === "all" || h.severity === sevFilter) &&
        (catFilter === "all" || h.category === catFilter),
    );
  }, [data?.hits, sevFilter, catFilter]);

  /** 整改助手：当前选中的命中 */
  const [assistHit, setAssistHit] = useState<{ id: number } | null>(null);
  const remediate = trpc.remediate.suggest.useMutation({
    onError: (e) => toast.error(e.message || "获取整改建议失败"),
  });

  /** 判例佐证：按本报告命中的全部规则 code 拉取相关判例 */
  const ruleCodes = useMemo(
    () => Array.from(new Set((data?.hits ?? []).map((h) => h.ruleCode))).slice(0, 20),
    [data?.hits],
  );
  const precedents = trpc.precedents.byRuleCodes.useQuery(
    { codes: ruleCodes },
    { enabled: ruleCodes.length > 0 },
  );

  if (isLoading) {
    return (
      <AuthLayout>
        <div className="p-6 max-w-5xl mx-auto space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AuthLayout>
    );
  }

  if (!data) {
    return (
      <AuthLayout>
        <div className="p-6 text-center text-muted-foreground">送检记录不存在</div>
      </AuthLayout>
    );
  }

  const { submission, report } = data;
  const verdict = data.viewVerdict ?? submission.verdict ?? report?.verdict;
  const viewingOther = data.viewPlatform && data.viewPlatform !== submission.targetPlatform;
  const VerdictIcon =
    verdict === "high_risk" ? ShieldAlert : verdict === "attention" ? AlertTriangle : ShieldCheck;

  return (
    <AuthLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6 print:p-2">
        {/* 头部 */}
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" onClick={() => navigate("/submissions")}>
            <ChevronLeft className="mr-1 h-4 w-4" /> 返回列表
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/submit?recheck=${submissionId}`)}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> 整改后复诊
            </Button>
            <Select value={viewPlatform} onValueChange={setViewPlatform}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="origin">送检口径（原始）</SelectItem>
                {Object.entries(PLATFORMS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>以「{v.label}」口径查看</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => window.print()}>
              <FileDown className="mr-2 h-4 w-4" /> 导出 PDF（打印另存）
            </Button>
            <Button
              variant="outline"
              disabled={exportWord.isPending || !report}
              onClick={() => exportWord.mutate({ id: submissionId })}
            >
              {exportWord.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              {exportWord.isPending ? "导出中…" : "导出 Word"}
            </Button>
            <Button
              variant="outline"
              disabled={exportSarif.isPending || !report}
              title="静态分析标准格式，可上传 GitHub Code Scanning"
              onClick={() => exportSarif.mutate({ id: submissionId })}
            >
              <FileJson className="mr-2 h-4 w-4" /> SARIF
            </Button>
            <Button
              variant="outline"
              disabled={exportJunit.isPending || !report}
              title="CI 测试报告标准格式，可被 Jenkins/GitLab CI 解析"
              onClick={() => exportJunit.mutate({ id: submissionId })}
            >
              <FileCode2 className="mr-2 h-4 w-4" /> JUnit
            </Button>
          </div>
        </div>

        {viewingOther && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            当前以「{PLATFORMS[data.viewPlatform as keyof typeof PLATFORMS]?.label}」平台差分口径查看严重级，仅用于评估口径差异；存证报告以送检时口径（
            {PLATFORMS[submission.targetPlatform as keyof typeof PLATFORMS]?.label}）为准。
          </div>
        )}

        {/* 结论横幅 */}
        <Card
          className="border-2"
          style={{ borderColor: verdict ? VERDICTS[verdict].color : undefined }}
        >
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <VerdictIcon
                className="h-10 w-10 shrink-0"
                style={{ color: verdict ? VERDICTS[verdict].color : undefined }}
              />
              <div className="flex-1">
                <h1 className="text-xl font-bold">
                  《{submission.workTitle}》上线前合规预检报告
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {WORK_TYPES[submission.workType].label} · {submission.episodeCount} 集 ·{" "}
                  {PLATFORMS[submission.targetPlatform as keyof typeof PLATFORMS]?.label ??
                    submission.targetPlatform}{" "}
                  · 送检时间 {new Date(submission.createdAt).toLocaleString("zh-CN")}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {verdict && (
                    <Badge
                      className="text-white text-sm px-3 py-1"
                      style={{ background: VERDICTS[verdict].color }}
                    >
                      {VERDICTS[verdict].label}
                    </Badge>
                  )}
                  {report && (
                    <>
                      <Badge variant="outline">阻断 {report.summary.blockCount}</Badge>
                      <Badge variant="outline">高危 {report.summary.highCount}</Badge>
                      <Badge variant="outline">提示 {report.summary.noticeCount}</Badge>
                      <span className="text-xs text-muted-foreground">
                        涉及 {report.summary.affectedEpisodes}/{report.summary.episodeCount} 集
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <Separator className="my-4" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {report?.disclaimer ??
                "本报告为上线前合规预检参考，不构成过审保证，最终以平台/监管审核为准。"}
            </p>
          </CardContent>
        </Card>

        {/* 存证信息 */}
        {report && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Fingerprint className="h-4 w-4" /> 留痕存证
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">报告编号：</span>
                <span className="font-mono">{report.reportNo}</span>
              </div>
              <div>
                <span className="text-muted-foreground">规则库版本：</span>
                <span className="font-mono">{report.ruleVersion}</span>
              </div>
              <div>
                <span className="text-muted-foreground">生成时间戳：</span>
                <span className="font-mono">
                  {new Date(report.generatedAt).toLocaleString("zh-CN")}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">内容哈希（SHA-256）：</span>
                <span className="font-mono text-xs break-all">{report.contentHash}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 命中清单 */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-lg">逐集风险清单（{hits.length} 条）</CardTitle>
              <div className="flex gap-2 print:hidden">
                <Select value={sevFilter} onValueChange={setSevFilter}>
                  <SelectTrigger className="w-28"><SelectValue placeholder="严重级" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部级别</SelectItem>
                    {Object.entries(SEVERITIES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={catFilter} onValueChange={setCatFilter}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="违规类别" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类别</SelectItem>
                    {Object.entries(CATEGORIES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {hits.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-600" />
                当前筛选下无命中项
              </div>
            ) : (
              hits.map((h) => (
                <div key={h.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className="text-white"
                      style={{ background: SEVERITIES[h.severity].color }}
                    >
                      {SEVERITIES[h.severity].label}
                    </Badge>
                    <Badge
                      variant="outline"
                      style={{
                        color: CATEGORIES[h.category].color,
                        borderColor: CATEGORIES[h.category].color,
                      }}
                    >
                      {CATEGORIES[h.category].label}
                    </Badge>
                    <span className="text-sm font-medium">{h.ruleName}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {h.location} · 置信度 {(Number(h.confidence) * 100).toFixed(0)}%
                      {h.matchSource === "llm" && " · LLM语义召回"}
                    </span>
                  </div>
                  <blockquote className="border-l-2 pl-3 text-sm text-slate-700 bg-slate-50 py-2 rounded-r">
                    {h.spanText}
                  </blockquote>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-medium text-slate-600">依据条文：</span>
                    {h.basis}
                    {h.sourceConfidence === "vendor_interpretation" && (
                      <span className="text-amber-600 font-medium">
                        （企服解读口径，以广电原文为准）
                      </span>
                    )}
                  </div>
                  <div className="text-sm leading-relaxed">
                    <span className="font-medium">整改建议：</span>
                    {h.remediation}
                  </div>
                  <div className="flex items-center gap-2 print:hidden">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-50"
                      onClick={() => {
                        setAssistHit({ id: h.id });
                        remediate.mutate({ hitId: h.id });
                      }}
                    >
                      <Wand2 className="h-3 w-3 mr-1" /> 整改助手
                    </Button>
                    {h.reviewStatus === "open" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => review.mutate({ hitId: h.id, status: "accepted" })}
                        >
                          采纳建议
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => review.mutate({ hitId: h.id, status: "dismissed" })}
                        >
                          不采纳
                        </Button>
                      </>
                    ) : (
                      <Badge variant={h.reviewStatus === "accepted" ? "default" : "secondary"}>
                        {h.reviewStatus === "accepted" ? "已采纳（留痕）" : "已标记不采纳（留痕）"}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* 复诊对比：同作品其他已完成记录 vs 当前报告 */}
        <RecheckCompare submissionId={submissionId} />

        {/* 判例佐证：命中规则关联的真实判例 */}
        {(precedents.data?.length ?? 0) > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Landmark className="h-5 w-5 text-amber-800" />
                相关判例佐证（{precedents.data!.length}）
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {precedents.data!.map((c) => (
                <div key={c.id} className="border border-stone-200 rounded-lg p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="font-medium text-sm">{c.title}</span>
                    {c.platform && (
                      <Badge variant="outline" className="text-xs">{c.platform}</Badge>
                    )}
                    {c.occurredAt && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(c.occurredAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {c.summary}
                  </p>
                  {c.outcome && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      <span className="font-medium text-slate-600">处置结果：</span>
                      {c.outcome}
                    </p>
                  )}
                  {c.sourceUrl && (
                    <a
                      href={c.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs text-amber-800 hover:underline mt-1.5"
                    >
                      来源：{c.source} ↗
                    </a>
                  )}
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                判例整理自公开报道与官方公告，仅供合规参考。更多见
                <a href="/cases" className="text-amber-800 hover:underline ml-1">判例库</a>。
              </p>
            </CardContent>
          </Card>
        )}

        {/* 整改助手对话框 */}
        <Dialog open={assistHit !== null} onOpenChange={(o) => !o && setAssistHit(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-amber-800" /> 智能整改助手
              </DialogTitle>
            </DialogHeader>
            {remediate.isPending ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> 正在生成整改建议…
              </div>
            ) : remediate.data ? (
              <div className="space-y-4">
                <blockquote className="border-l-2 pl-3 text-sm text-slate-700 bg-slate-50 py-2 rounded-r">
                  {remediate.data.spanText}
                </blockquote>
                <div className="text-sm">
                  <span className="font-medium">整改方向：</span>
                  {remediate.data.direction}
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">可选处置方案：</p>
                  <div className="space-y-2.5">
                    {remediate.data.suggestions.map((s, i) => (
                      <div key={i} className="border border-stone-200 rounded-lg p-3">
                        <Badge variant="outline" className="text-xs mb-2">
                          {s.kind === "rewrite" ? "AI 改写" : s.kind === "delete" ? "删除" : "替换/调整"}
                        </Badge>
                        <p className="text-sm leading-relaxed">{s.text}</p>
                        <p className="text-xs text-muted-foreground mt-1.5">{s.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {remediate.data.tips.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1.5">整改要点：</p>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                      {remediate.data.tips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button
                  className="w-full bg-amber-800 hover:bg-amber-900 text-white"
                  onClick={() => navigate(`/submit?recheck=${submissionId}`)}
                >
                  修改剧本后去复诊 <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
                {!remediate.data.llmEnabled && (
                  <p className="text-xs text-muted-foreground text-center">
                    当前为规则模板建议；配置 LLM_API_KEY 后可获得 AI 个性化改写
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">
                未能获取建议，请稍后重试
              </p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AuthLayout>
  );
}

type RecheckDiff = RouterOutputs["submissions"]["recheckDiff"];
type DiffHit = RecheckDiff["resolved"][number];

const DIFF_GROUPS = [
  {
    key: "resolved",
    label: "已消除",
    Icon: CheckCircle2,
    boxCls: "border-green-200 bg-green-50",
    textCls: "text-green-700",
  },
  {
    key: "persisting",
    label: "仍存在",
    Icon: AlertTriangle,
    boxCls: "border-amber-200 bg-amber-50",
    textCls: "text-amber-700",
  },
  {
    key: "added",
    label: "新增",
    Icon: ShieldAlert,
    boxCls: "border-red-200 bg-red-50",
    textCls: "text-red-700",
  },
] as const;

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return <Badge variant="outline">未完成</Badge>;
  const v = VERDICTS[verdict as keyof typeof VERDICTS];
  return (
    <Badge className="text-white" style={{ background: v?.color ?? "#78716c" }}>
      {v?.label ?? verdict}
    </Badge>
  );
}

function DiffHitRow({ hit }: { hit: DiffHit }) {
  return (
    <li className="text-sm leading-relaxed">
      <span className="font-medium">第{hit.episodeNo}集</span>
      <span className="text-muted-foreground"> · {hit.location ?? "全文"} · </span>
      <span>{hit.ruleName}</span>
      {hit.spanText && (
        <span className="text-muted-foreground">：「{hit.spanText.slice(0, 60)}」</span>
      )}
    </li>
  );
}

/** 复诊对比区块：选择同作品其他已完成记录，对比命中差异（已消除/仍存在/新增） */
function RecheckCompare({ submissionId }: { submissionId: number }) {
  const related = trpc.submissions.relatedSubmissions.useQuery({ id: submissionId });
  const [compareId, setCompareId] = useState<number | null>(null);
  const [diffEnabled, setDiffEnabled] = useState(false);
  const diff = trpc.submissions.recheckDiff.useQuery(
    { baseId: submissionId, compareId: compareId ?? 0 },
    { enabled: diffEnabled && compareId !== null, retry: false },
  );

  // 无同作品其他已完成记录时不渲染该区块
  if (!related.data || related.data.length === 0) return null;

  const runDiff = () => {
    if (compareId === null) {
      toast.error("请先选择要对比的送检记录");
      return;
    }
    setDiffEnabled(true);
  };

  const result = diffEnabled ? diff.data : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <GitCompareArrows className="h-5 w-5" /> 复诊对比
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={compareId === null ? "" : String(compareId)}
            onValueChange={(v) => setCompareId(Number(v))}
          >
            <SelectTrigger className="w-72">
              <SelectValue placeholder="选择同作品的其他送检记录" />
            </SelectTrigger>
            <SelectContent>
              {related.data.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  #{r.id} · {VERDICTS[r.verdict as keyof typeof VERDICTS]?.label ?? r.verdict ?? "未完成"} ·{" "}
                  {new Date(r.createdAt).toLocaleString("zh-CN")}
                  {r.resubmitOfId ? "（复诊单）" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={runDiff} disabled={diff.isFetching}>
            {diff.isFetching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 对比中…
              </>
            ) : (
              "对比"
            )}
          </Button>
        </div>

        {diffEnabled && diff.error && (
          <p className="text-sm text-red-600">{diff.error.message || "对比失败，请重试"}</p>
        )}

        {result && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">本报告</span>
              <VerdictBadge verdict={result.base.verdict} />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">#{result.compare.id}</span>
              <VerdictBadge verdict={result.compare.verdict} />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {DIFF_GROUPS.map((g) => {
                const list = result[g.key];
                return (
                  <div key={g.key} className={`rounded-lg border p-4 ${g.boxCls}`}>
                    <div className={`flex items-center gap-2 font-medium mb-2 ${g.textCls}`}>
                      <g.Icon className="h-4 w-4" />
                      {g.label}（{list.length}）
                    </div>
                    {list.length === 0 ? (
                      <p className="text-xs text-muted-foreground">无</p>
                    ) : (
                      <ul className="space-y-2">
                        {list.map((h) => (
                          <DiffHitRow key={h.id} hit={h} />
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
