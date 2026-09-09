import AuthLayout from "@/components/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { VERDICTS } from "@contracts/constants";
import { trpc } from "@/providers/trpc";
import { ArrowRight, FileWarning, ScanSearch, ShieldAlert, Upload } from "lucide-react";
import { useNavigate } from "react-router";

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: submissions, isLoading } = trpc.submissions.list.useQuery();
  const { data: ruleData } = trpc.rules.list.useQuery();

  const total = submissions?.length ?? 0;
  const highRisk = submissions?.filter((s) => s.verdict === "high_risk").length ?? 0;
  const attention = submissions?.filter((s) => s.verdict === "attention").length ?? 0;
  const activeRules = ruleData?.rules.filter((r) => r.status === "active").length ?? 0;

  return (
    <AuthLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">工作台</h1>
            <p className="text-sm text-muted-foreground mt-1">
              当前规则库版本：{ruleData?.currentVersion?.version ?? "—"}（生效规则 {activeRules} 条）
            </p>
          </div>
          <Button onClick={() => navigate("/submit")}>
            <Upload className="mr-2 h-4 w-4" /> 新建送检
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ScanSearch className="h-4 w-4" /> 累计送检
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{isLoading ? "…" : total}</div>
              <p className="text-xs text-muted-foreground mt-1">部（剧本预检）</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-600" /> 高风险须整改
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{isLoading ? "…" : highRisk}</div>
              <p className="text-xs text-muted-foreground mt-1">含阻断级命中</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileWarning className="h-4 w-4 text-orange-600" /> 需关注
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{isLoading ? "…" : attention}</div>
              <p className="text-xs text-muted-foreground mt-1">含高危命中</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">规则库底座</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900">{activeRules}</div>
              <p className="text-xs text-muted-foreground mt-1">覆盖 8 类违规 + 形式要件</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">最近送检</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/submissions")}>
              全部记录 <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !submissions?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <ScanSearch className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>还没有送检记录</p>
                <Button className="mt-4" variant="outline" onClick={() => navigate("/submit")}>
                  上传第一部剧本
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {submissions.slice(0, 5).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/submissions/${s.id}`)}
                    className="w-full flex items-center justify-between py-3 hover:bg-slate-50 px-2 rounded transition-colors text-left"
                  >
                    <div>
                      <div className="font-medium">{s.workTitle}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.episodeCount} 集 · {new Date(s.createdAt).toLocaleString("zh-CN")}
                      </div>
                    </div>
                    {s.verdict ? (
                      <Badge
                        variant="outline"
                        style={{
                          color: VERDICTS[s.verdict].color,
                          borderColor: VERDICTS[s.verdict].color,
                        }}
                      >
                        {VERDICTS[s.verdict].label}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{s.status === "processing" ? "检测中" : s.status}</Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
