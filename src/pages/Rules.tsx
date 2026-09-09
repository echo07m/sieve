import AuthLayout from "@/components/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { CATEGORIES, SEVERITIES } from "@contracts/constants";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";

export default function Rules() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data, isLoading } = trpc.rules.list.useQuery();
  const setStatus = trpc.rules.setStatus.useMutation({
    onSuccess: () => utils.rules.list.invalidate(),
    onError: () => toast.error("操作失败"),
  });

  const grouped = (data?.rules ?? []).reduce<
    Record<string, NonNullable<typeof data>["rules"]>
  >((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <AuthLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">合规规则库</h1>
            <p className="text-sm text-muted-foreground mt-1">
              当前版本：{data?.currentVersion?.version ?? "—"} · 政策条文 → 机器可执行规则，热更新不触及引擎代码
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
        ) : (
          Object.entries(CATEGORIES).map(([catKey, cat]) => {
            const list = grouped[catKey as keyof typeof CATEGORIES];
            if (!list?.length) return null;
            return (
              <Card key={catKey}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ background: cat.color }}
                    />
                    {cat.label}
                    <span className="text-xs font-normal text-muted-foreground">
                      {list.length} 条规则
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {list.map((r) => (
                    <div key={r.ruleCode} className="border rounded-lg p-4 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          className="text-white"
                          style={{ background: SEVERITIES[r.severity].color }}
                        >
                          {SEVERITIES[r.severity].label}
                        </Badge>
                        <span className="font-medium">{r.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {r.ruleCode} · v{r.version}
                        </span>
                        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                          {r.status === "active" ? "已启用" : "已停用"}
                          {isAdmin && (
                            <Switch
                              checked={r.status === "active"}
                              onCheckedChange={(checked) =>
                                setStatus.mutate({
                                  ruleCode: r.ruleCode,
                                  status: checked ? "active" : "disabled",
                                })
                              }
                            />
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-start gap-1">
                        <BookOpen className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>
                          {r.sourcePolicy}｜{r.sourceClause}：{r.originalText}
                          {r.sourceConfidence === "vendor_interpretation" && (
                            <span className="text-amber-600">（企服解读，以广电原文为准）</span>
                          )}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        判定逻辑：关键词 {r.keywords.length} 组 · 正则 {r.patterns.length} 条 · 共现{" "}
                        {r.cooccurrence?.length ?? 0} 组 · 基础置信度{" "}
                        {(Number(r.baseConfidence) * 100).toFixed(0)}%
                        {Object.keys(r.platformOverrides ?? {}).length > 0 && (
                          <span className="ml-2 text-blue-700">
                            平台差分：{Object.keys(r.platformOverrides ?? {}).join("、")}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </AuthLayout>
  );
}
