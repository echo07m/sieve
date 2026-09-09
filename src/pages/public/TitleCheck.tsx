import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LOGIN_PATH } from "@/const";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { trpc } from "@/providers/trpc";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  ScanText,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type TitleCheckInput = { title: string; promoCopy?: string };

const VERDICT_UI = {
  high_risk: {
    className: "bg-red-600 text-white hover:bg-red-600",
    Icon: ShieldAlert,
  },
  attention: {
    className: "bg-amber-500 text-white hover:bg-amber-500",
    Icon: AlertTriangle,
  },
  low_risk: {
    className: "bg-green-600 text-white hover:bg-green-600",
    Icon: ShieldCheck,
  },
} as const;

const SEVERITY_UI = {
  block: { className: "bg-red-100 text-red-700 border-red-200" },
  high: { className: "bg-orange-100 text-orange-700 border-orange-200" },
  notice: { className: "bg-blue-100 text-blue-700 border-blue-200" },
} as const;

/** 片名快检（公开获客工具）：依据广电总局片名审核口径，免登录、IP 限流 */
export default function TitleCheck() {
  const { t } = useTranslation();
  useDocumentTitle(t("titleCheck.docTitle"));

  const [title, setTitle] = useState("");
  const [promoCopy, setPromoCopy] = useState("");
  const [queryInput, setQueryInput] = useState<TitleCheckInput | null>(null);

  const query = trpc.tools.titleCheck.useQuery(queryInput ?? { title: "" }, {
    enabled: queryInput !== null,
    retry: false,
    staleTime: 60_000,
  });

  const run = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error(t("titleCheck.toastNoTitle"));
      return;
    }
    if (trimmed.length > 64) {
      toast.error(t("titleCheck.toastTooLong"));
      return;
    }
    setQueryInput({ title: trimmed, promoCopy: promoCopy.trim() || undefined });
  };

  const result = queryInput ? query.data : undefined;
  const error = queryInput ? query.error : null;
  const checking = queryInput !== null && query.isFetching;
  const verdictUi = result ? VERDICT_UI[result.verdict as keyof typeof VERDICT_UI] : null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      {/* Hero */}
      <section className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1 text-xs text-stone-500 mb-5">
          {t("titleCheck.badge")}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t("titleCheck.title")}</h1>
        <p className="mt-4 text-stone-500 max-w-xl mx-auto">
          {t("titleCheck.subtitle")}
        </p>
      </section>

      {/* 输入卡片 */}
      <Card className="border-stone-200 bg-white mb-8">
        <CardHeader>
          <CardTitle className="text-lg">{t("titleCheck.cardTitle")}</CardTitle>
          <CardDescription>{t("titleCheck.cardDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tc-title">{t("titleCheck.titleLabel")}</Label>
            <Input
              id="tc-title"
              placeholder={t("titleCheck.titlePlaceholder")}
              value={title}
              maxLength={64}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tc-promo">{t("titleCheck.promoLabel")}</Label>
            <Textarea
              id="tc-promo"
              rows={3}
              placeholder={t("titleCheck.promoPlaceholder")}
              value={promoCopy}
              maxLength={500}
              onChange={(e) => setPromoCopy(e.target.value)}
            />
          </div>
          <Button
            className="w-full bg-amber-800 hover:bg-amber-900 text-white"
            size="lg"
            onClick={run}
            disabled={checking}
          >
            {checking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("titleCheck.checking")}
              </>
            ) : (
              <>
                <ScanText className="mr-2 h-4 w-4" /> {t("titleCheck.run")}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 错误提示（含限流） */}
      {error && (
        <Alert className="border-red-200 bg-red-50 mb-8">
          <AlertTriangle className="h-4 w-4 text-red-700" />
          <AlertDescription className="text-sm text-red-700">
            {error.message || t("titleCheck.errorFallback")}
          </AlertDescription>
        </Alert>
      )}

      {/* 结果区 */}
      {result && verdictUi && (
        <div className="space-y-6">
          <Card className="border-stone-200 bg-white">
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-3">
                <verdictUi.Icon className="h-8 w-8 shrink-0" style={{
                  color: result.verdict === "high_risk" ? "#dc2626" : result.verdict === "attention" ? "#d97706" : "#16a34a",
                }} />
                <Badge className={`text-sm px-3 py-1 ${verdictUi.className}`}>
                  {t(`titleCheck.verdicts.${result.verdict}`)}
                </Badge>
                <span className="text-sm text-stone-500">
                  {t("titleCheck.checkedRules", {
                    title: result.title,
                    count: result.checkedRules,
                  })}
                </span>
              </div>
            </CardContent>
          </Card>

          {result.hits.length === 0 ? (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-green-700 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-green-800">{t("titleCheck.noHitTitle")}</p>
                  <p className="text-sm text-green-700 mt-1">
                    {t("titleCheck.noHitDesc")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {result.hits.map((h, i) => (
                <Card key={`${h.ruleCode}-${i}`} className="border-stone-200 bg-white">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={SEVERITY_UI[h.severity].className}>
                        {t(`titleCheck.severities.${h.severity}`)}
                      </Badge>
                      <span className="font-medium">{h.ruleName}</span>
                      <span className="text-xs text-stone-400 font-mono">{h.ruleCode}</span>
                      <span className="text-xs text-stone-500 ml-auto">{h.matched}</span>
                    </div>
                    <div className="text-xs text-stone-500 leading-relaxed">
                      <span className="font-medium text-stone-600">{t("titleCheck.basis")}</span>
                      {h.basis}
                    </div>
                    <div className="text-sm leading-relaxed">
                      <span className="font-medium">{t("titleCheck.remediation")}</span>
                      {h.remediation}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* CTA */}
          <Card className="border-amber-200 bg-amber-50/60">
            <CardContent className="pt-6 text-center space-y-4">
              <p className="text-sm text-stone-600 leading-relaxed">{result.note}</p>
              <Button
                size="lg"
                className="bg-amber-800 hover:bg-amber-900 text-white"
                onClick={() => (window.location.href = LOGIN_PATH)}
              >
                {t("titleCheck.ctaButton")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
