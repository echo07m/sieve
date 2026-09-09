/**
 * 后台管理 · 运营总览（建议路由 /admin）
 * 核心指标卡 + 近 7 天送检趋势 + 订阅方案分布 + 检测结论分布。
 * 数据接口：trpc.admin.overview
 */
import AuthLayout from "@/components/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/providers/trpc";
import { PLANS, VERDICTS, type PlanCode } from "@contracts/constants";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ClipboardList,
  FileText,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

/** 命中严重级配色（低饱和暖色系，禁用蓝紫渐变） */
const HIT_COLORS = {
  block: { label: "阻断", color: "#b91c1c" },
  high: { label: "高危", color: "#c2410c" },
  notice: { label: "提示", color: "#b45309" },
} as const;

const VERDICT_META: Record<string, { label: string; color: string }> = {
  high_risk: { label: "高风险", color: VERDICTS.high_risk.color },
  attention: { label: "需关注", color: VERDICTS.attention.color },
  low_risk: { label: "低风险", color: VERDICTS.low_risk.color },
};

function planLabel(code: string) {
  return (PLANS as Record<string, { name: string }>)[code]?.name ?? code;
}

/** 查询失败（多为非管理员）时的警示卡 */
function ForbiddenCard() {
  return (
    <Card className="border-amber-300 bg-amber-50/60">
      <CardContent className="flex items-center gap-3 py-8">
        <ShieldAlert className="h-6 w-6 shrink-0 text-amber-600" />
        <div>
          <p className="font-medium text-amber-900">无权限访问</p>
          <p className="mt-1 text-sm text-amber-800/80">
            该页面仅对管理员开放，当前账号无权查看运营数据。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminOverview() {
  const { data, isLoading, error } = trpc.admin.overview.useQuery();

  const totals = data?.totals;
  const daily = data?.daily ?? [];
  const planDist = data?.planDist ?? [];
  const verdictDist = data?.verdictDist ?? [];
  const planMax = Math.max(1, ...planDist.map((p) => p.n));

  const statCards = [
    { icon: Users, label: "注册用户数", value: totals?.users ?? 0 },
    { icon: ClipboardList, label: "送检工单数", value: totals?.submissions ?? 0 },
    { icon: FileText, label: "报告数", value: totals?.reports ?? 0 },
  ];

  return (
    <AuthLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">运营总览</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              平台核心指标与近 7 天送检趋势
            </p>
          </div>
          <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-900">
            <ShieldCheck className="h-3.5 w-3.5" /> 仅管理员可见
          </Badge>
        </div>

        {error ? (
          <ForbiddenCard />
        ) : isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
            <Skeleton className="h-72 w-full" />
          </div>
        ) : (
          <>
            {/* 统计卡片区 */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {statCards.map((c) => (
                <Card key={c.label}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <c.icon className="h-4 w-4" /> {c.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{c.value}</div>
                  </CardContent>
                </Card>
              ))}

              {/* 线索总数（含新线索角标） */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <UserRound className="h-4 w-4" /> 线索总数
                    {(totals?.newLeads ?? 0) > 0 && (
                      <Badge className="bg-amber-600 text-white">
                        新线索 {totals?.newLeads}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{totals?.leads ?? 0}</div>
                </CardContent>
              </Card>

              {/* 命中总数（三档拆分） */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <ScanSearch className="h-4 w-4" /> 命中总数
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{totals?.hits.total ?? 0}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(Object.keys(HIT_COLORS) as (keyof typeof HIT_COLORS)[]).map(
                      (k) => (
                        <Badge
                          key={k}
                          variant="outline"
                          className="text-xs"
                          style={{
                            color: HIT_COLORS[k].color,
                            borderColor: HIT_COLORS[k].color,
                          }}
                        >
                          {HIT_COLORS[k].label} {totals?.hits[k] ?? 0}
                        </Badge>
                      ),
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 近 7 天送检趋势 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">近 7 天送检趋势</CardTitle>
              </CardHeader>
              <CardContent>
                {daily.length === 0 ? (
                  <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                    近 7 天暂无送检数据
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={daily} margin={{ left: -16, right: 8, top: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                        <XAxis dataKey="day" tickLine={false} fontSize={12} />
                        <YAxis allowDecimals={false} tickLine={false} fontSize={12} />
                        <Tooltip
                          formatter={(v) => [`${v} 单`, "送检量"]}
                          labelFormatter={(l) => `日期 ${l}`}
                        />
                        <Area
                          type="monotone"
                          dataKey="n"
                          stroke="#d97706"
                          strokeWidth={2}
                          fill="#d97706"
                          fillOpacity={0.18}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 两栏小卡：方案分布 / 结论分布 */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">订阅方案分布</CardTitle>
                </CardHeader>
                <CardContent>
                  {planDist.length === 0 ? (
                    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                      暂无生效订阅
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {planDist.map((p) => (
                        <div key={p.planCode} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>{planLabel(p.planCode as PlanCode)}</span>
                            <span className="font-medium tabular-nums">{p.n}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-amber-600/70"
                              style={{ width: `${(p.n / planMax) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">检测结论分布</CardTitle>
                </CardHeader>
                <CardContent>
                  {verdictDist.length === 0 ? (
                    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                      暂无检测报告
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {verdictDist.map((v) => {
                        const meta = VERDICT_META[v.verdict] ?? {
                          label: v.verdict,
                          color: "#78716c",
                        };
                        return (
                          <div
                            key={v.verdict}
                            className="flex items-center justify-between rounded-lg border px-3 py-2.5"
                          >
                            <span className="flex items-center gap-2 text-sm">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ background: meta.color }}
                              />
                              {meta.label}
                            </span>
                            <Badge
                              variant="outline"
                              style={{ color: meta.color, borderColor: meta.color }}
                            >
                              {v.n} 份
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
