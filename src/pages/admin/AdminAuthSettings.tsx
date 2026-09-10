import AuthLayout from "@/components/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/providers/trpc";
import { Github, KeyRound, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/** 后台管理 · 登录方式配置：第三方 OAuth 提供方（GitHub） */
export default function AdminAuthSettings() {
  const utils = trpc.useUtils();
  const providers = trpc.authLocal.getProviders.useQuery();

  const github = providers.data?.find((p) => p.provider === "github");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (github) {
      setClientId(github.clientId);
      setEnabled(github.enabled);
    }
  }, [github]);

  const save = trpc.authLocal.upsertProvider.useMutation({
    onSuccess: () => {
      toast.success("GitHub 登录配置已保存");
      setClientSecret("");
      utils.authLocal.getProviders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const callbackUrl = `${window.location.origin}/api/auth/github/callback`;

  return (
    <AuthLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <KeyRound className="h-6 w-6" /> 登录方式配置
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            用户名/邮箱 + 密码登录默认可用，无需配置。此处配置第三方 OAuth 提供方。
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Github className="h-5 w-5" /> GitHub 登录
              {github?.enabled ? <Badge>已启用</Badge> : <Badge variant="secondary">未启用</Badge>}
            </CardTitle>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Client ID</Label>
              <Input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="GitHub OAuth App 的 Client ID"
              />
            </div>
            <div>
              <Label>Client Secret{github?.hasSecret && "（已保存，留空则不修改）"}</Label>
              <Input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={github?.hasSecret ? "••••••••" : "GitHub OAuth App 的 Client Secret"}
              />
            </div>
            <div className="text-sm text-muted-foreground space-y-1 border rounded-md p-3 bg-muted/40">
              <p>1. 到 GitHub → Settings → Developer settings → OAuth Apps → New OAuth App</p>
              <p>
                2. Authorization callback URL 填写：
                <code className="ml-1 bg-background px-1 py-0.5 rounded text-xs">{callbackUrl}</code>
              </p>
              <p>3. 将 Client ID / Secret 填入上方并保存，开启开关后登录页即出现 GitHub 登录按钮</p>
            </div>
            <Button
              disabled={!clientId || (enabled && !github?.hasSecret && !clientSecret) || save.isPending}
              onClick={() =>
                save.mutate({
                  provider: "github",
                  clientId: clientId.trim(),
                  clientSecret: clientSecret || undefined,
                  enabled,
                })
              }
            >
              {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              保存
            </Button>
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
