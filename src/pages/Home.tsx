import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LOGIN_PATH } from "@/const";
import {
  ArrowRight,
  Compass,
  FileCheck,
  ScanSearch,
  ScanText,
  ShieldCheck,
  Stamp,
  TriangleAlert,
  CircleOff,
  Gauge,
} from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

type TextPair = { title: string; desc: string };
type QaPair = { q: string; a: string };

const featureIcons = [ScanSearch, FileCheck, Stamp];
const painIcons = [TriangleAlert, CircleOff, Gauge];
const freeToolMeta = [
  { icon: ScanText, to: "/tools/title-check" },
  { icon: Compass, to: "/tools/filing-wizard" },
];

export default function Home() {
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  const features = (
    t("home.features", { returnObjects: true }) as TextPair[]
  ).map((f, i) => ({ ...f, icon: featureIcons[i] }));
  const pains = (t("home.pains", { returnObjects: true }) as TextPair[]).map(
    (p, i) => ({ ...p, icon: painIcons[i] }),
  );
  const freeTools = (
    t("home.freeTools", { returnObjects: true }) as TextPair[]
  ).map((tool, i) => ({ ...tool, ...freeToolMeta[i] }));
  const homeFaqs = t("home.faqs", { returnObjects: true }) as QaPair[];
  const tags = t("home.tags", { returnObjects: true }) as string[];

  const footerLinks = [
    { to: "/features", label: t("nav.features") },
    { to: "/pricing", label: t("nav.pricing") },
    { to: "/tools/title-check", label: t("nav.titleCheck") },
    { to: "/tools/filing-wizard", label: t("nav.filingWizard") },
    { to: "/docs", label: t("nav.docs") },
    { to: "/faq", label: t("nav.faq") },
    { to: "/opensource", label: t("nav.opensource") },
  ];

  useEffect(() => {
    if (!isLoading && user) navigate("/dashboard", { replace: true });
  }, [isLoading, user, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-amber-800" />
            <span className="font-semibold text-lg tracking-tight">剧合规</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {t("footer.tagline")}
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-1 mr-2">
            {footerLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="px-3 py-2 text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button
              className="bg-amber-800 hover:bg-amber-900 text-white"
              onClick={() => (window.location.href = LOGIN_PATH)}
            >
              {t("home.loginDashboard")}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6">
        <section className="py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1 text-xs text-muted-foreground mb-6">
            {t("home.heroBadge")}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-stone-900 leading-tight">
            {t("home.heroTitlePre")}
            <span className="text-amber-800">{t("home.heroTitleHighlight")}</span>
            {t("home.heroTitlePost")}
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("home.heroDesc")}
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Button
              size="lg"
              className="bg-amber-800 hover:bg-amber-900 text-white"
              onClick={() => (window.location.href = LOGIN_PATH)}
            >
              {t("home.ctaPrimary")} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/pricing">{t("home.ctaPricing")}</Link>
            </Button>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-6 pb-20">
          {features.map((f) => (
            <Card key={f.title} className="border-stone-200">
              <CardContent className="pt-6">
                <f.icon className="h-8 w-8 text-amber-800 mb-4" />
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* 免费工具入口 */}
        <section className="pb-20">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-3">
            {t("home.freeToolsTitle")}
          </h2>
          <p className="text-center text-sm text-muted-foreground mb-10 max-w-2xl mx-auto">
            {t("home.freeToolsDesc")}
          </p>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {freeTools.map((tool) => (
              <Link key={tool.to} to={tool.to} className="block group">
                <Card className="border-stone-200 h-full transition-colors group-hover:border-amber-300">
                  <CardContent className="pt-6">
                    <tool.icon className="h-8 w-8 text-amber-800 mb-4" />
                    <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      {tool.title}
                      <ArrowRight className="h-4 w-4 text-stone-400 transition-transform group-hover:translate-x-0.5" />
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{tool.desc}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* 为什么需要上线前预检 */}
        <section className="pb-20">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-3">
            {t("home.painsTitle")}
          </h2>
          <p className="text-center text-sm text-muted-foreground mb-10 max-w-2xl mx-auto">
            {t("home.painsDesc")}
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {pains.map((p) => (
              <Card key={p.title} className="border-stone-200 bg-white">
                <CardContent className="pt-6">
                  <p.icon className="h-7 w-7 text-amber-800 mb-3" />
                  <h3 className="font-semibold mb-2">{p.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="pb-16">
          <div className="flex flex-wrap justify-center gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="text-xs border border-stone-200 rounded-full px-3 py-1 text-muted-foreground bg-white"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* FAQ 精简区 */}
        <section className="pb-20 max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-8">
            {t("home.faqTitle")}
          </h2>
          <Accordion type="single" collapsible>
            {homeFaqs.map((f, i) => (
              <AccordionItem key={f.q} value={`home-faq-${i}`}>
                <AccordionTrigger className="text-left text-base font-medium">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <p className="text-center mt-6 text-sm">
            <Link to="/faq" className="text-amber-800 hover:underline">
              {t("home.faqMore")}
            </Link>
          </p>
        </section>

        {/* 底部 CTA */}
        <section className="pb-20">
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-6 py-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
              {t("home.ctaTitle")}
            </h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-xl mx-auto">
              {t("home.ctaDesc")}
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Button
                size="lg"
                className="bg-amber-800 hover:bg-amber-900 text-white"
                onClick={() => (window.location.href = LOGIN_PATH)}
              >
                {t("home.ctaTrial")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/pricing">{t("home.ctaPricing")}</Link>
              </Button>
            </div>
          </div>
        </section>

        <footer className="border-t border-stone-200 py-8 text-center text-xs text-muted-foreground pb-12 space-y-3">
          <div className="flex justify-center items-center gap-6">
            {footerLinks.map((l) => (
              <Link key={l.to} to={l.to} className="hover:text-amber-900">
                {l.label}
              </Link>
            ))}
            <LanguageSwitcher compact />
          </div>
          <p>{t("footer.disclaimer")}</p>
        </footer>
      </main>
    </div>
  );
}
