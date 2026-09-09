import AuthLayout from "@/components/AuthLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, SEVERITIES, type CategoryKey } from "@contracts/constants";
import { createTRPCReact } from "@trpc/react-query";
import { AlertTriangle, Info, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { createRouter } from "../../api/middleware";
import type { customRulesRouter } from "../../api/customRulesRouter";

/** 路由将在集成阶段注册到 appRouter 的 customRules 命名空间下，此处按注册后的结构声明类型 */
type CustomRulesAppRouter = ReturnType<
  typeof createRouter<{ customRules: typeof customRulesRouter }>
>;
const trpc = createTRPCReact<CustomRulesAppRouter>();

type SeverityKey = keyof typeof SEVERITIES;

type Conflict = { ruleCode: string; name: string; overlap: string[] };

export default function CustomRules() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.customRules.list.useQuery();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CategoryKey>("vulgar_title");
  const [severity, setSeverity] = useState<SeverityKey>("notice");
  const [keywordsInput, setKeywordsInput] = useState("");
  const [patternsInput, setPatternsInput] = useState("");
  const [remediation, setRemediation] = useState("");
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);

  const create = trpc.customRules.create.useMutation({
    onSuccess: async (res) => {
      await utils.customRules.list.invalidate();
      setConflicts(res.conflicts);
      if (res.conflicts.length > 0) {
        toast.warning("规则已创建，但与底座规则存在关键词重叠");
      } else {
        toast.success("自定义规则已创建");
      }
      setOpen(false);
      setName("");
      setKeywordsInput("");
      setPatternsInput("");
      setRemediation("");
    },
    onError: (e) => toast.error(e.message || "创建失败"),
  });

  const setStatus = trpc.customRules.setStatus.useMutation({
    onSuccess: () => utils.customRules.list.invalidate(),
    onError: () => toast.error("操作失败"),
  });

  const remove = trpc.customRules.remove.useMutation({
    onSuccess: () => {
      utils.customRules.list.invalidate();
      toast.success("规则已删除");
    },
    onError: () => toast.error("删除失败"),
  });

  const submit = () => {
    if (!name.trim()) return toast.error("请填写规则名称");
    const keywords = keywordsInput
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const patterns = patternsInput
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const p of patterns) {
      try {
        new RegExp(p);
      } catch {
        return toast.error(`正则表达式无效：${p}`);
      }
    }
    if (keywords.length === 0 && patterns.length === 0) {
      return toast.error("请至少填写一组关键词或一条正则");
    }
    create.mutate({
      name: name.trim(),
      category,
      severity,
      keywords,
      patterns,
      remediationTemplate: remediation.trim(),
    });
  };

  return (
    <AuthLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">客户规则自定义</h1>
            <p className="text-sm text-muted-foreground mt-1">
              在底座规则库之上叠加自有加严规则，检测时一并执行
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" /> 新建规则
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>新建自定义规则</DialogTitle>
                <DialogDescription>
                  规则编码自动生成；正则每行一条，保存前会逐条校验合法性
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>规则名称 *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="如：特定题材禁做清单"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>违规类别</Label>
                    <Select value={category} onValueChange={(v) => setCategory(v as CategoryKey)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORIES).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>严重级别</Label>
                    <Select value={severity} onValueChange={(v) => setSeverity(v as SeverityKey)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(SEVERITIES).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>关键词（逗号分隔）</Label>
                  <Input
                    value={keywordsInput}
                    onChange={(e) => setKeywordsInput(e.target.value)}
                    placeholder="如：穿越买官，阴阳合同，代孕"
                  />
                </div>
                <div className="space-y-2">
                  <Label>正则表达式（可选，每行一条）</Label>
                  <Textarea
                    rows={3}
                    value={patternsInput}
                    onChange={(e) => setPatternsInput(e.target.value)}
                    placeholder={"如：\\d{11}\n（手机号格式）"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>整改建议模板</Label>
                  <Textarea
                    rows={3}
                    value={remediation}
                    onChange={(e) => setRemediation(e.target.value)}
                    placeholder="命中该规则时向用户展示的整改建议"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  取消
                </Button>
                <Button onClick={submit} disabled={create.isPending}>
                  {create.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 创建中…
                    </>
                  ) : (
                    "创建规则"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-900" />
          <AlertDescription className="text-sm text-blue-900">
            自定义规则在底座规则之上配置自有加严规则（如特定题材禁做清单），检测时叠加执行；
            与底座规则的关键词存在重叠时会显式告警，便于确认是否存在口径冲突。
          </AlertDescription>
        </Alert>

        {conflicts && conflicts.length > 0 && (
          <Alert className="border-amber-300 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <AlertDescription className="text-sm text-amber-900">
              <div className="font-medium mb-1">
                新规则与 {conflicts.length} 条底座规则存在关键词重叠，请确认口径：
              </div>
              <ul className="list-disc ml-4 space-y-1">
                {conflicts.map((c) => (
                  <li key={c.ruleCode}>
                    <span className="font-mono text-xs">{c.ruleCode}</span> {c.name}
                    ，重叠关键词：{c.overlap.join("、")}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : !data?.length ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              暂无自定义规则，点击右上角「新建规则」创建第一条加严规则
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className="text-white"
                      style={{ background: CATEGORIES[r.category].color }}
                    >
                      {CATEGORIES[r.category].label}
                    </Badge>
                    <Badge
                      variant="outline"
                      style={{ color: SEVERITIES[r.severity].color, borderColor: SEVERITIES[r.severity].color }}
                    >
                      {SEVERITIES[r.severity].label}
                    </Badge>
                    <span className="font-medium">{r.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{r.ruleCode}</span>
                    <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                      {r.status === "active" ? "已启用" : "已停用"}
                      <Switch
                        checked={r.status === "active"}
                        onCheckedChange={(checked) =>
                          setStatus.mutate({
                            id: Number(r.id),
                            status: checked ? "active" : "disabled",
                          })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove.mutate({ id: Number(r.id) })}
                        disabled={remove.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    关键词 {r.keywords.length} 组
                    {r.keywords.length > 0 && `：${r.keywords.join("、")}`}
                    {" · "}正则 {r.patterns.length} 条
                  </div>
                  {r.remediationTemplate && (
                    <div className="text-xs text-muted-foreground">
                      整改建议：{r.remediationTemplate}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
