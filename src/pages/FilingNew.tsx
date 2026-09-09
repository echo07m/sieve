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
import { Textarea } from "@/components/ui/textarea";
import { PLATFORMS, WORK_TYPES } from "@contracts/constants";
import { trpc } from "@/providers/trpc";
import { Info, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type WorkType = "ai_drama" | "ai_comic" | "live_drama";
type Platform = "universal" | "hongguo" | "fanqie" | "kuaishou" | "wechat";

export default function FilingNew() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [workTitle, setWorkTitle] = useState("");
  const [workType, setWorkType] = useState<WorkType>("ai_drama");
  const [platform, setPlatform] = useState<Platform>("universal");
  const [investment, setInvestment] = useState<string>("");
  const [episodeCount, setEpisodeCount] = useState<string>("80");
  const [episodeDuration, setEpisodeDuration] = useState<string>("2");
  const [synopsis, setSynopsis] = useState("");
  const [producerName, setProducerName] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [costs, setCosts] = useState<{ item: string; amount: string }[]>([
    { item: "AI生成算力与工具订阅", amount: "" },
  ]);

  const inv = parseFloat(investment);
  const tierQuery = trpc.filing.judgeTier.useQuery(
    { workType, investment: Number.isFinite(inv) ? inv : 0 },
    { enabled: Number.isFinite(inv) && inv >= 0 && investment !== "" },
  );

  const create = trpc.filing.create.useMutation({
    onSuccess: async (res) => {
      await utils.filing.list.invalidate();
      toast.success("备案材料包已生成");
      navigate(`/filing/${res.id}`);
    },
    onError: (e) => toast.error(e.message || "生成失败"),
  });

  const submit = () => {
    if (!workTitle.trim()) return toast.error("请填写作品名称");
    if (!Number.isFinite(inv) || inv < 0) return toast.error("请填写有效投资额（万元）");
    const ep = parseInt(episodeCount, 10);
    if (!Number.isInteger(ep) || ep < 1) return toast.error("请填写有效集数");
    create.mutate({
      workTitle: workTitle.trim(),
      workType,
      targetPlatform: platform,
      investment: inv,
      episodeCount: ep,
      episodeDuration: parseFloat(episodeDuration) || 2,
      synopsis: synopsis || undefined,
      producerName: producerName || undefined,
      licenseNo: licenseNo || undefined,
      costBreakdown: costs
        .filter((c) => c.item.trim() && parseFloat(c.amount) > 0)
        .map((c) => ({ item: c.item.trim(), amount: parseFloat(c.amount) })),
    });
  };

  return (
    <AuthLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">生成备案材料</h1>
          <p className="text-sm text-muted-foreground mt-1">
            填写作品与成本信息，生成平台通道所需的备案三件套，并同步完成分层判定
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">作品信息</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>作品名称 *</Label>
              <Input value={workTitle} onChange={(e) => setWorkTitle(e.target.value)} placeholder="作品名称" />
            </div>
            <div className="space-y-2">
              <Label>作品类型</Label>
              <Select value={workType} onValueChange={(v) => setWorkType(v as WorkType)}>
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
              <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PLATFORMS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>集数</Label>
                <Input type="number" value={episodeCount} onChange={(e) => setEpisodeCount(e.target.value)} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>单集时长（分钟）</Label>
                <Input type="number" step="0.5" value={episodeDuration} onChange={(e) => setEpisodeDuration(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>剧情梗概</Label>
              <Textarea rows={4} value={synopsis} onChange={(e) => setSynopsis(e.target.value)} placeholder="作品信息表必填项：200–500字剧情梗概" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">主体资质</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>制作机构名称</Label>
              <Input value={producerName} onChange={(e) => setProducerName(e.target.value)} placeholder="与许可证一致" />
            </div>
            <div className="space-y-2">
              <Label>《广播电视节目制作经营许可证》编号</Label>
              <Input value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} placeholder="重点/普通通道必填" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">投资与成本核算</CardTitle>
            <CardDescription>投资额决定备案分层路径；成本明细用于成本核算表</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4 items-start">
              <div className="space-y-2">
                <Label>总投资额（万元）*</Label>
                <Input
                  type="number"
                  min={0}
                  value={investment}
                  onChange={(e) => setInvestment(e.target.value)}
                  placeholder="如：60"
                />
              </div>
              {tierQuery.data && (
                <Alert className="border-blue-200 bg-blue-50">
                  <Info className="h-4 w-4 text-blue-900" />
                  <AlertDescription className="text-sm">
                    <div className="flex items-center gap-2 font-medium text-blue-900">
                      分层判定：{tierQuery.data.tier}
                      <Badge variant="outline" className="text-blue-900 border-blue-300">
                        {tierQuery.data.filingPath}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{tierQuery.data.basisNote}</p>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="space-y-2">
              <Label>成本明细</Label>
              {costs.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="成本项（如：AI生成算力、IP授权、配音）"
                    value={c.item}
                    onChange={(e) =>
                      setCosts(costs.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))
                    }
                  />
                  <Input
                    className="w-32"
                    type="number"
                    placeholder="万元"
                    value={c.amount}
                    onChange={(e) =>
                      setCosts(costs.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCosts(costs.filter((_, j) => j !== i))}
                    disabled={costs.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCosts([...costs, { item: "", amount: "" }])}
              >
                <Plus className="mr-1 h-4 w-4" /> 添加成本项
              </Button>
            </div>

            <div className="flex justify-end">
              <Button size="lg" onClick={submit} disabled={create.isPending}>
                {create.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 生成中…
                  </>
                ) : (
                  "生成备案三件套"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
