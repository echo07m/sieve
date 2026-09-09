import AuthLayout from "@/components/AuthLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PLATFORMS, WORK_TYPES } from "@contracts/constants";
import { trpc } from "@/providers/trpc";
import { AlertTriangle, CheckCircle2, ChevronLeft, Copy, FileDown } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

export default function FilingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const filingId = Number(id);
  const { data: filing, isLoading } = trpc.filing.detail.useQuery(
    { id: filingId },
    { enabled: Number.isFinite(filingId) },
  );

  if (isLoading) {
    return (
      <AuthLayout>
        <div className="p-6 max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AuthLayout>
    );
  }

  if (!filing) {
    return (
      <AuthLayout>
        <div className="p-6 text-center text-muted-foreground">备案材料不存在</div>
      </AuthLayout>
    );
  }

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("已复制到剪贴板");
  };

  return (
    <AuthLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6 print:p-2">
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" onClick={() => navigate("/filing")}>
            <ChevronLeft className="mr-1 h-4 w-4" /> 返回列表
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <FileDown className="mr-2 h-4 w-4" /> 导出（打印另存）
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold">《{filing.workTitle}》备案材料包</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {WORK_TYPES[filing.workType].label} · {filing.episodeCount} 集 × {filing.episodeDuration}{" "}
            分钟 · 投资 {Number(filing.investment)} 万元 ·{" "}
            {PLATFORMS[filing.targetPlatform as keyof typeof PLATFORMS]?.label ?? filing.targetPlatform}
          </p>
        </div>

        {/* 分层判定 */}
        {filing.tierResult && (
          <Alert className="border-blue-200 bg-blue-50">
            <AlertDescription>
              <div className="flex flex-wrap items-center gap-2 font-medium text-blue-900">
                分层判定：{filing.tierResult.tier}
                <Badge variant="outline" className="text-blue-900 border-blue-300">
                  {filing.tierResult.filingPath}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{filing.tierResult.basisNote}</p>
            </AlertDescription>
          </Alert>
        )}

        {/* 缺失字段 */}
        {(filing.missingFields?.length ?? 0) > 0 && (
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">缺失字段（{filing.missingFields?.length ?? 0} 项）：</span>
              <ul className="list-disc list-inside mt-1 text-sm">
                {(filing.missingFields ?? []).map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* 三件套 */}
        {(filing.materials ?? []).map((m) => (
          <Card key={m.key}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                {m.ready ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                )}
                {m.title}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => copy(m.content)}>
                <Copy className="mr-1 h-4 w-4" /> 复制
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-slate-50 rounded-lg p-4 font-sans">
                {m.content}
              </pre>
            </CardContent>
          </Card>
        ))}

        <p className="text-xs text-muted-foreground">
          提示：材料模板按通用口径生成，各平台自审通道字段可能略有差异；分层数字为企服解读口径，提交前请以广电总局原文复核。
        </p>
      </div>
    </AuthLayout>
  );
}
