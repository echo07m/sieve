import AuthLayout from "@/components/AuthLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { PLATFORMS } from "@contracts/constants";
import { trpc } from "@/providers/trpc";
import { CheckCircle2, ClipboardCheck, Info, Loader2, Plus, CopyCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** GB 45438-2025 标识自检清单勾选状态（localStorage 持久化） */
const CHECKLIST_STORAGE_KEY = "jhg-marking-checklist";

function loadChecklist(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

type Position = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" | "intro";
type PlatformKey = keyof typeof PLATFORMS;

const POSITION_LABELS: Record<Position, string> = {
  "top-left": "左上角",
  "top-right": "右上角",
  "bottom-left": "左下角",
  "bottom-right": "右下角",
  center: "画面居中",
  intro: "片头",
};

type Row = {
  position: Position;
  fontPct: string;
  durationSec: string;
  text: string;
};

const defaultRow = (): Row => ({
  position: "intro",
  fontPct: "4",
  durationSec: "5",
  text: "本片由AI生成",
});

export default function Marking() {
  const [platform, setPlatform] = useState<PlatformKey>("universal");
  const [rows, setRows] = useState<Row[]>([defaultRow()]);

  const validate = trpc.marking.validate.useMutation({
    onError: (e) => toast.error(e.message || "校验失败"),
  });

  // GB 45438-2025 标识自检清单（公开口径，勾选状态仅存本机）
  const standards = trpc.marking.standards.useQuery();
  const [checklist, setChecklist] = useState<Record<string, boolean>>(loadChecklist);
  const toggleChecklist = (key: string, value: boolean) => {
    setChecklist((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage 不可用时仅保留内存态
      }
      return next;
    });
  };
  const checklistItems = [
    ...(standards.data?.explicit ?? []),
    ...(standards.data?.implicit ?? []),
  ];
  const checklistDone = checklistItems.filter((i) => checklist[i.key]).length;

  const updateRow = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const fillAll = () => {
    if (rows.length < 2) return toast.error("至少两行才需要批量填充");
    const first = rows[0];
    setRows(rows.map(() => ({ ...first })));
    toast.success("已将第 1 集参数应用到全部集数");
  };

  const addTen = () =>
    setRows([...rows, ...Array.from({ length: 10 }, () => defaultRow())]);

  const submit = () => {
    if (rows.length < 1 || rows.length > 200) return toast.error("集数须在 1–200 之间");
    try {
      const episodes = rows.map((r, i) => {
        const fontPct = parseFloat(r.fontPct);
        const durationSec = parseFloat(r.durationSec);
        if (!Number.isFinite(fontPct) || fontPct < 0 || fontPct > 100) {
          throw new Error(`第 ${i + 1} 集字号比例须为 0–100 的数字`);
        }
        if (!Number.isFinite(durationSec) || durationSec < 0) {
          throw new Error(`第 ${i + 1} 集展示时长须为不小于 0 的数字`);
        }
        return {
          episodeNo: i + 1,
          position: r.position,
          fontScale: fontPct / 100,
          durationSec,
          text: r.text.trim(),
        };
      });
      validate.mutate({ platform, episodes });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "参数有误");
    }
  };

  const result = validate.data;
  const passRate =
    result && result.results.length > 0
      ? Math.round((result.passCount / result.results.length) * 100)
      : null;

  return (
    <AuthLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI标识合规校验</h1>
          <p className="text-sm text-muted-foreground mt-1">
            逐集校验 AI 标识的位置、字号、展示时长与必需字样是否符合平台口径
          </p>
          {standards.data && (
            <p className="text-xs text-muted-foreground mt-1">
              依据：{standards.data.basis}
            </p>
          )}
        </div>

        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-900" />
          <AlertDescription className="text-sm text-blue-900">
            按监管口径，每集须在明显位置添加 AI 标识；标识位置、字体大小或展示时长不规范会被平台驳回。
            本工具按所选平台口径做<strong>形式要件</strong>校验（位置 / 字号 / 时长 / 必需字样），
            实质性 AI 内容鉴定由平台侧机制负责，本结果不构成过审保证。
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">平台口径</CardTitle>
            <CardDescription>
              选择目标平台后，按其 AI 标识口径校验；未配置的平台自动回退到通用口径
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>目标平台</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as PlatformKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PLATFORMS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {result && (
              <div className="space-y-1 text-sm text-muted-foreground self-end">
                <div>当前口径：{result.spec.position}</div>
                <div>
                  字号≥{(result.spec.minFontScale * 100).toFixed(1)}% · 时长≥
                  {result.spec.minDurationSec}秒 · 须含「{result.spec.requiredText}」
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">集数参数</CardTitle>
            <CardDescription>每行对应一集；字号比例为标识高度占画面高度的百分比</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fillAll}>
                <CopyCheck className="mr-1 h-4 w-4" /> 批量填充
              </Button>
              <Button variant="outline" size="sm" onClick={addTen} disabled={rows.length > 190}>
                <Plus className="mr-1 h-4 w-4" /> 添加10集
              </Button>
              <span className="ml-auto text-xs text-muted-foreground self-center">
                共 {rows.length} 集
              </span>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">集号</TableHead>
                    <TableHead className="w-32">标识位置</TableHead>
                    <TableHead className="w-32">字号比例（%）</TableHead>
                    <TableHead className="w-32">展示时长（秒）</TableHead>
                    <TableHead>标识文字</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">第 {i + 1} 集</TableCell>
                      <TableCell>
                        <Select
                          value={r.position}
                          onValueChange={(v) => updateRow(i, { position: v as Position })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(POSITION_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={r.fontPct}
                          onChange={(e) => updateRow(i, { fontPct: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={r.durationSec}
                          onChange={(e) => updateRow(i, { durationSec: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.text}
                          placeholder="如：本片由AI生成"
                          onChange={(e) => updateRow(i, { text: e.target.value })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <Button size="lg" onClick={submit} disabled={validate.isPending}>
                {validate.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 校验中…
                  </>
                ) : (
                  "开始校验"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">校验结果</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-3">
                <span
                  className="text-5xl font-bold"
                  style={{ color: result.failCount === 0 ? "#16a34a" : "#dc2626" }}
                >
                  {passRate}%
                </span>
                <span className="text-sm text-muted-foreground pb-1">
                  通过率 · {result.passCount} 集通过 / {result.failCount} 集不通过
                </span>
              </div>

              <div className="space-y-2">
                {result.results.map((r) => (
                  <div
                    key={r.episodeNo}
                    className={`border rounded-lg p-3 text-sm ${
                      r.pass ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {r.pass ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-medium">第 {r.episodeNo} 集</span>
                      <Badge
                        variant="outline"
                        className={r.pass ? "text-green-700 border-green-300" : "text-red-700 border-red-300"}
                      >
                        {r.pass ? "通过" : "不通过"}
                      </Badge>
                    </div>
                    {!r.pass && (
                      <ul className="mt-2 ml-6 list-disc space-y-1 text-red-700">
                        {r.deviations.map((d, j) => (
                          <li key={j}>{d}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* GB 45438-2025 标识自检清单 */}
        {standards.data && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" /> GB 45438-2025 标识自检清单
                </CardTitle>
                <Badge
                  variant="outline"
                  className={
                    checklistDone === checklistItems.length
                      ? "text-green-700 border-green-300"
                      : "text-muted-foreground"
                  }
                >
                  完成度 {checklistDone}/{checklistItems.length}
                </Badge>
              </div>
              <CardDescription>
                逐项核对显式/隐式标识形式要件，勾选进度保存在本机浏览器
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-medium">显式标识（用户可见）</p>
                {standards.data.explicit.map((item) => (
                  <div key={item.key} className="flex items-start gap-3">
                    <Checkbox
                      id={`gb-explicit-${item.key}`}
                      checked={checklist[item.key] ?? false}
                      onCheckedChange={(v) => toggleChecklist(item.key, v === true)}
                      className="mt-0.5"
                    />
                    <div>
                      <label
                        htmlFor={`gb-explicit-${item.key}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {item.label}
                      </label>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium">隐式标识（文件元数据）</p>
                {standards.data.implicit.map((item) => (
                  <div key={item.key} className="flex items-start gap-3">
                    <Checkbox
                      id={`gb-implicit-${item.key}`}
                      checked={checklist[item.key] ?? false}
                      onCheckedChange={(v) => toggleChecklist(item.key, v === true)}
                      className="mt-0.5"
                    />
                    <div>
                      <label
                        htmlFor={`gb-implicit-${item.key}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {item.label}
                      </label>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3">
                {standards.data.platformNote}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AuthLayout>
  );
}
