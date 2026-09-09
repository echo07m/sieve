import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { LOGIN_PATH } from "@/const";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Clapperboard,
  Compass,
  Loader2,
  ShieldAlert,
  Sparkles,
  User,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type WorkType = "ai_drama" | "ai_comic" | "live_drama";

type WizardInput = {
  workType: WorkType;
  investment: number;
  aiShare?: { script: number; visual: number; voice: number };
};

const WORK_TYPE_ICONS: Record<WorkType, typeof Sparkles> = {
  ai_drama: Sparkles,
  ai_comic: Clapperboard,
  live_drama: User,
};
const WORK_TYPE_VALUES: WorkType[] = ["ai_drama", "ai_comic", "live_drama"];

const AI_SHARE_KEYS = ["script", "visual", "voice"] as const;

const TIER_UI = {
  key: { className: "bg-red-100 text-red-700 border-red-200" },
  normal: { className: "bg-amber-100 text-amber-700 border-amber-200" },
  other: { className: "bg-green-100 text-green-700 border-green-200" },
} as const;

/** 备案导航向导（公开获客工具）：分层判定 + AI 占比自评 → 标注义务 + 材料清单 */
export default function FilingWizard() {
  const { t } = useTranslation();
  useDocumentTitle(t("filingWizard.docTitle"));

  const [workType, setWorkType] = useState<WorkType>("ai_drama");
  const [investment, setInvestment] = useState("");
  const [aiShare, setAiShare] = useState({ script: 50, visual: 80, voice: 30 });
  const [queryInput, setQueryInput] = useState<WizardInput | null>(null);
  const [checkedMaterials, setCheckedMaterials] = useState<Record<string, boolean>>({});

  const query = trpc.filing.wizardAssess.useQuery(
    queryInput ?? { workType: "ai_drama", investment: 0 },
    { enabled: queryInput !== null, retry: false, staleTime: 60_000 },
  );

  const isAI = workType !== "live_drama";

  const run = () => {
    const inv = Number(investment);
    if (!investment.trim() || !Number.isFinite(inv) || inv < 0) {
      toast.error(t("filingWizard.toastInvalidInvestment"));
      return;
    }
    setCheckedMaterials({});
    setQueryInput({
      workType,
      investment: inv,
      aiShare: isAI ? { ...aiShare } : undefined,
    });
  };

  const result = queryInput ? query.data : undefined;
  const error = queryInput ? query.error : null;
  const loading = queryInput !== null && query.isFetching;

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      {/* Hero */}
      <section className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1 text-xs text-stone-500 mb-5">
          {t("filingWizard.badge")}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t("filingWizard.title")}</h1>
        <p className="mt-4 text-stone-500 max-w-xl mx-auto">
          {t("filingWizard.subtitle")}
        </p>
      </section>

      {/* 表单 */}
      <div className="space-y-6 mb-8">
        <Card className="border-stone-200 bg-white">
          <CardHeader>
            <CardTitle className="text-lg">{t("filingWizard.step1Title")}</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-3">
            {WORK_TYPE_VALUES.map((value) => {
              const Icon = WORK_TYPE_ICONS[value];
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setWorkType(value)}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-colors",
                    workType === value
                      ? "border-amber-700 bg-amber-50/60 ring-1 ring-amber-700"
                      : "border-stone-200 bg-white hover:border-stone-300",
                  )}
                >
                  <Icon className="h-6 w-6 text-amber-800 mb-2" />
                  <p className="font-medium">{t(`filingWizard.workTypes.${value}.label`)}</p>
                  <p className="text-xs text-stone-500 mt-1">
                    {t(`filingWizard.workTypes.${value}.desc`)}
                  </p>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-stone-200 bg-white">
          <CardHeader>
            <CardTitle className="text-lg">{t("filingWizard.step2Title")}</CardTitle>
            <CardDescription>{t("filingWizard.step2Desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              min={0}
              step={1}
              placeholder={t("filingWizard.investPlaceholder")}
              value={investment}
              onChange={(e) => setInvestment(e.target.value)}
              className="max-w-xs"
            />
          </CardContent>
        </Card>

        {isAI && (
          <Card className="border-stone-200 bg-white">
            <CardHeader>
              <CardTitle className="text-lg">{t("filingWizard.step3Title")}</CardTitle>
              <CardDescription>{t("filingWizard.step3Desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {AI_SHARE_KEYS.map((key) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t(`filingWizard.aiFields.${key}`)}</Label>
                    <span className="text-sm font-mono text-stone-600">{aiShare[key]}%</span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[aiShare[key]]}
                    onValueChange={([v]) => setAiShare((prev) => ({ ...prev, [key]: v }))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Button
          className="w-full bg-amber-800 hover:bg-amber-900 text-white"
          size="lg"
          onClick={run}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("filingWizard.generating")}
            </>
          ) : (
            <>
              <Compass className="mr-2 h-4 w-4" /> {t("filingWizard.generate")}
            </>
          )}
        </Button>
      </div>

      {/* 错误提示（含限流） */}
      {error && (
        <Alert className="border-red-200 bg-red-50 mb-8">
          <AlertTriangle className="h-4 w-4 text-red-700" />
          <AlertDescription className="text-sm text-red-700">
            {error.message || t("filingWizard.errorFallback")}
          </AlertDescription>
        </Alert>
      )}

      {/* 结果区 */}
      {result && (
        <div className="space-y-6">
          <Card className="border-stone-200 bg-white">
            <CardHeader>
              <CardTitle className="text-lg">{t("filingWizard.tierTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className={cn("text-sm px-3 py-1", TIER_UI[result.tierCode].className)}>
                  {result.tier}
                </Badge>
                <span className="text-sm text-stone-700">{result.filingPath}</span>
              </div>
              <p className="text-sm text-stone-600 leading-relaxed">{result.basisNote}</p>
              <p className="text-xs text-stone-400 leading-relaxed">{result.standardNote}</p>
            </CardContent>
          </Card>

          {result.markingDuties.length > 0 && (
            <Card className="border-stone-200 bg-white">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-800" /> {t("filingWizard.markingTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.markingDuties.map((d) => (
                    <li key={d} className="flex items-start gap-2 text-sm text-stone-700">
                      <ShieldAlert className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
                      <span className="leading-relaxed">{d}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card className="border-stone-200 bg-white">
            <CardHeader>
              <CardTitle className="text-lg">{t("filingWizard.materialsTitle")}</CardTitle>
              <CardDescription>{t("filingWizard.materialsDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {result.materials.map((m) => (
                  <li key={m} className="flex items-start gap-3">
                    <Checkbox
                      id={`wizard-mat-${m}`}
                      checked={checkedMaterials[m] ?? false}
                      onCheckedChange={(v) =>
                        setCheckedMaterials((prev) => ({ ...prev, [m]: v === true }))
                      }
                      className="mt-0.5"
                    />
                    <label htmlFor={`wizard-mat-${m}`} className="text-sm text-stone-700 leading-relaxed cursor-pointer">
                      {m}
                    </label>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* CTA */}
          <Card className="border-amber-200 bg-amber-50/60">
            <CardContent className="pt-6 text-center space-y-4">
              <p className="text-sm text-stone-600 leading-relaxed">{result.cta}</p>
              <Button
                size="lg"
                className="bg-amber-800 hover:bg-amber-900 text-white"
                onClick={() => (window.location.href = LOGIN_PATH)}
              >
                {t("filingWizard.ctaButton")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
