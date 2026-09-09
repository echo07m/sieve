import { useRef, useState } from "react";
import AuthLayout from "@/components/AuthLayout";
import LeadForm from "@/components/LeadForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/providers/trpc";
import { PLANS, PLAN_ORDER, type PlanCode } from "@contracts/constants";
import { Check, CreditCard } from "lucide-react";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("zh-CN");
}

/** 计费中心：当前方案与用量 + 四档方案对比留资 */
export default function Billing() {
  const { data, isLoading } = trpc.billing.myPlan.useQuery();
  const [openForm, setOpenForm] = useState<PlanCode | null>(null);
  const plansRef = useRef<HTMLDivElement>(null);

  const sub = data?.subscription;
  const currentPlan = data?.plan;
  const unlimited = sub?.quotaTotal === -1;
  const percent =
    sub && !unlimited && sub.quotaTotal > 0
      ? Math.min(100, Math.round((sub.quotaUsed / sub.quotaTotal) * 100))
      : 0;

  const scrollToPlans = () =>
    plansRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <AuthLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">计费与用量</h1>
          <p className="text-sm text-muted-foreground mt-1">
            查看当前方案与检测额度；平台内不接在线支付，留资后由商务开通付费方案
          </p>
        </div>

        {/* 当前方案 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" /> 当前方案
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || !sub || !currentPlan ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-4 w-56" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xl font-semibold">{sub.planName}</span>
                  <Badge variant="secondary">{currentPlan.priceText}</Badge>
                  {sub.expiresAt && (
                    <span className="text-sm text-muted-foreground">
                      到期时间：{formatDate(sub.expiresAt)}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">检测额度</span>
                    {unlimited ? (
                      <span className="font-medium">不限量</span>
                    ) : (
                      <span className="font-medium">
                        已用 {sub.quotaUsed} / {sub.quotaTotal} 次
                      </span>
                    )}
                  </div>
                  {!unlimited && <Progress value={percent} className="h-2" />}
                </div>
                {sub.note && (
                  <p className="text-sm text-muted-foreground">备注：{sub.note}</p>
                )}
                <div className="flex gap-3 pt-1">
                  <Button onClick={scrollToPlans}>续费 / 升级方案</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 方案对比 */}
        <div ref={plansRef} className="space-y-4 scroll-mt-6">
          <h2 className="text-lg font-semibold">全部方案</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PLAN_ORDER.map((code) => {
              const plan = PLANS[code];
              const isCurrent = sub?.planCode === code;
              const formOpen = openForm === code;
              return (
                <Card
                  key={code}
                  className={
                    plan.highlight
                      ? "border-2 border-amber-700/40 flex flex-col"
                      : "flex flex-col"
                  }
                >
                  <CardHeader className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{plan.name}</CardTitle>
                      {plan.highlight && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-900">
                          推荐
                        </Badge>
                      )}
                      {isCurrent && <Badge>当前方案</Badge>}
                    </div>
                    <div className="text-xl font-semibold">{plan.priceText}</div>
                    <p className="text-xs text-muted-foreground">{plan.periodText}</p>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4">
                    <ul className="space-y-1.5 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-1.5 text-sm text-muted-foreground">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {isCurrent ? (
                      <Button variant="outline" disabled>
                        当前使用中的方案
                      </Button>
                    ) : formOpen ? (
                      <div className="space-y-3">
                        <LeadForm source="pricing" planInterest={code} compact />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => setOpenForm(null)}
                        >
                          收起
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant={plan.highlight ? "default" : "outline"}
                        onClick={() => setOpenForm(code)}
                      >
                        {plan.cta}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
