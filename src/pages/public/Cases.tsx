import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { trpc } from "@/providers/trpc";
import { ExternalLink, Gavel, Scale, Search, ShieldAlert, Stamp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const CASE_TYPE_META: Record<string, { icon: typeof Gavel; color: string }> = {
  platform_action: { icon: ShieldAlert, color: "text-amber-700" },
  judicial: { icon: Scale, color: "text-slate-700" },
  regulatory: { icon: Stamp, color: "text-red-700" },
  rights_protection: { icon: Gavel, color: "text-emerald-700" },
};

/** 判例库：公开检索平台处置/司法判例/监管通报/维权事件，为报告提供佐证 */
export default function Cases() {
  const { t } = useTranslation();
  useDocumentTitle(t("cases.docTitle"));
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [caseType, setCaseType] = useState("all");
  const [page, setPage] = useState(1);

  const platforms = trpc.precedents.platforms.useQuery();
  const list = trpc.precedents.list.useQuery({
    keyword: search || undefined,
    platform: platform === "all" ? undefined : platform,
    caseType:
      caseType === "all"
        ? undefined
        : (caseType as "platform_action" | "judicial" | "regulatory" | "rights_protection"),
    page,
    pageSize: 9,
  });

  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 9));

  return (
    <div className="max-w-6xl mx-auto px-6 py-14">
      <section className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          {t("cases.heroTitle")}
        </h1>
        <p className="mt-3 text-stone-500 max-w-2xl mx-auto">
          {t("cases.heroDesc")}
        </p>
      </section>

      {/* 筛选区 */}
      <div className="flex flex-wrap gap-3 mb-8">
        <div className="flex gap-2 flex-1 min-w-64">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t("cases.searchPlaceholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearch(keyword.trim());
                setPage(1);
              }
            }}
          />
          <Button
            variant="outline"
            onClick={() => {
              setSearch(keyword.trim());
              setPage(1);
            }}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <Select
          value={platform}
          onValueChange={(v) => {
            setPlatform(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t("cases.filterPlatform")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("cases.allPlatforms")}</SelectItem>
            {(platforms.data ?? []).map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={caseType}
          onValueChange={(v) => {
            setCaseType(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t("cases.filterType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("cases.allTypes")}</SelectItem>
            {Object.keys(CASE_TYPE_META).map((k) => (
              <SelectItem key={k} value={k}>
                {t(`cases.type.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 判例卡片 */}
      {list.isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-lg" />
          ))}
        </div>
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <div className="text-center py-16 text-stone-500">{t("cases.empty")}</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {list.data!.items.map((c) => {
            const meta = CASE_TYPE_META[c.caseType] ?? CASE_TYPE_META.platform_action;
            const Icon = meta.icon;
            return (
              <Card key={c.id} className="border-stone-200 bg-white flex flex-col">
                <CardContent className="pt-5 flex-1 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                    <Badge variant="outline" className="text-xs">
                      {t(`cases.type.${c.caseType}`)}
                    </Badge>
                    {c.platform && (
                      <span className="text-xs text-stone-400">{c.platform}</span>
                    )}
                    {c.occurredAt && (
                      <span className="text-xs text-stone-400 ml-auto">
                        {new Date(c.occurredAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold leading-snug">{c.title}</h3>
                  <p className="text-sm text-stone-600 leading-relaxed line-clamp-4">
                    {c.summary}
                  </p>
                  {c.violation && (
                    <p className="text-xs text-stone-500">
                      <span className="font-medium text-stone-600">
                        {t("cases.violationLabel")}：
                      </span>
                      {c.violation}
                    </p>
                  )}
                  {c.outcome && (
                    <p className="text-xs text-stone-500">
                      <span className="font-medium text-stone-600">
                        {t("cases.outcomeLabel")}：
                      </span>
                      {c.outcome}
                    </p>
                  )}
                  {c.sourceUrl && (
                    <a
                      href={c.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto inline-flex items-center gap-1 text-xs text-amber-800 hover:underline"
                    >
                      {t("cases.sourceLabel")}：{c.source}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-10">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            {t("cases.prevPage")}
          </Button>
          <span className="text-sm text-stone-500">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            {t("cases.nextPage")}
          </Button>
        </div>
      )}

      <p className="text-xs text-stone-400 text-center mt-10 max-w-2xl mx-auto">
        {t("cases.disclaimer")}
      </p>
    </div>
  );
}
