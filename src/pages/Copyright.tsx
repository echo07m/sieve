import AuthLayout from "@/components/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/providers/trpc";
import { BookMarked, CheckCircle2, Circle, FileSearch, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** 授权链六节点（顺序即业务流程） */
const AUTH_NODES = [
  { key: "authorization_application", label: "授权申请" },
  { key: "adaptation_boundary", label: "改编红线确认" },
  { key: "key_plot_confirm", label: "关键剧情确认" },
  { key: "mid_review", label: "中期审查" },
  { key: "final_review", label: "成片审查" },
  { key: "filing_record", label: "成片备案" },
] as const;
type AuthNodeKey = (typeof AUTH_NODES)[number]["key"];

interface CheckResult {
  similarity: number;
  segments: { targetExcerpt: string; refExcerpt: string; similarity: number }[];
  refHash: string;
  targetHash: string;
}

function pct(s: number): string {
  return `${(s * 100).toFixed(1)}%`;
}

/** 相似度分级：>30% 红色警示 / 10-30% 橙色 / <10% 绿色 */
function simTextClass(s: number): string {
  if (s > 0.3) return "text-red-600";
  if (s >= 0.1) return "text-amber-600";
  return "text-green-600";
}

function simLabel(s: number): string {
  if (s > 0.3) return "高度重合 · 存在侵权风险，须重点排查";
  if (s >= 0.1) return "存在一定重合 · 建议人工复核";
  return "重合度低 · 风险可控";
}

function simBadgeClass(s: number): string {
  if (s > 0.3) return "bg-red-600 text-white";
  if (s >= 0.1) return "bg-amber-500 text-white";
  return "bg-green-600 text-white";
}

function fmtTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("zh-CN", { hour12: false });
}

function HashLine({ label, hash }: { label: string; hash: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="font-mono break-all text-slate-700">{hash}</span>
    </div>
  );
}

/** 查重结果展示块（运行结果与历史详情复用） */
function CheckResultView({ result }: { result: CheckResult }) {
  return (
    <div className="space-y-5">
      <div className="flex items-end gap-4">
        <div className={`text-5xl font-bold tabular-nums ${simTextClass(result.similarity)}`}>
          {pct(result.similarity)}
        </div>
        <div className="pb-1.5">
          <Badge className={simBadgeClass(result.similarity)}>{simLabel(result.similarity)}</Badge>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
        <div className="text-xs font-medium text-slate-700">哈希留痕（SHA-256）</div>
        <HashLine label="参照原文" hash={result.refHash} />
        <HashLine label="待查剧本" hash={result.targetHash} />
      </div>

      <div className="space-y-3">
        <div className="text-sm font-medium">
          匹配片段（{result.segments.length} 段，按相似度降序）
        </div>
        {result.segments.length === 0 ? (
          <p className="text-sm text-muted-foreground">未检出连续重合片段。</p>
        ) : (
          result.segments.map((seg, i) => (
            <div key={i} className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5">
                <span className="text-xs font-medium text-slate-700">片段 {i + 1}</span>
                <Badge className={simBadgeClass(seg.similarity)}>相似度 {pct(seg.similarity)}</Badge>
              </div>
              <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                <div className="p-3">
                  <div className="text-xs text-muted-foreground mb-1">待查剧本</div>
                  <p className="text-sm leading-relaxed break-all">{seg.targetExcerpt}</p>
                </div>
                <div className="p-3">
                  <div className="text-xs text-muted-foreground mb-1">参照原文</div>
                  <p className="text-sm leading-relaxed break-all">{seg.refExcerpt}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** 页签一：桥段查重 */
function CheckTab() {
  const utils = trpc.useUtils();
  const [workTitle, setWorkTitle] = useState("");
  const [refTitle, setRefTitle] = useState("");
  const [refText, setRefText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);

  const history = trpc.copyright.listChecks.useQuery();
  const detail = trpc.copyright.checkDetail.useQuery(
    { id: detailId ?? 0 },
    { enabled: detailId !== null },
  );

  const runCheck = trpc.copyright.runCheck.useMutation({
    onSuccess: async () => {
      await utils.copyright.listChecks.invalidate();
      toast.success("查重完成，结果已留痕存证");
    },
    onError: (e) => toast.error(e.message || "查重失败"),
  });

  const submit = () => {
    if (!workTitle.trim()) return toast.error("请填写作品名称");
    if (!refTitle.trim()) return toast.error("请填写参照作品名称");
    if (refText.trim().length < 50) return toast.error("参照原文过短（至少50字）");
    if (targetText.trim().length < 50) return toast.error("待查剧本过短（至少50字）");
    runCheck.mutate({
      workTitle: workTitle.trim(),
      refTitle: refTitle.trim(),
      refText,
      targetText,
    });
  };

  const result = runCheck.data?.result ?? null;

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">发起查重</CardTitle>
            <CardDescription>
              基于字符级 shingle 比对待查剧本与参照原文的桥段重合度，全程本地计算
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>作品名称 *</Label>
                <Input
                  value={workTitle}
                  onChange={(e) => setWorkTitle(e.target.value)}
                  placeholder="待查作品名称"
                />
              </div>
              <div className="space-y-2">
                <Label>参照作品名称 *</Label>
                <Input
                  value={refTitle}
                  onChange={(e) => setRefTitle(e.target.value)}
                  placeholder="如：西游记 / 某在先剧本"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>参照原文 *（至少50字）</Label>
              <Textarea
                value={refText}
                onChange={(e) => setRefText(e.target.value)}
                placeholder="粘贴参照作品原文或权利文本…"
                className="min-h-32"
              />
              <p className="text-xs text-muted-foreground">{refText.length} 字</p>
            </div>
            <div className="space-y-2">
              <Label>待查剧本 *（至少50字）</Label>
              <Textarea
                value={targetText}
                onChange={(e) => setTargetText(e.target.value)}
                placeholder="粘贴待查剧本全文或关键桥段…"
                className="min-h-32"
              />
              <p className="text-xs text-muted-foreground">{targetText.length} 字</p>
            </div>
            <Button
              onClick={submit}
              disabled={runCheck.isPending}
              className="w-full bg-slate-800 hover:bg-slate-700"
            >
              {runCheck.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> 正在比对…
                </>
              ) : (
                <>
                  <FileSearch className="h-4 w-4" /> 开始查重
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">查重结果</CardTitle>
            <CardDescription>总体相似度 &gt;30% 触发红色警示，10%-30% 需人工复核</CardDescription>
          </CardHeader>
          <CardContent>
            {runCheck.isPending ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-48" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : result ? (
              <CheckResultView result={result} />
            ) : (
              <p className="text-sm text-muted-foreground">
                提交查重后，此处展示总体相似度、匹配片段对照与哈希留痕信息。
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">历史查重记录</CardTitle>
          <CardDescription>点击查看完整比对详情（含原文与匹配片段）</CardDescription>
        </CardHeader>
        <CardContent>
          {history.isLoading ? (
            <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : (history.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无查重记录。</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {(history.data ?? []).map((row) => {
                const s = row.result?.similarity ?? 0;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setDetailId(row.id)}
                    className="w-full flex flex-wrap items-center gap-3 py-3 text-left hover:bg-slate-50 px-2 rounded transition-colors"
                  >
                    <span className="font-medium">《{row.workTitle}》</span>
                    <span className="text-sm text-muted-foreground">对照《{row.refTitle}》</span>
                    <Badge className={simBadgeClass(s)}>{pct(s)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      匹配片段 {row.result?.segments.length ?? 0} 段
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">{fmtTime(row.createdAt)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              查重详情
              {detail.data ? `：《${detail.data.workTitle}》对照《${detail.data.refTitle}》` : ""}
            </DialogTitle>
            <DialogDescription>
              {detail.data ? `检测时间：${fmtTime(detail.data.createdAt)}` : "加载中…"}
            </DialogDescription>
          </DialogHeader>
          {detail.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-48" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : detail.data?.result ? (
            <CheckResultView result={detail.data.result} />
          ) : (
            <p className="text-sm text-muted-foreground">记录不存在或结果为空。</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** 单个待完成节点的留痕表单 */
function NodeTraceForm({
  workTitle,
  ipName,
  node,
}: {
  workTitle: string;
  ipName: string;
  node: AuthNodeKey;
}) {
  const utils = trpc.useUtils();
  const [evidenceText, setEvidenceText] = useState("");
  const [operatorName, setOperatorName] = useState("");

  const addNode = trpc.copyright.addAuthNode.useMutation({
    onSuccess: async (res) => {
      await utils.copyright.listAuthChains.invalidate();
      toast.success(`留痕完成，哈希：${res.evidenceHash.slice(0, 16)}…`);
    },
    onError: (e) => toast.error(e.message || "留痕失败"),
  });

  const submit = () => {
    if (!evidenceText.trim()) return toast.error("请填写留痕说明");
    if (!operatorName.trim()) return toast.error("请填写操作人");
    addNode.mutate({
      workTitle,
      ipName,
      node,
      evidenceText: evidenceText.trim(),
      operatorName: operatorName.trim(),
    });
  };

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
      <div className="space-y-1.5">
        <Label className="text-xs">留痕说明 *</Label>
        <Textarea
          value={evidenceText}
          onChange={(e) => setEvidenceText(e.target.value)}
          placeholder="如：已取得授权方书面确认（合同编号/邮件/会议纪要要点）…"
          className="min-h-20 bg-white"
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">操作人 *</Label>
          <Input
            value={operatorName}
            onChange={(e) => setOperatorName(e.target.value)}
            placeholder="姓名"
            className="w-40 bg-white"
          />
        </div>
        <Button
          size="sm"
          onClick={submit}
          disabled={addNode.isPending}
          className="bg-slate-800 hover:bg-slate-700"
        >
          {addNode.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          提交留痕
        </Button>
      </div>
    </div>
  );
}

/** 页签二：授权链留痕 */
function ChainTab() {
  const [workTitle, setWorkTitle] = useState("");
  const [ipName, setIpName] = useState("");
  const [queried, setQueried] = useState<{ workTitle: string; ipName: string } | null>(null);

  const chains = trpc.copyright.listAuthChains.useQuery(queried ?? { workTitle: "", ipName: "" }, {
    enabled: queried !== null,
  });

  const search = () => {
    if (!workTitle.trim()) return toast.error("请填写作品名称");
    if (!ipName.trim()) return toast.error("请填写IP名称");
    setQueried({ workTitle: workTitle.trim(), ipName: ipName.trim() });
  };

  const nodeMap = new Map((chains.data ?? []).map((row) => [row.node, row]));
  const doneCount = AUTH_NODES.filter((n) => nodeMap.get(n.key)?.status === "done").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">授权链留痕</CardTitle>
          <CardDescription>
            六节点为 授权申请 → 改编红线 → 关键剧情确认 → 中期审查 → 成片审查 →
            成片备案。每个节点留痕后生成 SHA-256 哈希存证，不可抵赖。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>作品名称 *</Label>
              <Input
                value={workTitle}
                onChange={(e) => setWorkTitle(e.target.value)}
                placeholder="改编作品名称"
                className="w-56"
              />
            </div>
            <div className="space-y-2">
              <Label>IP名称 *</Label>
              <Input
                value={ipName}
                onChange={(e) => setIpName(e.target.value)}
                placeholder="被改编的经典IP"
                className="w-56"
              />
            </div>
            <Button onClick={search} className="bg-slate-800 hover:bg-slate-700">
              查询授权链
            </Button>
          </div>

          {queried && (
            <div className="text-sm text-muted-foreground">
              《{queried.workTitle}》 × {queried.ipName}：已完成 {doneCount}/6 个节点
            </div>
          )}

          {queried &&
            (chains.isLoading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : (
              <ol className="relative border-l-2 border-slate-200 ml-3 space-y-6">
                {AUTH_NODES.map((node, idx) => {
                  const record = nodeMap.get(node.key);
                  const done = record?.status === "done";
                  return (
                    <li key={node.key} className="ml-6 relative">
                      <span className="absolute -left-[35px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-white">
                        {done ? (
                          <CheckCircle2 className="h-6 w-6 text-green-600" />
                        ) : (
                          <Circle className="h-6 w-6 text-slate-300" />
                        )}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {idx + 1}. {node.label}
                        </span>
                        {done ? (
                          <Badge className="bg-green-600 text-white">已留痕</Badge>
                        ) : (
                          <Badge variant="outline" className="border-slate-300 text-slate-500">
                            待留痕
                          </Badge>
                        )}
                      </div>

                      {done && record ? (
                        <div className="mt-2 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                          <p className="leading-relaxed">{record.evidenceText}</p>
                          <HashLine label="留痕哈希" hash={record.evidenceHash} />
                          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <span>操作人：{record.operatorName || "—"}</span>
                            <span>留痕时间：{fmtTime(record.occurredAt ?? record.createdAt)}</span>
                          </div>
                        </div>
                      ) : (
                        <NodeTraceForm
                          workTitle={queried.workTitle}
                          ipName={queried.ipName}
                          node={node.key}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

/** 页签三：IP参照库 */
function IpLibraryTab() {
  const { data, isLoading } = trpc.copyright.ipLibrary.useQuery();

  const grouped = (data ?? []).reduce<Record<string, NonNullable<typeof data>>>((acc, ip) => {
    (acc[ip.category] ??= []).push(ip);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookMarked className="h-5 w-5 text-slate-700" />
            经典IP参照库
          </CardTitle>
          <CardDescription>
            命中这些经典IP的改编将触发AI魔改规则。请在立项阶段对照参照库自查，避免未经授权的改编与魔改。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <p className="text-sm text-muted-foreground">参照库暂无数据。</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([category, list]) => (
                <div key={category}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{category}</span>
                    <Badge variant="outline" className="border-slate-300 text-slate-600">
                      {list.length} 项
                    </Badge>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {list.map((ip) => (
                      <div
                        key={ip.id}
                        className="rounded-lg border border-slate-200 bg-white p-4 space-y-2"
                      >
                        <div className="font-medium text-slate-900">{ip.name}</div>
                        <div className="text-xs text-muted-foreground">出处：{ip.origin || "—"}</div>
                        {(ip.aliases ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {(ip.aliases ?? []).map((alias) => (
                              <Badge
                                key={alias}
                                variant="outline"
                                className="border-slate-300 text-slate-600 font-normal"
                              >
                                {alias}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Copyright() {
  return (
    <AuthLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">版权自查</h1>
          <p className="text-sm text-muted-foreground mt-1">
            桥段级查重 · 授权链六节点留痕 · 经典IP参照库 —— 改编合规的上线前自检
          </p>
        </div>

        <Tabs defaultValue="check">
          <TabsList>
            <TabsTrigger value="check">桥段查重</TabsTrigger>
            <TabsTrigger value="chain">授权链留痕</TabsTrigger>
            <TabsTrigger value="iplib">IP参照库</TabsTrigger>
          </TabsList>
          <TabsContent value="check" className="mt-6">
            <CheckTab />
          </TabsContent>
          <TabsContent value="chain" className="mt-6">
            <ChainTab />
          </TabsContent>
          <TabsContent value="iplib" className="mt-6">
            <IpLibraryTab />
          </TabsContent>
        </Tabs>
      </div>
    </AuthLayout>
  );
}
