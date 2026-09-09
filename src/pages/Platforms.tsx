/**
 * F9 多平台规则差异化适配：平台通道配置展示 + 规则差分对比
 * 平台差分为参数覆盖而非独立规则——底座规则以监管原文为准。
 */
import AuthLayout from "@/components/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CATEGORIES, SEVERITIES } from "@contracts/constants";
import { trpc } from "@/providers/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { platformsRouter } from "../../api/platformsRouter";
import { FileText, Layers } from "lucide-react";

type PlatformsOutputs = inferRouterOutputs<typeof platformsRouter>;
type PlatformItem = PlatformsOutputs["list"][number];
type DiffRow = PlatformsOutputs["ruleDiff"][number];

/** platformsRouter 尚未注册进 AppRouter 前，先以类型断言方式挂载 hooks（注册后可直接换为 trpc.platforms） */
const platformsApi = (
  trpc as unknown as {
    platforms: {
      list: { useQuery: () => { data?: PlatformItem[]; isLoading: boolean } };
      ruleDiff: { useQuery: () => { data?: DiffRow[]; isLoading: boolean } };
    };
  }
).platforms;

/** 差分对比的平台列（不含 universal 通用口径） */
const DIFF_PLATFORMS = [
  { code: "hongguo", label: "红果" },
  { code: "fanqie", label: "番茄" },
  { code: "kuaishou", label: "快手" },
  { code: "wechat", label: "微信" },
] as const;

function SeverityBadge({ severity }: { severity: keyof typeof SEVERITIES }) {
  const meta = SEVERITIES[severity];
  return (
    <Badge className="text-white" style={{ background: meta.color }}>
      {meta.label}
    </Badge>
  );
}

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

export default function Platforms() {
  const { data: platforms, isLoading: loadingPlatforms } =
    platformsApi.list.useQuery();
  const { data: diff, isLoading: loadingDiff } =
    platformsApi.ruleDiff.useQuery();

  return (
    <AuthLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            多平台规则差异化适配
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            平台通道配置与规则差分口径一览
          </p>
        </div>

        {/* ============ 平台通道卡片区 ============ */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5" />
            平台通道
          </h2>
          {loadingPlatforms ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-56 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(platforms ?? []).map((p) => (
                <Card key={p.code}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between gap-2">
                      <span>{p.name}</span>
                      <span className="font-mono text-xs font-normal text-muted-foreground">
                        {p.code}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground shrink-0">
                        审核严格度
                      </span>
                      <StrictnessDots value={p.strictness} />
                    </div>
                    <div>
                      <span className="text-muted-foreground">备案通道：</span>
                      {p.filingChannel || "—"}
                    </div>
                    {p.aiMarkingSpec && (
                      <div className="border rounded-lg p-3 space-y-1.5 bg-muted/40">
                        <div className="text-xs font-medium text-muted-foreground">
                          AI标识口径
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          <div>
                            <span className="text-muted-foreground">位置：</span>
                            {p.aiMarkingSpec.position}
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              最小字号比例：
                            </span>
                            {(p.aiMarkingSpec.minFontScale * 100).toFixed(0)}%
                            （相对画面高度）
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              最短时长：
                            </span>
                            {p.aiMarkingSpec.minDurationSec} 秒
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              必须字样：
                            </span>
                            「{p.aiMarkingSpec.requiredText}」
                          </div>
                        </div>
                      </div>
                    )}
                    {p.notes && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {p.notes}
                      </p>
                    )}
                    <p className="text-xs text-amber-600">
                      执行细则以平台最新公告为准
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ============ 规则差分对比表格 ============ */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            规则差分对比
          </h2>
          <p className="text-sm text-muted-foreground">
            底座规则以监管原文为准，平台差分为参数覆盖而非独立规则——新增平台边际成本限于口径调研
          </p>
          {loadingDiff ? (
            <Skeleton className="h-64 w-full" />
          ) : !diff?.length ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                当前无平台差分规则，所有规则均按通用口径执行
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>规则</TableHead>
                      <TableHead>类别</TableHead>
                      <TableHead>通用口径严重级</TableHead>
                      {DIFF_PLATFORMS.map((p) => (
                        <TableHead key={p.code}>{p.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diff.map((r) => (
                      <TableRow key={r.ruleCode}>
                        <TableCell>
                          <div className="font-medium">{r.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {r.ruleCode}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className="inline-flex items-center gap-1.5 text-xs"
                            style={{ color: CATEGORIES[r.category].color }}
                          >
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ background: CATEGORIES[r.category].color }}
                            />
                            {CATEGORIES[r.category].label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <SeverityBadge severity={r.baseSeverity} />
                        </TableCell>
                        {DIFF_PLATFORMS.map((p) => {
                          const override = r.overrides[p.code];
                          return (
                            <TableCell key={p.code}>
                              {override?.severity ? (
                                <div className="inline-flex flex-col items-start gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-2 py-1">
                                  <SeverityBadge severity={override.severity} />
                                  {override.note && (
                                    <span className="text-xs text-muted-foreground">
                                      {override.note}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  同通用
                                </span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </AuthLayout>
  );
}
