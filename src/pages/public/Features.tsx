import { Card, CardContent } from "@/components/ui/card";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  ScanSearch,
  MapPin,
  Wand2,
  BadgeCheck,
  Copyright,
  SlidersHorizontal,
  FileCheck,
  BarChart3,
  Plug,
  Library,
  Stamp,
  RefreshCw,
  ScanText,
  Compass,
  ClipboardCheck,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const sectionIcons = [
  ScanSearch,
  MapPin,
  Wand2,
  BadgeCheck,
  Copyright,
  SlidersHorizontal,
  FileCheck,
  BarChart3,
  Plug,
  Library,
  Stamp,
  RefreshCw,
  ScanText,
  Compass,
  ClipboardCheck,
];

type SectionText = { title: string; desc: string };

export default function Features() {
  const { t } = useTranslation();
  useDocumentTitle(t("features.docTitle"));

  const sections = (
    t("features.sections", { returnObjects: true }) as SectionText[]
  ).map((s, i) => ({ ...s, icon: sectionIcons[i] }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <section className="text-center mb-14">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          {t("features.title")}
        </h1>
        <p className="mt-4 text-stone-500 max-w-2xl mx-auto">
          {t("features.subtitle")}
        </p>
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        {sections.map((s) => (
          <Card key={s.title} className="border-stone-200 bg-white">
            <CardContent className="pt-6">
              <s.icon className="h-7 w-7 text-amber-800 mb-3" />
              <h2 className="font-semibold text-lg mb-2">{s.title}</h2>
              <p className="text-sm text-stone-600 leading-relaxed">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
