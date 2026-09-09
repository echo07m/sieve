import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useTranslation } from "react-i18next";

/**
 * 常见问题（i18n 双语）。其中前 6 条中文文案与 index.html 的 FAQPage JSON-LD
 * 保持逐字一致（zh.json 为准），修改时请同步更新 JSON-LD。
 */
export default function FaqPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("faq.docTitle"));

  const faqs = t("faq.items", { returnObjects: true }) as { q: string; a: string }[];

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t("faq.title")}</h1>
      <p className="mt-4 text-sm text-stone-500 leading-relaxed">{t("faq.subtitle")}</p>
      <Accordion type="single" collapsible className="mt-8">
        {faqs.map((f, i) => (
          <AccordionItem key={f.q} value={`item-${i}`}>
            <AccordionTrigger className="text-left text-base font-medium">
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-stone-600 leading-relaxed">
              {f.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
