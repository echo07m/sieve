import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
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
import { CATEGORIES, PLATFORMS, type CategoryKey } from "@contracts/constants";
import { trpc } from "@/providers/trpc";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BookOpenCheck,
  ClipboardList,
  Percent,
  ScanSearch,
  Upload,
} from "lucide-react";
import { useNavigate } from "react-router";

const PLATFORM_COLORS = ["#2563eb", "#ea580c", "#16a34a", "#9333ea", "#ca8a04", "#0891b2"];

const PLATFORM_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(PLATFORMS).map(([k, v]) => [k, v.label]),
);

function platformLabel(code: string): string {
  return PLATFORM_LABELS[code] ?? code;
}

function categoryMeta(category: string) {
  const meta = CATEGORIES[category as CategoryKey];
  return meta ?? { label: category, color: "#64748b" };
}

export default function Analytics() {
  const navigate = useNavigate();
  const { data, isLoading } = trpc.analytics.overview.useQuery();

  const categoryData = (data?.hitsByCategory ?? []).map((h) => ({
    name: categoryMeta(h.category).label,
    count: h.count,
    color: categoryMeta(h.category).color,
  }));
  const platformData = (data?.hitsByPlatform ?? []).map((h) => ({
    name: platformLabel(h.platform),
    value: h.count,
  }));

  return (
    <AuthLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">合规数据看板</h1>
            <p className="text-sm text-muted-foreground mt-1">
              送审通过率 · 驳回原因分布 · 规则更新推送
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/submit")}>
            <Upload className="mr-2 h-4 w-4" /> 新建送检
          </Button>
        </div>

        {/* 顶部统计卡 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> 累计送检
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {isLoading ? "…" : (data?.totalSubmissions ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                部剧本 · 完成预检 {data?.completedCount ?? 0} 部
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Percent className="h-4 w-4 text-green-600" /> 预检通过率
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {isLoading
                  ? "…"
                  : data?.passRate != null
                    ? `${(data.passRate * 100).toFixed(1)}%`
                    : "—"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">低风险占比（预检口径）</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-600" /> 累计命中风险点
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {isLoading ? "…" : (data?.totalHits ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">覆盖 8 类违规划分</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BookOpenCheck className="h-4 w-4 text-blue-900" /> 当前规则版本
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-blue-900 truncate">
                {isLoading ? "…" : (data?.currentRuleVersion ?? "—")}
              </div>
              <p className="text-xs text-muted-foreground mt-1">规则库最新入库版本</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-72 w-full" />
            ))}
          </div>
        ) : !data || data.totalSubmissions === 0 ? (
          <Card>
            <CardContent className="text-center py-16 text-muted-foreground">
              <ScanSearch className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium text-foreground">还没有送检数据</p>
              <p className="text-sm mt-1">
                先去新建一次剧本预检，通过率、命中分布与趋势图将在这里自动生成
              </p>
              <Button className="mt-5" onClick={() => navigate("/submit")}>
                <Upload className="mr-2 h-4 w-4" /> 去新建送检
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 图表区 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">违规类别分布</CardTitle>
                </CardHeader>
                <CardContent className="h-72">
                  {categoryData.length === 0 ? (
                    <p className="text-sm text-muted-foreground pt-10 text-center">
                      暂无命中记录
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={categoryData}
                        layout="vertical"
                        margin={{ top: 4, right: 24, bottom: 4, left: 16 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" name="命中数" radius={[0, 4, 4, 0]}>
                          {categoryData.map((d) => (
                            <Cell key={d.name} fill={d.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">平台口径命中分布</CardTitle>
                </CardHeader>
                <CardContent className="h-72">
                  {platformData.length === 0 ? (
                    <p className="text-sm text-muted-foreground pt-10 text-center">
                      暂无命中记录
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={platformData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={56}
                          outerRadius={88}
                          paddingAngle={2}
                          label={({ name, percent }) =>
                            `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                          }
                        >
                          {platformData.map((d, i) => (
                            <Cell
                              key={d.name}
                              fill={PLATFORM_COLORS[i % PLATFORM_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">近 8 周送检 / 命中趋势</CardTitle>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.weeklyTrend} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="submissions"
                        name="送检量"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="hits"
                        name="命中数"
                        stroke="#ea580c"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">高频命中规则 Top 5</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.topRules.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-10 text-center">
                      暂无命中记录
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-32">规则编号</TableHead>
                          <TableHead>规则名称</TableHead>
                          <TableHead className="w-24 text-right">命中次数</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.topRules.map((r) => (
                          <TableRow key={r.ruleCode}>
                            <TableCell className="font-mono text-xs">{r.ruleCode}</TableCell>
                            <TableCell className="text-sm">{r.ruleName}</TableCell>
                            <TableCell className="text-right font-semibold">{r.count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* 规则更新推送 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">规则库更新推送</CardTitle>
            <p className="text-xs text-muted-foreground">
              政策发布后≤5个工作日入库，历史报告按送检时规则版本留痕可溯
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !data || data.ruleVersions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">暂无规则版本记录</p>
            ) : (
              <ol className="relative border-l border-slate-200 ml-2 space-y-5">
                {data.ruleVersions.map((v) => (
                  <li key={v.version} className="ml-5">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-blue-900" />
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span className="font-semibold">{v.version}</span>
                      <span className="text-xs text-muted-foreground">
                        {v.ruleCount} 条规则 · {new Date(v.createdAt).toLocaleString("zh-CN")}
                      </span>
                    </div>
                    {v.note && <p className="text-sm text-muted-foreground mt-0.5">{v.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground leading-relaxed">
          口径说明：驳回原因分布为预检命中口径，非平台实际驳回数据；平台驳回回传接入后此处将切换为真实驳回分布。预检通过率为低风险结论占已完成预检的比例，不构成过审保证。
        </p>
      </div>
    </AuthLayout>
  );
}
