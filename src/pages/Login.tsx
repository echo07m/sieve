import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { BadgeCheck, FileCheck, ShieldCheck } from "lucide-react";
import { Link } from "react-router";

function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL;
  const appID = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${kimiAuthUrl}/api/oauth/authorize`);
  url.searchParams.set("client_id", appID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);

  return url.toString();
}

const valuePoints = [
  { icon: BadgeCheck, text: "免费 3 次试检，注册即用" },
  { icon: ShieldCheck, text: "覆盖 8 大违规类别，适配广电总局新规" },
  { icon: FileCheck, text: "报告留痕存证，口径可回溯" },
];

export default function Login() {
  useDocumentTitle("登录 - 剧合规");

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <Card className="w-full max-w-sm border-stone-200">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <ShieldCheck className="h-10 w-10 text-amber-800" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">剧合规</CardTitle>
          <p className="text-sm text-stone-500">AI短剧/漫剧上线前合规预检</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="space-y-2.5">
            {valuePoints.map((v) => (
              <li key={v.text} className="flex items-center gap-2 text-sm text-stone-600">
                <v.icon className="h-4 w-4 text-amber-800 shrink-0" />
                <span>{v.text}</span>
              </li>
            ))}
          </ul>
          <Button
            className="w-full bg-amber-800 hover:bg-amber-900 text-white"
            size="lg"
            onClick={() => {
              window.location.href = getOAuthUrl();
            }}
          >
            使用 Kimi 账号登录
          </Button>
          <p className="text-center text-sm">
            <Link to="/" className="text-stone-500 hover:text-amber-900 transition-colors">
              返回首页
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
