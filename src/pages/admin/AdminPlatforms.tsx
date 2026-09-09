/**
 * 后台管理 · 平台配置管理（建议路由 /admin/platforms）
 * 平台通道卡片 + 编辑 Dialog（严格度 / 备案通道 / AI 标识规范 / 备注）。
 * 数据接口：trpc.platforms.list / trpc.admin.updatePlatform
 */
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/providers/trpc";
import type { PlatformConfig } from "@db/schema";
import { Pencil, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type AiMarkingSpec = NonNullable<PlatformConfig["aiMarkingSpec"]>;

const DEFAULT_SPEC: AiMarkingSpec = {
  position: "",
  minFontScale: 0.05,
  minDurationSec: 2,
  requiredText: "",
};

/** 5 格圆点严格度指示器 */
function StrictnessDots({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            i <= value ? "bg-orange-500" : "bg-muted"
          }`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{value}/5</span>
    </div>
  );
}

function ForbiddenCard() {
  return (
    <Card className="border-amber-300 bg-amber-50/60">
      <CardContent className="flex items-center gap-3 py-8">
        <ShieldAlert className="h-6 w-6 shrink-0 text-amber-600" />
        <div>
          <p className="font-medium text-amber-900">无权限访问</p>
          <p className="mt-1 text-sm text-amber-800/80">
            该页面仅对管理员开放，当前账号无权修改平台配置。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** 编辑表单状态 */
interface EditForm {
  code: string;
  name: string;
  strictness: number;
  filingChannel: string;
  spec: AiMarkingSpec;
  notes: string;
}

export default function AdminPlatforms() {
  const utils = trpc.useUtils();
  // platforms 路由类型已注册进 AppRouter
  const { data: platforms, isLoading, error } = trpc.platforms.list.useQuery();
  const [editing, setEditing] = useState<EditForm | null>(null);

  const updatePlatform = trpc.admin.updatePlatform.useMutation({
    onSuccess: async (_res, vars) => {
      toast.success(`平台「${vars.name}」配置已更新`);
      setEditing(null);
      await utils.platforms.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "更新失败"),
  });

  const openEdit = (p: PlatformConfig) => {
    setEditing({
      code: p.code,
      name: p.name,
      strictness: p.strictness,
      filingChannel: p.filingChannel ?? "",
      spec: p.aiMarkingSpec ?? { ...DEFAULT_SPEC },
      notes: p.notes ?? "",
    });
  };

  const handleSubmit = () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      return toast.error("平台名称不能为空");
    }
    updatePlatform.mutate({
      code: editing.code,
      name: editing.name.trim(),
      strictness: editing.strictness,
      filingChannel: editing.filingChannel.trim(),
      aiMarkingSpec: {
        position: editing.spec.position.trim(),
        minFontScale: editing.spec.minFontScale,
        minDurationSec: editing.spec.minDurationSec,
        requiredText: editing.spec.requiredText.trim(),
      },
      notes: editing.notes.trim() || undefined,
    });
  };

  return (
    <AuthLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">平台配置管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              维护各平台审核严格度、备案通道与 AI 标识规范
            </p>
          </div>
          <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-900">
            <ShieldCheck className="h-3.5 w-3.5" /> 仅管理员可见
          </Badge>
        </div>

        {error ? (
          <ForbiddenCard />
        ) : isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-60 w-full" />
            ))}
          </div>
        ) : !platforms || platforms.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            暂无平台配置
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {platforms.map((p) => (
              <Card key={p.code}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span>{p.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs font-normal text-muted-foreground">
                        {p.code}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> 编辑
                      </Button>
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-muted-foreground">审核严格度</span>
                    <StrictnessDots value={p.strictness} />
                  </div>
                  <div>
                    <span className="text-muted-foreground">备案通道：</span>
                    {p.filingChannel || "—"}
                  </div>
                  {p.aiMarkingSpec ? (
                    <div className="space-y-1.5 rounded-lg border bg-muted/40 p-3">
                      <div className="text-xs font-medium text-muted-foreground">
                        AI 标识规范
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                        <div>
                          <span className="text-muted-foreground">位置：</span>
                          {p.aiMarkingSpec.position || "—"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">最小字号比例：</span>
                          {(p.aiMarkingSpec.minFontScale * 100).toFixed(0)}%
                          （相对画面高度）
                        </div>
                        <div>
                          <span className="text-muted-foreground">最短时长：</span>
                          {p.aiMarkingSpec.minDurationSec} 秒
                        </div>
                        <div>
                          <span className="text-muted-foreground">必须字样：</span>
                          {p.aiMarkingSpec.requiredText
                            ? `「${p.aiMarkingSpec.requiredText}」`
                            : "—"}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      尚未配置 AI 标识规范
                    </p>
                  )}
                  {p.notes && (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {p.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 编辑 Dialog */}
        <Dialog
          open={editing !== null}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>编辑平台配置</DialogTitle>
              <DialogDescription>
                {editing ? `平台代码：${editing.code}（不可修改）` : ""}
              </DialogDescription>
            </DialogHeader>
            {editing && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>平台名称</Label>
                    <Input
                      value={editing.name}
                      maxLength={128}
                      onChange={(e) =>
                        setEditing({ ...editing, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>审核严格度（1-5）</Label>
                    <Select
                      value={String(editing.strictness)}
                      onValueChange={(v) =>
                        setEditing({ ...editing, strictness: Number(v) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} {n === 5 ? "· 最严" : n === 1 ? "· 最松" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>备案通道</Label>
                  <Input
                    value={editing.filingChannel}
                    maxLength={255}
                    placeholder="如：平台后台提交备案申请"
                    onChange={(e) =>
                      setEditing({ ...editing, filingChannel: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
                  <div className="text-xs font-medium text-muted-foreground">
                    AI 标识规范
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>标识位置</Label>
                      <Input
                        value={editing.spec.position}
                        maxLength={255}
                        placeholder="如：片头显著位置"
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            spec: { ...editing.spec, position: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>最小字号比例（0-1）</Label>
                      <Input
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        value={editing.spec.minFontScale}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isNaN(v)) return;
                          setEditing({
                            ...editing,
                            spec: {
                              ...editing.spec,
                              minFontScale: Math.min(1, Math.max(0, v)),
                            },
                          });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>最短展示时长（秒）</Label>
                      <Input
                        type="number"
                        min={0}
                        max={600}
                        step={1}
                        value={editing.spec.minDurationSec}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isNaN(v)) return;
                          setEditing({
                            ...editing,
                            spec: {
                              ...editing.spec,
                              minDurationSec: Math.min(600, Math.max(0, v)),
                            },
                          });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>必须包含字样</Label>
                      <Input
                        value={editing.spec.requiredText}
                        maxLength={255}
                        placeholder="如：AI生成"
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            spec: { ...editing.spec, requiredText: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>备注</Label>
                  <Textarea
                    value={editing.notes}
                    maxLength={2000}
                    rows={3}
                    placeholder="执行细则、注意事项等（选填）"
                    onChange={(e) =>
                      setEditing({ ...editing, notes: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>
                取消
              </Button>
              <Button disabled={updatePlatform.isPending} onClick={handleSubmit}>
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthLayout>
  );
}
