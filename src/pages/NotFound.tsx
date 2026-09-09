import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Link } from "react-router";

export default function NotFound() {
  useDocumentTitle("页面不存在 - 剧合规");

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <Card className="w-full max-w-sm text-center border-stone-200">
        <CardHeader>
          <CardTitle className="text-4xl font-bold">404</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="font-medium">页面不存在</p>
          <p className="text-sm text-muted-foreground">
            您访问的页面不存在或已被移除，请检查链接是否正确。
          </p>
          <Button asChild className="w-full bg-amber-800 hover:bg-amber-900 text-white">
            <Link to="/">返回首页</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
