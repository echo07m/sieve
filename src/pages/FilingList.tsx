import AuthLayout from "@/components/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PLATFORMS, WORK_TYPES } from "@contracts/constants";
import { trpc } from "@/providers/trpc";
import { FileCheck, Plus } from "lucide-react";
import { useNavigate } from "react-router";

export default function FilingList() {
  const navigate = useNavigate();
  const { data: filings, isLoading } = trpc.filing.list.useQuery();

  return (
    <AuthLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">备案材料</h1>
            <p className="text-sm text-muted-foreground mt-1">
              按平台通道模板生成作品信息表、剧本纲要、成本核算三件套，含分层判定
            </p>
          </div>
          <Button onClick={() => navigate("/filing/new")}>
            <Plus className="mr-2 h-4 w-4" /> 生成备案材料
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : !filings?.length ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <FileCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>还没有备案材料包</p>
              <Button className="mt-4" variant="outline" onClick={() => navigate("/filing/new")}>
                生成第一份
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filings.map((f) => (
              <Card
                key={f.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/filing/${f.id}`)}
              >
                <CardContent className="pt-6 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">《{f.workTitle}》</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {WORK_TYPES[f.workType].label} · {f.episodeCount} 集 · 投资{" "}
                      {Number(f.investment)} 万元 ·{" "}
                      {PLATFORMS[f.targetPlatform as keyof typeof PLATFORMS]?.label ??
                        f.targetPlatform}{" "}
                      · {new Date(f.createdAt).toLocaleString("zh-CN")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {f.tierResult && (
                      <Badge variant="outline">{f.tierResult.tier}</Badge>
                    )}
                    {(f.missingFields?.length ?? 0) > 0 ? (
                      <Badge variant="destructive">缺 {f.missingFields?.length} 项</Badge>
                    ) : (
                      <Badge className="bg-green-600 text-white">字段完整</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
