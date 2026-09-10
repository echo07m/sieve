import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { trpc } from "@/providers/trpc";
import { BadgeCheck, FileCheck, Github, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

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
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const providers = trpc.authLocal.enabledProviders.useQuery();
  const githubEnabled = providers.data?.includes("github") ?? false;

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const onSuccess = async () => {
    await utils.invalidate();
    navigate("/dashboard");
  };

  const login = trpc.authLocal.login.useMutation({
    onSuccess: () => { toast.success("登录成功"); void onSuccess(); },
    onError: (e) => toast.error(e.message),
  });
  const register = trpc.authLocal.register.useMutation({
    onSuccess: () => { toast.success("注册成功，已自动登录"); void onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

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
        <CardContent className="space-y-5">
          <ul className="space-y-2.5">
            {valuePoints.map((v) => (
              <li key={v.text} className="flex items-center gap-2 text-sm text-stone-600">
                <v.icon className="h-4 w-4 text-amber-800 shrink-0" />
                <span>{v.text}</span>
              </li>
            ))}
          </ul>

          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">登录</TabsTrigger>
              <TabsTrigger value="register">注册</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-3 pt-3">
              <div>
                <Label htmlFor="identifier">用户名或邮箱</Label>
                <Input
                  id="identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="用户名 / 邮箱"
                  autoComplete="username"
                />
              </div>
              <div>
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 8 位"
                  autoComplete="current-password"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && identifier && password)
                      login.mutate({ identifier, password });
                  }}
                />
              </div>
              <Button
                className="w-full bg-amber-800 hover:bg-amber-900 text-white"
                disabled={!identifier || !password || login.isPending}
                onClick={() => login.mutate({ identifier, password })}
              >
                {login.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                登录
              </Button>
            </TabsContent>

            <TabsContent value="register" className="space-y-3 pt-3">
              <div>
                <Label htmlFor="reg-username">用户名</Label>
                <Input
                  id="reg-username"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="3-32 位中英文/数字/下划线"
                  autoComplete="username"
                />
              </div>
              <div>
                <Label htmlFor="reg-email">邮箱（可选，用于团队邀请匹配）</Label>
                <Input
                  id="reg-email"
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <Label htmlFor="reg-password">密码</Label>
                <Input
                  id="reg-password"
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="至少 8 位"
                  autoComplete="new-password"
                />
              </div>
              <Button
                className="w-full bg-amber-800 hover:bg-amber-900 text-white"
                disabled={!regUsername || !regPassword || register.isPending}
                onClick={() =>
                  register.mutate({
                    username: regUsername.trim(),
                    password: regPassword,
                    email: regEmail.trim() || undefined,
                  })
                }
              >
                {register.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                注册并登录
              </Button>
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-stone-400">其他方式</span>
            <Separator className="flex-1" />
          </div>

          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { window.location.href = getOAuthUrl(); }}
            >
              使用 Kimi 账号登录
            </Button>
            {githubEnabled && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { window.location.href = "/api/auth/github"; }}
              >
                <Github className="h-4 w-4 mr-2" />
                使用 GitHub 账号登录
              </Button>
            )}
          </div>

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
