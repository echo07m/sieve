import AuthLayout from "@/components/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/providers/trpc";
import {
  Clapperboard,
  Copy,
  Download,
  FileJson,
  FileText,
  Film,
  Loader2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SHOT_TYPE_CN: Record<string, string> = {
  long: "远景",
  full: "全景",
  medium: "中景",
  close: "近景",
  extreme_close: "特写",
};

const CAMERA_CN: Record<string, string> = {
  fixed: "固定",
  push: "推镜",
  pull: "拉镜",
  pan: "横摇",
  follow: "跟随",
  handheld: "手持",
};

interface Shot {
  shotNo: number;
  episodeNo: number;
  scene: string;
  character: string;
  shotType: string;
  cameraMove: string;
  visual: string;
  dialogue: string;
  durationSec: number;
  mood: string;
  agentPrompt: string;
}

function downloadBase64(filename: string, mime: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 分镜拆解：剧本 → 结构化分镜表 + 逐镜 agentPrompt，衔接视频生成 agent */
export default function Storyboard() {
  const utils = trpc.useUtils();
  const history = trpc.storyboard.list.useQuery();
  const submissions = trpc.submissions.list.useQuery();
  const [title, setTitle] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [submissionId, setSubmissionId] = useState<string>("");
  const [activeId, setActiveId] = useState<number | null>(null);

  const detail = trpc.storyboard.detail.useQuery(
    { id: activeId! },
    { enabled: activeId != null },
  );

  const create = trpc.storyboard.create.useMutation({
    onSuccess: (r) => {
      toast.success(`拆解完成：${r.shotCount} 镜`);
      setActiveId(r.id);
      utils.storyboard.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const exportFile = trpc.storyboard.exportFile.useMutation({
    onSuccess: (r) => downloadBase64(r.filename, r.mime, r.base64),
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.storyboard.remove.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      setActiveId(null);
      utils.storyboard.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const shots = (detail.data?.shots as unknown as Shot[]) ?? [];
  const canSubmit =
    title.trim().length > 0 && (scriptText.trim().length >= 10 || submissionId !== "");

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clapperboard className="h-6 w-6" /> 分镜拆解
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            送检前置环节：剧本 → 结构化分镜表。每镜附带面向视频生成模型（即梦/可灵/Runway）的
            agentPrompt，可直接投喂生成视频片段，实现「剧本 → 分镜 → 成片」流水线。
          </p>
        </div>

        {/* 输入 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">新建分镜</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>作品名称</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：闪婚老公是总裁" />
              </div>
              <div>
                <Label>或选择已有送检记录（二选一）</Label>
                <Select value={submissionId} onValueChange={(v) => { setSubmissionId(v === "none" ? "" : v); }}>
                  <SelectTrigger><SelectValue placeholder="不使用送检记录" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不使用送检记录</SelectItem>
                    {submissions.data?.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.workTitle}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!submissionId && (
              <div>
                <Label>剧本全文（支持「第N集」分集、【场景】场景标记）</Label>
                <Textarea
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  rows={8}
                  placeholder={"第1集 相遇\n【场景】豪华酒店大堂\n苏晚晴：（冷笑）有钱能使鬼推磨。\n……"}
                />
              </div>
            )}
            <Button
              disabled={!canSubmit || create.isPending}
              onClick={() =>
                create.mutate({
                  workTitle: title.trim(),
                  scriptText: submissionId ? undefined : scriptText,
                  submissionId: submissionId ? Number(submissionId) : undefined,
                })
              }
            >
              {create.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <Film className="h-4 w-4 mr-1" /> 拆解分镜
            </Button>
          </CardContent>
        </Card>

        {/* 结果 */}
        {detail.data && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">
                《{detail.data.workTitle}》分镜表 — {detail.data.shotCount} 镜 ｜{" "}
                {detail.data.episodeCount} 集 ｜ 估算 {Math.round(detail.data.totalDurationSec / 60)} 分钟
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => exportFile.mutate({ id: detail.data.id, format: "json" })}>
                  <FileJson className="h-4 w-4 mr-1" /> JSON
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportFile.mutate({ id: detail.data.id, format: "csv" })}>
                  <Download className="h-4 w-4 mr-1" /> CSV 分镜表
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportFile.mutate({ id: detail.data.id, format: "promptpack" })}>
                  <FileText className="h-4 w-4 mr-1" /> 提示词包
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {shots.map((s) => (
                <div key={s.shotNo} className="border rounded-md p-3 text-sm space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">镜{s.shotNo}</Badge>
                    <Badge variant="secondary">第{s.episodeNo}集</Badge>
                    <span className="text-muted-foreground">{s.scene}</span>
                    <Badge>{SHOT_TYPE_CN[s.shotType] ?? s.shotType}</Badge>
                    <Badge variant="secondary">{CAMERA_CN[s.cameraMove] ?? s.cameraMove}</Badge>
                    <span className="text-xs text-muted-foreground">{s.durationSec}s ｜ {s.mood}</span>
                    <Button
                      size="sm" variant="ghost" className="ml-auto h-7"
                      onClick={() => {
                        navigator.clipboard.writeText(s.agentPrompt);
                        toast.success(`镜${s.shotNo} 提示词已复制`);
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" /> 复制提示词
                    </Button>
                  </div>
                  <p><span className="text-muted-foreground">画面：</span>{s.visual}</p>
                  {s.dialogue && (
                    <p><span className="text-muted-foreground">台词：</span>{s.character ? `${s.character}：` : ""}{s.dialogue}</p>
                  )}
                  <p className="text-xs bg-muted rounded px-2 py-1 font-mono">{s.agentPrompt}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 历史 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">历史分镜（{history.data?.length ?? 0}）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.data?.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">暂无分镜记录</p>
            )}
            {history.data?.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/50"
                onClick={() => setActiveId(h.id)}
              >
                <div>
                  <span className="font-medium">{h.workTitle}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    {h.shotCount} 镜 ｜ {h.episodeCount} 集 ｜ {Math.round(h.totalDurationSec / 60)} 分钟
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.createdAt).toLocaleString("zh-CN")}
                  </span>
                  <Button
                    size="icon" variant="ghost"
                    onClick={(e) => { e.stopPropagation(); remove.mutate({ id: h.id }); }}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
