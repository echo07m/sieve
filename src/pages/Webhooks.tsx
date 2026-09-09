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
import { trpc } from "@/providers/trpc";
import {
  CheckCircle2,
  Copy,
  Loader2,
  Plus,
  RotateCw,
  Send,
  Trash2,
  Webhook,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const EVENT_LABELS: Record<string, string> = {
  "detect.done": "检测完成",
  "detect.failed": "检测失败",
  "test.ping": "连通测试",
};

/** Webhook 回调管理：端点配置 + 签名密钥 + 投递日志 + 手动重推 */
export default function Webhooks() {
  const utils = trpc.useUtils();
  const endpoints = trpc.webhooks.listEndpoints.useQuery();
  const [page, setPage] = useState(1);
  const deliveries = trpc.webhooks.listDeliveries.useQuery({ page, pageSize: 10 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const invalidate = () => {
    utils.webhooks.listEndpoints.invalidate();
    utils.webhooks.listDeliveries.invalidate();
  };
  const create = trpc.webhooks.createEndpoint.useMutation({
    onSuccess: (r) => {
      setNewSecret(r.secret);
      setDialogOpen(false);
      setName("");
      setUrl("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.webhooks.updateEndpoint.useMutation({
    onSuccess: (r) => {
      if (r.secret) setNewSecret(r.secret);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.webhooks.deleteEndpoint.useMutation({
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });
  const ping = trpc.webhooks.testPing.useMutation({
    onSuccess: () => {
      toast.success("测试事件已投递，请在投递日志查看结果");
      setTimeout(invalidate, 1500);
    },
    onError: (e) => toast.error(e.message),
  });
  const redeliver = trpc.webhooks.redeliver.useMutation({
    onSuccess: () => {
      toast.success("已重新投递");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("已复制");
  };

  const totalPages = Math.max(1, Math.ceil((deliveries.data?.total ?? 0) / 10));

  return (
    <AuthLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Webhook className="h-5 w-5 text-amber-800" /> Webhook 回调
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              异步检测（POST /api/v1/detect/async）完成后，向你的服务器推送
              detect.done / detect.failed 事件；请求体用签名密钥做 HMAC-SHA256
              签名（请求头 X-Sieve-Signature）。
            </p>
          </div>
          <Button
            className="bg-amber-800 hover:bg-amber-900 text-white"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" /> 新增端点
          </Button>
        </div>

        {/* 端点列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">回调端点（{endpoints.data?.length ?? 0}/5）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(endpoints.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                尚未配置端点。新增后，异步检测完成会主动推送到该地址。
              </p>
            )}
            {(endpoints.data ?? []).map((ep) => (
              <div key={ep.id} className="border border-stone-200 rounded-lg p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm">{ep.name || "未命名端点"}</span>
                  <Badge variant={ep.isActive ? "default" : "secondary"}>
                    {ep.isActive ? "生效中" : "已停用"}
                  </Badge>
                  <div className="ml-auto flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => ping.mutate({ endpointId: ep.id })}>
                      <Send className="h-3 w-3 mr-1" /> 测试
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => update.mutate({ id: ep.id, isActive: !ep.isActive })}
                    >
                      {ep.isActive ? "停用" : "启用"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-red-600"
                      onClick={() => {
                        if (window.confirm("确认删除该端点？")) remove.mutate({ id: ep.id });
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <code className="bg-stone-100 rounded px-2 py-0.5 break-all">{ep.url}</code>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">签名密钥：</span>
                  <code className="bg-stone-100 rounded px-2 py-0.5">{ep.secret.slice(0, 14)}…</code>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => copy(ep.secret)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs text-amber-800"
                    onClick={() => {
                      if (window.confirm("重置密钥后旧密钥立即失效，确认？")) {
                        update.mutate({ id: ep.id, rotateSecret: true });
                      }
                    }}
                  >
                    <RotateCw className="h-3 w-3 mr-1" /> 重置
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 投递日志 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">投递日志（{deliveries.data?.total ?? 0}）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(deliveries.data?.items ?? []).map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-2 border-b border-stone-100 pb-2 text-sm">
                {d.status === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                ) : d.status === "failed" ? (
                  <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                ) : (
                  <Loader2 className="h-4 w-4 text-amber-600 animate-spin shrink-0" />
                )}
                <Badge variant="outline" className="text-xs">
                  {EVENT_LABELS[d.event] ?? d.event}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  #{d.id} · 尝试 {d.attempts} 次
                  {d.responseCode ? ` · HTTP ${d.responseCode}` : ""}
                  {d.lastError ? ` · ${d.lastError}` : ""}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(d.createdAt).toLocaleString()}
                </span>
                {d.status === "failed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs"
                    onClick={() => redeliver.mutate({ deliveryId: d.id })}
                  >
                    重推
                  </Button>
                )}
              </div>
            ))}
            {(deliveries.data?.items.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground py-3 text-center">暂无投递记录</p>
            )}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-3 pt-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  上一页
                </Button>
                <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  下一页
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 验签说明 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">接收端验签示例（Node.js）</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-stone-900 text-stone-100 text-xs rounded-md p-4 overflow-x-auto">{`const crypto = require("crypto");
// rawBody 为未经解析的原始请求体字符串
const expected = "sha256=" + crypto
  .createHmac("sha256", WEBHOOK_SECRET)
  .update(rawBody).digest("hex");
if (req.headers["x-sieve-signature"] !== expected) {
  return res.status(401).end();
}`}</pre>
          </CardContent>
        </Card>

        {/* 新增端点对话框 */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>新增回调端点</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="端点名称（可选）" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="https://your-server.com/webhook" value={url} onChange={(e) => setUrl(e.target.value)} />
              <Button
                className="w-full bg-amber-800 hover:bg-amber-900 text-white"
                disabled={create.isPending || !url}
                onClick={() => create.mutate({ name, url })}
              >
                创建并生成签名密钥
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* 新密钥展示 */}
        <Dialog open={newSecret !== null} onOpenChange={() => setNewSecret(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>签名密钥（仅本次完整展示）</DialogTitle>
            </DialogHeader>
            <code className="block bg-stone-100 rounded p-3 text-xs break-all">{newSecret}</code>
            <Button variant="outline" onClick={() => newSecret && copy(newSecret)}>
              <Copy className="h-4 w-4 mr-1" /> 复制密钥
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </AuthLayout>
  );
}
