import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useTranslation } from "react-i18next";

const h2Cls = "text-2xl font-semibold tracking-tight mt-12 mb-4";
const h3Cls = "text-lg font-medium mt-8 mb-3";
const pCls = "text-sm text-stone-600 leading-relaxed mb-4";
const listCls = "list-disc pl-5 space-y-2 text-sm text-stone-600 leading-relaxed mb-4";
const thCls = "text-left font-medium px-3 py-2 border-b border-stone-200";
const tdCls = "px-3 py-2 border-b border-stone-100 align-top";

function FieldTable({ rows, head }: { rows: string[][]; head: string[] }) {
  return (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm text-stone-600 border-collapse">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className={thCls}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, i) => (
                <td key={i} className={tdCls}>
                  {i === 0 ? <code className="text-amber-900">{cell}</code> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DocsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("docs.docTitle"));

  const quickSteps = t("docs.quickSteps", { returnObjects: true }) as {
    b: string;
    t: string;
  }[];
  const severities = t("docs.severities", { returnObjects: true }) as {
    b: string;
    t: string;
  }[];
  const requestFields = t("docs.requestFields", {
    returnObjects: true,
  }) as string[][];
  const responseFields = t("docs.responseFields", {
    returnObjects: true,
  }) as string[][];
  const hitFields = t("docs.hitFields", { returnObjects: true }) as string[][];

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t("docs.title")}</h1>
      <p className={`${pCls} mt-4`}>{t("docs.intro")}</p>

      {/* 快速上手 */}
      <h2 className={h2Cls}>{t("docs.quickTitle")}</h2>
      <ol className="list-decimal pl-5 space-y-3 text-sm text-stone-600 leading-relaxed mb-4">
        {quickSteps.map((s) => (
          <li key={s.b}>
            <strong className="text-stone-800">{s.b}</strong>
            {s.t}
          </li>
        ))}
      </ol>

      {/* 判定口径 */}
      <h2 className={h2Cls}>{t("docs.criteriaTitle")}</h2>
      <h3 className={h3Cls}>{t("docs.triChannelTitle")}</h3>
      <p className={pCls}>{t("docs.triChannelDesc")}</p>
      <h3 className={h3Cls}>{t("docs.confTitle")}</h3>
      <p className={pCls}>{t("docs.confDesc")}</p>
      <h3 className={h3Cls}>{t("docs.severityTitle")}</h3>
      <ul className={listCls}>
        {severities.map((s) => (
          <li key={s.b}>
            <strong className="text-stone-800">{s.b}</strong>
            {s.t}
          </li>
        ))}
      </ul>
      <p className={pCls}>
        {t("docs.criteriaNotePre")}
        <strong className="text-stone-800">{t("docs.criteriaNoteStrong")}</strong>
        {t("docs.criteriaNotePost")}
      </p>

      {/* 开放 API */}
      <h2 className={h2Cls}>{t("docs.apiTitle")}</h2>
      <p className={pCls}>
        {t("docs.apiDesc1")}
        <code className="text-amber-900"> POST /api/v1/detect </code>
        {t("docs.apiDesc2")} <code className="text-amber-900">jhg_</code>
        {t("docs.apiDesc3")}
      </p>
      <h3 className={h3Cls}>{t("docs.curlTitle")}</h3>
      <pre className="bg-stone-900 text-stone-100 text-xs rounded-md p-4 overflow-x-auto mb-4">
        <code>{t("docs.curlExample")}</code>
      </pre>
      <h3 className={h3Cls}>{t("docs.reqFieldsTitle")}</h3>
      <FieldTable
        head={[t("docs.headField"), t("docs.headType"), t("docs.headDesc")]}
        rows={requestFields}
      />
      <h3 className={h3Cls}>{t("docs.respFieldsTitle")}</h3>
      <FieldTable head={[t("docs.headField"), t("docs.headDesc")]} rows={responseFields} />
      <h3 className={h3Cls}>{t("docs.hitsTitle")}</h3>
      <FieldTable head={[t("docs.headField"), t("docs.headDesc")]} rows={hitFields} />
      <p className={pCls}>{t("docs.apiErrors")}</p>

      {/* 规则库版本 */}
      <h2 className={h2Cls}>{t("docs.rulesTitle")}</h2>
      <p className={pCls}>{t("docs.rulesDesc")}</p>

      {/* 免费工具与复诊闭环 */}
      <h2 className={h2Cls}>{t("docs.toolsTitle")}</h2>
      <h3 className={h3Cls}>{t("docs.titleCheckTitle")}</h3>
      <p className={pCls}>{t("docs.titleCheckDesc")}</p>
      <h3 className={h3Cls}>{t("docs.wizardTitle")}</h3>
      <p className={pCls}>{t("docs.wizardDesc")}</p>
      <h3 className={h3Cls}>{t("docs.gbTitle")}</h3>
      <p className={pCls}>{t("docs.gbDesc")}</p>
      <h3 className={h3Cls}>{t("docs.recheckTitle")}</h3>
      <p className={pCls}>{t("docs.recheckDesc")}</p>
    </div>
  );
}
