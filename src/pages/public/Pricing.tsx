import { useState } from "react";
import { PLANS, PLAN_ORDER, type PlanCode } from "@contracts/constants";
import LeadForm from "@/components/LeadForm";
import { LOGIN_PATH } from "@/const";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type LocalizedPlan = {
  name: string;
  priceText: string;
  periodText: string;
  features: string[];
  cta: string;
};

export default function Pricing() {
  const { t } = useTranslation();
  useDocumentTitle(t("pricing.docTitle"));

  const [leadPlan, setLeadPlan] = useState<PlanCode | null>(null);

  // 展示文案走 i18n（zh/en 双语）；额度/高亮等业务口径仍以 contracts 为准
  const localizedPlans = t("pricing.plans", { returnObjects: true }) as Record<
    PlanCode,
    LocalizedPlan
  >;
  const notes = t("pricing.notes", { returnObjects: true }) as string[];

  const handleCta = (code: PlanCode) => {
    if (code === "free") {
      // 免费档：直接引导注册登录
      window.location.href = LOGIN_PATH;
    } else {
      // 付费档：打开留资表单（source=pricing，planInterest=对应 planCode）
      setLeadPlan(code);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <section className="text-center mb-14">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          {t("pricing.title")}
        </h1>
        <p className="mt-4 text-stone-500 max-w-2xl mx-auto">
          {t("pricing.subtitle")}
        </p>
      </section>

      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {PLAN_ORDER.map((code) => {
          const plan = PLANS[code];
          const lp = localizedPlans[code];
          const highlight = Boolean(plan.highlight);
          return (
            <Card
              key={code}
              className={`relative flex flex-col ${
                highlight
                  ? "border-amber-700 border-2 shadow-md bg-amber-50/40"
                  : "border-stone-200 bg-white"
              }`}
            >
              {highlight && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-800 text-white hover:bg-amber-800">
                  {t("pricing.popularBadge")}
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="text-lg">{lp.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-stone-900">
                    {lp.priceText}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-1">{lp.periodText}</p>
              </CardHeader>
              <CardContent className="flex flex-col flex-1">
                <ul className="space-y-2 text-sm text-stone-600 flex-1">
                  {lp.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-amber-800 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`mt-6 w-full ${
                    highlight
                      ? "bg-amber-800 hover:bg-amber-900 text-white"
                      : ""
                  }`}
                  variant={highlight ? "default" : "outline"}
                  onClick={() => handleCta(code)}
                >
                  {lp.cta}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-8">
        <h2 className="text-xl font-semibold mb-4">{t("pricing.notesTitle")}</h2>
        <ul className="space-y-2 text-sm text-stone-600 leading-relaxed list-disc pl-5">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-stone-500">{t("pricing.notesFooter")}</p>
      </section>

      <Dialog open={leadPlan !== null} onOpenChange={(o) => !o && setLeadPlan(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("pricing.dialogTitle")}
              {leadPlan ? ` · ${localizedPlans[leadPlan].name}` : ""}
            </DialogTitle>
            <DialogDescription>{t("pricing.dialogDesc")}</DialogDescription>
          </DialogHeader>
          {leadPlan && (
            <LeadForm source="pricing" planInterest={leadPlan} compact />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
