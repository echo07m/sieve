import AuthLayout from "@/components/AuthLayout";
import UpgradePaywallDialog from "@/components/UpgradePaywallDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PLATFORMS, VERDICTS, WORK_TYPES } from "@contracts/constants";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import { Clapperboard, Files, FileText, Loader2, RefreshCw, Upload, Video, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

/** 批量送检：单批最多文件数 / 单文件最少字数（与后端 submissions.createBatch 约束一致） */
const BATCH_MAX_FILES = 10;
const BATCH_MIN_CHARS = 50;

type BatchFile = { name: string; title: string; text: string };

const SAMPLE = `《闪婚总裁的复仇娇妻》
第1集：绝境
林晚：你们慕容家害死我父亲，这笔血债我迟早要你们血债血偿！
旁白：林晚看着病床上奄奄一息的父亲，握紧了拳头。她决定嫁入慕容家复仇。
慕容辰：女人，你成功引起了我的注意。这份契约婚姻，签了它，你就是我们慕容家的人。
第2集：契约
旁白：婚礼上，慕容辰的劳斯莱斯车队足有百辆，慕容夫人随手甩出一亿零花钱砸在林晚脸上。
慕容夫人：穷人家的女儿，不配进我们慕容家的门，拿着钱滚。
林晚：（冷笑）今日之辱，他日必让你们慕容家满门跪地求饶。
第3集：转机
旁白：深夜酒店，孤男寡女共处一室。慕容辰看着衣衫不整的林晚，眼中欲火难掩。
林晚：（娇喘）总裁，你弄疼我了……
旁白：为了复仇，林晚决定利用这座靠山。她想起道长说过，她命带桃花劫，需作法改命方能消灾。
第4集：暴露
旁白：林晚偷偷给慕容辰下毒，看着他痛苦的样子，她感到大快人心。
林晚：父亲，女儿终于替你报仇了！灭门之仇，以牙还牙！
旁白：本剧改编自《冷血总裁的替身新娘》，同人致敬经典。`;

export default function SubmitNew() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();

  // 复诊模式：从报告详情「整改后复诊」跳入，携带原送检 ID
  const recheckParam = Number(searchParams.get("recheck"));
  const recheckId = Number.isInteger(recheckParam) && recheckParam > 0 ? recheckParam : null;
  const recheckOrigin = trpc.submissions.detail.useQuery(
    { id: recheckId ?? 0 },
    { enabled: recheckId !== null, retry: false },
  );

  const [mode, setMode] = useState<"script" | "subtitle">("script");
  const [workTitle, setWorkTitle] = useState("");
  const [workType, setWorkType] = useState<"ai_drama" | "ai_comic" | "live_drama">("ai_drama");
  const [platform, setPlatform] = useState<"universal" | "hongguo" | "fanqie" | "kuaishou" | "wechat">("universal");
  const [scriptText, setScriptText] = useState("");
  const [frameHashes, setFrameHashes] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  // 批量送检
  const [submitMode, setSubmitMode] = useState<"single" | "batch">("single");
  const batchFileRef = useRef<HTMLInputElement>(null);
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([]);
  const [batchResults, setBatchResults] = useState<
    { index: number; workTitle: string; ok: boolean; submissionId?: number; verdict?: string; error?: string }[] | null
  >(null);

  // 当前订阅用量：用于配额弹窗展示与送检后刷新进度
  const myPlan = trpc.billing.myPlan.useQuery();

  // 复诊模式：自动带出原作品名称（同一作品维度聚合复诊记录）
  useEffect(() => {
    const origin = recheckOrigin.data?.submission;
    if (recheckId !== null && origin && !workTitle) {
      setWorkTitle(origin.workTitle);
      setWorkType(origin.workType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recheckOrigin.data, recheckId]);

  const create = trpc.submissions.create.useMutation({
    onSuccess: async (res) => {
      await utils.submissions.list.invalidate();
      await utils.billing.myPlan.invalidate();
      toast.success("检测完成，已生成预检报告");
      navigate(`/submissions/${res.submissionId}`);
    },
    onError: (e) => {
      // 配额耗尽 → 打开转化弹窗而非普通报错
      if (e.message?.startsWith("PRECHECK_QUOTA_EXHAUSTED")) {
        setPaywallOpen(true);
        return;
      }
      toast.error(e.message || "检测失败，请重试");
    },
  });

  const createBatch = trpc.submissions.createBatch.useMutation({
    onSuccess: async (res) => {
      setBatchResults(res.results);
      await utils.submissions.list.invalidate();
      await utils.billing.myPlan.invalidate();
      if (res.failed === 0) {
        toast.success(`批量检测完成：成功 ${res.succeeded} 部`);
      } else {
        toast.warning(`批量检测完成：成功 ${res.succeeded} 部，失败 ${res.failed} 部（失败额度已退还）`);
      }
    },
    onError: (e) => {
      if (e.message?.startsWith("PRECHECK_QUOTA_EXHAUSTED")) {
        setPaywallOpen(true);
        return;
      }
      toast.error(e.message || "批量检测失败，请重试");
    },
  });

  const batchTooShort = (f: BatchFile) => f.text.trim().length < BATCH_MIN_CHARS;
  const batchValidFiles = batchFiles.filter((f) => !batchTooShort(f));

  const onBatchFiles = async (files: FileList) => {
    const remaining = BATCH_MAX_FILES - batchFiles.length;
    const list = Array.from(files).filter((f) => /\.txt$/i.test(f.name));
    if (list.length === 0) {
      toast.error("仅支持 .txt 剧本文件");
      return;
    }
    if (list.length > remaining) {
      toast.error(`一次最多 ${BATCH_MAX_FILES} 个文件，已超出部分未添加`);
    }
    const read = await Promise.all(
      list.slice(0, remaining).map(async (f) => ({
        name: f.name,
        title: f.name.replace(/\.txt$/i, ""),
        text: await f.text(),
      })),
    );
    setBatchFiles((prev) => [...prev, ...read]);
    setBatchResults(null);
  };

  const submitBatch = () => {
    if (batchFiles.length === 0) return toast.error("请先选择剧本文件");
    if (batchFiles.some(batchTooShort)) {
      return toast.error(`存在少于 ${BATCH_MIN_CHARS} 字的文件，请先移除`);
    }
    createBatch.mutate({
      items: batchValidFiles.map((f) => ({
        workTitle: f.title,
        workType,
        targetPlatform: platform,
        scriptText: f.text,
      })),
    });
  };

  const onFile = async (f: File) => {
    if (f.size > 4 * 1024 * 1024) {
      toast.error("文件过大（上限 4MB，约80集剧本）");
      return;
    }
    const text = await f.text();
    setScriptText(text);
    if (!workTitle) {
      const m = text.match(/[《「]([^》」]{2,40})[》」]/);
      if (m) setWorkTitle(m[1].trim());
    }
    toast.success(`已读取 ${f.name}（${text.length.toLocaleString()} 字）`);
  };

  /**
   * F3 抽帧基础版：浏览器端按 1帧/2秒 抽帧并计算 SHA-256。
   * 原始帧不上传、不留存，仅保留哈希留痕（数据最小化原则）。
   */
  const onVideo = async (f: File) => {
    setExtracting(true);
    setFrameHashes([]);
    try {
      const url = URL.createObjectURL(f);
      const video = document.createElement("video");
      video.src = url;
      video.muted = true;
      await new Promise<void>((res, rej) => {
        video.onloadedmetadata = () => res();
        video.onerror = () => rej(new Error("视频解析失败"));
      });
      const duration = Math.min(video.duration || 0, 600); // 单文件上限 10 分钟
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext("2d");
      const hashes: string[] = [];
      for (let t = 0; t < duration && hashes.length < 300; t += 2) {
        video.currentTime = t;
        await new Promise<void>((res) => {
          video.onseeked = () => res();
        });
        ctx?.drawImage(video, 0, 0, 160, 90);
        const blob = await new Promise<Blob | null>((res) =>
          canvas.toBlob(res, "image/jpeg", 0.5),
        );
        if (blob) {
          const buf = await blob.arrayBuffer();
          const digest = await crypto.subtle.digest("SHA-256", buf);
          hashes.push(
            Array.from(new Uint8Array(digest))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join(""),
          );
        }
      }
      URL.revokeObjectURL(url);
      setFrameHashes(hashes);
      toast.success(`抽帧完成：${hashes.length} 帧已留痕哈希（原始帧未上传）`);
    } catch {
      toast.error("视频抽帧失败，请确认格式为浏览器可播放的 mp4");
    } finally {
      setExtracting(false);
    }
  };

  const submit = () => {
    if (!workTitle.trim()) return toast.error("请填写作品名称");
    if (scriptText.trim().length < 50) return toast.error("剧本内容过短（至少50字）");
    create.mutate({
      workTitle: workTitle.trim(),
      workType,
      targetPlatform: platform,
      scriptText,
      // 复诊模式：关联原送检记录，便于复诊对比
      ...(recheckId !== null ? { resubmitOf: recheckId } : {}),
    });
  };

  return (
    <AuthLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">新建送检</h1>
          <p className="text-sm text-muted-foreground mt-1">
            上传或粘贴剧本文本，系统按当前规则库逐集扫描 8 类违规风险。检测结论为预检参考，最终以平台/监管审核为准。
          </p>
        </div>

        {recheckId !== null && (
          <Alert className="border-blue-200 bg-blue-50">
            <RefreshCw className="h-4 w-4 text-blue-900" />
            <AlertDescription className="text-sm text-blue-900">
              复诊模式：整改后的剧本将再次检测并与原报告对比
              {recheckOrigin.data?.submission
                ? `（原送检 #${recheckId}《${recheckOrigin.data.submission.workTitle}》）`
                : `（原送检 #${recheckId}）`}
              。对比结果可在新报告的「复诊对比」区块查看。
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={submitMode} onValueChange={(v) => setSubmitMode(v as typeof submitMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">
              <FileText className="mr-2 h-4 w-4" /> 单部送检
            </TabsTrigger>
            <TabsTrigger value="batch">
              <Files className="mr-2 h-4 w-4" /> 批量送检
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">作品信息</CardTitle>
            <CardDescription>目标平台决定加载对应的审核口径差分（如红果阈值更严）</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">作品名称 *</Label>
              <Input
                id="title"
                placeholder="如：闪婚总裁的复仇娇妻"
                value={workTitle}
                onChange={(e) => setWorkTitle(e.target.value)}
                readOnly={recheckId !== null}
                className={recheckId !== null ? "bg-muted" : undefined}
              />
              {recheckId !== null && (
                <p className="text-xs text-muted-foreground">
                  复诊模式沿用原作品名称，以保证与原报告同维度对比
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>作品类型</Label>
              <Select value={workType} onValueChange={(v) => setWorkType(v as typeof workType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(WORK_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>目标平台通道</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as typeof platform)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PLATFORMS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="script">
              <FileText className="mr-2 h-4 w-4" /> 剧本送检
            </TabsTrigger>
            <TabsTrigger value="subtitle">
              <Clapperboard className="mr-2 h-4 w-4" /> 成片送检（字幕+抽帧）
            </TabsTrigger>
          </TabsList>

          <TabsContent value="script">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">剧本文本</CardTitle>
            <CardDescription>
              支持 txt/md 文本文件上传或直接粘贴。建议按「第X集」分集以获得逐集定位。
              当前共 {scriptText.length.toLocaleString()} 字
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> 上传剧本文件
              </Button>
              <Button variant="ghost" onClick={() => { setScriptText(SAMPLE); setWorkTitle("闪婚总裁的复仇娇妻"); }}>
                填入示例剧本
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.text"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.target.value = "";
                }}
              />
            </div>
            <Textarea
              rows={16}
              placeholder="粘贴剧本全文……&#10;支持格式：第1集 / 第1集：标题 / EP01 等分集标记"
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              className="font-mono text-sm"
            />
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="subtitle" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">成片抽帧留痕（F3 基础版）</CardTitle>
                <CardDescription>
                  上传成片视频，浏览器端按 1帧/2秒 抽帧并计算 SHA-256 哈希留痕；原始帧不上传、不留存。
                  画面内容 AI 检测为预留接口，配置视觉模型 API 后启用。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" onClick={() => videoRef.current?.click()} disabled={extracting}>
                  {extracting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Video className="mr-2 h-4 w-4" />
                  )}
                  {extracting ? "抽帧中…" : "上传成片视频抽帧"}
                </Button>
                <input
                  ref={videoRef}
                  type="file"
                  accept="video/mp4,video/webm"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onVideo(f);
                    e.target.value = "";
                  }}
                />
                {frameHashes.length > 0 && (
                  <Alert>
                    <AlertDescription className="text-xs">
                      已留痕 {frameHashes.length} 帧哈希（抽样展示前 3 条）：
                      <div className="font-mono mt-1 space-y-0.5 break-all">
                        {frameHashes.slice(0, 3).map((h) => (
                          <div key={h}>{h}</div>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">字幕/台词文本</CardTitle>
                <CardDescription>
                  粘贴 SRT 字幕（含时间码）或台词文本，检测命中将定位到具体时间码。当前共{" "}
                  {scriptText.length.toLocaleString()} 字
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={12}
                  placeholder={"粘贴 SRT 字幕……\n1\n00:00:01,000 --> 00:00:04,000\n台词内容\n\n2\n00:00:04,500 --> 00:00:07,000\n台词内容"}
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  className="font-mono text-sm"
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground max-w-xl">
            保密承诺：送检内容属未公开商业内容，客户级隔离存储，未经授权不进入任何训练语料；视频帧检测即删、仅存哈希。
          </p>
          <Button onClick={submit} disabled={create.isPending} size="lg">
            {create.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 检测中…
              </>
            ) : (
              "开始检测"
            )}
          </Button>
        </div>
          </TabsContent>

          <TabsContent value="batch" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">批量参数</CardTitle>
                <CardDescription>
                  批量模式下每部作品的名称取文件名（去掉 .txt），类型与平台口径统一应用下列选择
                </CardDescription>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>作品类型</Label>
                  <Select value={workType} onValueChange={(v) => setWorkType(v as typeof workType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(WORK_TYPES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>目标平台通道</Label>
                  <Select value={platform} onValueChange={(v) => setPlatform(v as typeof platform)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PLATFORMS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">剧本文件（.txt，最多 {BATCH_MAX_FILES} 个）</CardTitle>
                <CardDescription>
                  每个 .txt 文件对应一部剧；少于 {BATCH_MIN_CHARS} 字的文件将被标红，需移除后才能提交
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => batchFileRef.current?.click()}
                    disabled={batchFiles.length >= BATCH_MAX_FILES}
                  >
                    <Upload className="mr-2 h-4 w-4" /> 选择剧本文件
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    已选 {batchFiles.length}/{BATCH_MAX_FILES} 个
                  </span>
                  <input
                    ref={batchFileRef}
                    type="file"
                    multiple
                    accept=".txt"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) onBatchFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>

                {batchFiles.length > 0 && (
                  <div className="divide-y rounded-lg border">
                    {batchFiles.map((f, i) => {
                      const tooShort = batchTooShort(f);
                      return (
                        <div
                          key={`${f.name}-${i}`}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2.5",
                            tooShort && "bg-red-50/60 dark:bg-red-950/30",
                          )}
                        >
                          <FileText
                            className={cn(
                              "h-4 w-4 shrink-0",
                              tooShort ? "text-red-600" : "text-muted-foreground",
                            )}
                          />
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-sm font-medium",
                              tooShort && "text-red-700 dark:text-red-400",
                            )}
                          >
                            {f.title}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 text-xs",
                              tooShort ? "font-medium text-red-600" : "text-muted-foreground",
                            )}
                          >
                            {f.text.length.toLocaleString()} 字
                            {tooShort && `（少于 ${BATCH_MIN_CHARS} 字，不可提交）`}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 text-xs"
                            onClick={() => {
                              setBatchFiles((prev) => prev.filter((_, idx) => idx !== i));
                              setBatchResults(null);
                            }}
                          >
                            <X className="mr-1 h-3.5 w-3.5" /> 移除
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  当前额度：已用 {myPlan.data?.subscription.quotaUsed ?? "-"} /{" "}
                  {myPlan.data?.subscription.quotaTotal === -1
                    ? "不限"
                    : `${myPlan.data?.subscription.quotaTotal ?? "-"} 次`}
                  {batchValidFiles.length > 0 && `；本次将消耗 ${batchValidFiles.length} 次`}
                </p>
              </CardContent>
            </Card>

            {batchResults && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">批量检测结果</CardTitle>
                  <CardDescription>
                    成功 {batchResults.filter((r) => r.ok).length} 部 · 失败{" "}
                    {batchResults.filter((r) => !r.ok).length} 部
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="divide-y rounded-lg border">
                    {batchResults.map((r) => (
                      <div key={r.index} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {r.workTitle}
                        </span>
                        {r.ok ? (
                          <>
                            {r.verdict && (
                              <Badge
                                className="text-white"
                                style={{
                                  background:
                                    VERDICTS[r.verdict as keyof typeof VERDICTS]?.color ?? "#78716c",
                                }}
                              >
                                {VERDICTS[r.verdict as keyof typeof VERDICTS]?.label ?? r.verdict}
                              </Badge>
                            )}
                            {r.submissionId != null && (
                              <Link
                                to={`/submissions/${r.submissionId}`}
                                className="text-sm text-primary underline-offset-4 hover:underline"
                              >
                                查看报告
                              </Link>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-red-600">
                            失败：{r.error ?? "未知原因"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground max-w-xl">
                批量送检将逐部检测并生成报告，失败单部的额度自动退还，不影响其他作品。
              </p>
              <Button
                onClick={submitBatch}
                disabled={
                  createBatch.isPending ||
                  batchFiles.length === 0 ||
                  batchFiles.some(batchTooShort)
                }
                size="lg"
              >
                {createBatch.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 批量检测中…
                  </>
                ) : (
                  `开始批量检测（${batchValidFiles.length} 部）`
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <UpgradePaywallDialog
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        quotaUsed={myPlan.data?.subscription.quotaUsed}
        quotaTotal={myPlan.data?.subscription.quotaTotal}
      />
    </AuthLayout>
  );
}
