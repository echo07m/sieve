import { useState } from "react";
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
import { Copy, KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";

const CURL_EXAMPLE = `curl -X POST https://<你的域名>/api/v1/detect \\
  -H "Authorization: Bearer jhg_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "workTitle": "示例短剧",
    "scriptText": "第1集\\n（剧本正文，50-2000000字）……",
    "targetPlatform": "universal"
  }'`;

const RESPONSE_FIELDS: { field: string; type: string; desc: string }[] = [
  { field: "verdict", type: "string", desc: "整体结论：high_risk 高风险须整改 / attention 需关注 / low_risk 低风险" },
  { field: "summary", type: "object", desc: "汇总：totalHits、blockCount、highCount、noticeCount、byCategory、affectedEpisodes 等" },
  { field: "hits[].episodeNo", type: "number", desc: "命中所在集号" },
  { field: "hits[].location", type: "string", desc: "集/场/句定位" },
  { field: "hits[].spanText", type: "string", desc: "命中片段原文" },
  { field: "hits[].category", type: "string", desc: "违规类别（涉儿童有害/软色情擦边/拜金炫富等 8 类）" },
  { field: "hits[].ruleCode", type: "string", desc: "命中规则编号，可在规则库中溯源" },
  { field: "hits[].severity", type: "string", desc: "严重级别：block 阻断 / high 高危 / notice 提示" },
  { field: "hits[].confidence", type: "number", desc: "置信度 0-1（架构强制：每条结论必附置信度）" },
  { field: "hits[].basis", type: "string", desc: "依据条文原文（架构强制：无依据的结论无法生成）" },
  { field: "hits[].remediation", type: "string", desc: "整改建议" },
  { field: "ruleVersion", type: "string", desc: "本次检测使用的规则库版本" },
  { field: "reportHash", type: "string", desc: "SHA-256(hits + 规则版本 + 时间戳)，用于留痕存证与结果核验" },
  { field: "disclaimer", type: "string", desc: "预检参考，最终以平台/监管审核为准" },
];

function CopyButton({ text, label = "复制" }: { text: string; label?: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast.success("已复制到剪贴板");
        } catch {
          toast.error("复制失败，请手动选择复制");
        }
      }}
    >
      <Copy className="mr-1 h-3.5 w-3.5" /> {label}
    </Button>
  );
}

export default function ApiKeys() {
  const utils = trpc.useUtils();
  const { data: keys, isLoading } = trpc.apiKeys.list.useQuery();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const create = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => {
      setCreatedKey(data.key);
      setName("");
      utils.apiKeys.list.invalidate();
    },
    onError: (e) => toast.error(e.message || "创建失败"),
  });

  const revoke = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => {
      toast.success("已吊销");
      utils.apiKeys.list.invalidate();
    },
    onError: (e) => toast.error(e.message || "吊销失败"),
  });

  return (
    <AuthLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">开放 API</h1>
            <p className="text-sm text-muted-foreground mt-1">
              通过 REST 接口将合规预检能力接入你的制作流程与内部系统
            </p>
          </div>
          <Button onClick={() => { setCreatedKey(null); setCreateOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> 新建 API Key
          </Button>
        </div>

        {/* 接入说明 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">接入说明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="border rounded-lg p-3">
                <div className="text-muted-foreground text-xs mb-1">端点</div>
                <code className="font-mono text-xs">POST /api/v1/detect</code>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-muted-foreground text-xs mb-1">鉴权方式</div>
                <code className="font-mono text-xs">Authorization: Bearer &lt;API Key&gt;</code>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-muted-foreground text-xs mb-1">调用限额</div>
                <code className="font-mono text-xs">60 次/分钟/Key（超限返回 429）</code>
              </div>
            </div>
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">调用示例（curl）</span>
                <CopyButton text={CURL_EXAMPLE} label="复制示例" />
              </div>
              <pre className="font-mono text-xs bg-muted rounded-lg p-4 overflow-x-auto whitespace-pre">
                {CURL_EXAMPLE}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Key 列表 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> API Key 列表
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !keys?.length ? (
              <p className="text-center text-muted-foreground py-12">
                暂无 API Key，点击右上角「新建 API Key」开始接入
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>前缀</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>最近调用</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {k.prefix}…
                      </TableCell>
                      <TableCell>
                        {k.status === "active" ? (
                          <Badge variant="secondary">启用中</Badge>
                        ) : (
                          <Badge variant="destructive">已吊销</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("zh-CN") : "从未调用"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(k.createdAt).toLocaleString("zh-CN")}
                      </TableCell>
                      <TableCell className="text-right">
                        {k.status === "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={revoke.isPending}
                            onClick={() => {
                              if (window.confirm(`确认吊销「${k.name}」？吊销后立即失效且不可恢复。`)) {
                                revoke.mutate({ id: k.id });
                              }
                            }}
                          >
                            吊销
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 返回结构说明 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">返回结构说明</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">字段</TableHead>
                  <TableHead className="w-24">类型</TableHead>
                  <TableHead>说明</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RESPONSE_FIELDS.map((f) => (
                  <TableRow key={f.field}>
                    <TableCell className="font-mono text-xs">{f.field}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{f.type}</TableCell>
                    <TableCell className="text-sm">{f.desc}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* 创建 Key 对话框 */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setCreatedKey(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createdKey ? "API Key 创建成功" : "新建 API Key"}</DialogTitle>
            <DialogDescription>
              {createdKey
                ? "完整 Key 仅在此展示一次，请立即复制并妥善保管。"
                : "为该 Key 起一个可识别的名称，例如接入的系统或用途。"}
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-3">
              <pre className="font-mono text-xs bg-muted rounded-lg p-3 break-all whitespace-pre-wrap">
                {createdKey}
              </pre>
              <p className="text-xs text-amber-600">
                关闭本对话框后将无法再次查看完整 Key（服务端只保存哈希），遗失请吊销后重新创建。
              </p>
              <DialogFooter>
                <CopyButton text={createdKey} label="复制 Key" />
                <Button onClick={() => setCreateOpen(false)}>完成</Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) {
                  toast.error("请填写 Key 名称");
                  return;
                }
                create.mutate({ name: name.trim() });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="key-name">名称</Label>
                <Input
                  id="key-name"
                  placeholder="例如：剧本管理系统-生产环境"
                  value={name}
                  maxLength={128}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "创建中…" : "创建"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AuthLayout>
  );
}
