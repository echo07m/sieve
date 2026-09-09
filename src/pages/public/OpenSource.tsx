import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { SITE } from "@contracts/site";
import {
  BookOpen,
  Check,
  Github,
  Handshake,
  Mail,
  ScrollText,
  Terminal,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

// 开源仓库地址
const GITHUB_REPO_URL = "https://github.com/echo07m/sieve";

type RoadmapGroup = {
  statusKey: "statusReleased" | "statusInProgress" | "statusPlanned";
  itemsKey: "roadmapReleased" | "roadmapInProgress" | "roadmapPlanned";
  badgeClass: string;
};

const ROADMAP_GROUPS: RoadmapGroup[] = [
  {
    statusKey: "statusReleased",
    itemsKey: "roadmapReleased",
    badgeClass: "bg-green-100 text-green-700 border-green-200",
  },
  {
    statusKey: "statusInProgress",
    itemsKey: "roadmapInProgress",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
  },
  {
    statusKey: "statusPlanned",
    itemsKey: "roadmapPlanned",
    badgeClass: "bg-stone-100 text-stone-600 border-stone-200",
  },
];

/** 开源社区页：开源协议要点、GitHub 仓库入口、快速部署、贡献指南与 Roadmap */
export default function OpenSource() {
  const { t } = useTranslation();
  useDocumentTitle(t("opensource.docTitle"));

  const licenseAllows = t("opensource.licenseAllows", {
    returnObjects: true,
  }) as string[];
  const licenseRestrictions = t("opensource.licenseRestrictions", {
    returnObjects: true,
  }) as string[];

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {/* Hero */}
      <section className="text-center mb-14">
        <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1 text-xs text-stone-500 mb-5">
          {t("opensource.heroBadge")}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          {t("opensource.heroTitle")}
        </h1>
        <p className="mt-4 text-stone-500 max-w-2xl mx-auto">
          {t("opensource.heroTagline")}
        </p>
      </section>

      {/* 三卡片区 */}
      <section className="grid md:grid-cols-3 gap-6 mb-16">
        {/* 开源协议要点 */}
        <Card className="border-stone-200 bg-white flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-amber-800" />
              {t("opensource.licenseTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            <ul className="space-y-2 text-sm text-stone-600">
              {licenseAllows.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
              {licenseRestrictions.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <X className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-stone-400">{t("opensource.licenseNote")}</p>
          </CardContent>
        </Card>

        {/* GitHub 仓库入口 */}
        <Card className="border-stone-200 bg-white flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Github className="h-5 w-5 text-amber-800" />
              {t("opensource.repoTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <p className="text-sm text-stone-600 leading-relaxed mb-4">
              {t("opensource.repoDesc")}
            </p>
            <div className="flex items-center gap-3 mb-6">
              <img
                src="https://img.shields.io/github/stars/echo07m/sieve?style=social"
                alt="GitHub stars"
                loading="lazy"
              />
              <img
                src="https://img.shields.io/github/forks/echo07m/sieve?style=social"
                alt="GitHub forks"
                loading="lazy"
              />
            </div>
            <Button
              className="mt-auto w-full bg-amber-800 hover:bg-amber-900 text-white"
              asChild
            >
              <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
                <Github className="mr-2 h-4 w-4" /> {t("opensource.repoCta")}
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* 快速部署 */}
        <Card className="border-stone-200 bg-white flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Terminal className="h-5 w-5 text-amber-800" />
              {t("opensource.deployTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <p className="text-sm text-stone-600 leading-relaxed mb-4">
              {t("opensource.deployDesc")}
            </p>
            <pre className="bg-stone-900 text-stone-100 text-xs rounded-md p-4 overflow-x-auto">
              <code>{t("opensource.deployCode")}</code>
            </pre>
          </CardContent>
        </Card>
      </section>

      {/* 贡献指南摘要 */}
      <section className="rounded-lg border border-stone-200 bg-white p-8 mb-16">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-amber-800" />
          {t("opensource.contributeTitle")}
        </h2>
        <p className="text-sm text-stone-600 leading-relaxed mb-4">
          {t("opensource.contributeDesc")}
        </p>
        <Button variant="outline" asChild>
          <Link to="/docs">{t("opensource.contributeCta")}</Link>
        </Button>
      </section>

      {/* 商务合作与赞助 */}
      <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-8 mb-16">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <Handshake className="h-5 w-5 text-amber-800" />
          {t("opensource.bizTitle")}
        </h2>
        <p className="text-sm text-stone-600 leading-relaxed mb-2">
          {t("opensource.bizDesc")}
        </p>
        <p className="text-sm text-stone-600 leading-relaxed mb-5">
          {t("opensource.bizSponsorNote")}
        </p>
        <Button
          variant="outline"
          className="border-amber-300 text-amber-900 hover:bg-amber-100"
          asChild
        >
          <a href={`mailto:${SITE.contactEmail}`}>
            <Mail className="mr-2 h-4 w-4" />
            {t("opensource.bizCta")}：{SITE.contactEmail}
          </a>
        </Button>
      </section>

      {/* Roadmap */}
      <section>
        <h2 className="text-2xl font-semibold tracking-tight mb-6 text-center">
          {t("opensource.roadmapTitle")}
        </h2>
        <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {ROADMAP_GROUPS.map((g) => {
            const items = t(`opensource.${g.itemsKey}`, {
              returnObjects: true,
            }) as string[];
            return (
              <Card key={g.statusKey} className="border-stone-200 bg-white">
                <CardContent className="pt-6">
                  <Badge variant="outline" className={g.badgeClass}>
                    {t(`opensource.${g.statusKey}`)}
                  </Badge>
                  <ul className="mt-4 space-y-2 text-sm text-stone-600">
                    {items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
