import AuthLayout from "@/components/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PLATFORMS, VERDICTS, WORK_TYPES } from "@contracts/constants";
import { trpc } from "@/providers/trpc";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router";

export default function Submissions() {
  const navigate = useNavigate();
  const { data: submissions, isLoading } = trpc.submissions.list.useQuery();

  return (
    <AuthLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">送检记录</h1>
          <Button onClick={() => navigate("/submit")}>
            <Plus className="mr-2 h-4 w-4" /> 新建送检
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !submissions?.length ? (
              <p className="text-center text-muted-foreground py-12">暂无送检记录</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>作品</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>平台口径</TableHead>
                    <TableHead>集数</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>预检结论</TableHead>
                    <TableHead>送检时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((s) => (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/submissions/${s.id}`)}
                    >
                      <TableCell className="font-medium">{s.workTitle}</TableCell>
                      <TableCell>{WORK_TYPES[s.workType].label}</TableCell>
                      <TableCell>{PLATFORMS[s.targetPlatform as keyof typeof PLATFORMS]?.label ?? s.targetPlatform}</TableCell>
                      <TableCell>{s.episodeCount}</TableCell>
                      <TableCell>
                        {s.status === "completed" ? (
                          <Badge variant="secondary">已完成</Badge>
                        ) : s.status === "failed" ? (
                          <Badge variant="destructive">失败</Badge>
                        ) : (
                          <Badge variant="outline">处理中</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {s.verdict ? (
                          <span style={{ color: VERDICTS[s.verdict].color }} className="font-medium">
                            {VERDICTS[s.verdict].label}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(s.createdAt).toLocaleString("zh-CN")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
