/**
 * 检测编排器（M5）：预处理 → 并行规则匹配 → LLM 候选召回（可选）→ 聚合判定
 * 聚合规则（开发文档 3.3.1）：
 *  - 任一"阻断"级命中 → 整体结论"高风险须整改"
 *  - 有"高危"级命中 → "需关注"
 *  - 其余 → "低风险"
 *  - 同一位置多规则命中取最高严重级别（冲突消解）
 */
import type { CustomRule, Rule } from "@db/schema";
import { parseScript } from "./parser";
import { matchRule, applyPlatformOverride, type RawHit } from "./matcher";
import { llmRecallEpisode, isLlmEnabled } from "./llm";

const SEVERITY_RANK = { block: 3, high: 2, notice: 1 } as const;

/** F13：客户自定义规则转换为引擎可执行的 Rule 结构（叠加在底座规则之上） */
export function customRuleToRule(c: CustomRule): Rule {
  return {
    id: c.id,
    ruleCode: c.ruleCode,
    version: "custom",
    status: c.status,
    category: c.category,
    name: `【自定义】${c.name}`,
    severity: c.severity,
    sourcePolicy: "客户自定义规则",
    sourceClause: "客户加严规则（F13）",
    originalText: c.remediationTemplate || "客户配置的自有加严规则",
    sourceConfidence: "official_text",
    scope: ["full_text"],
    keywords: c.keywords ?? [],
    patterns: c.patterns ?? [],
    cooccurrence: [],
    baseConfidence: "0.85",
    remediationTemplate:
      c.remediationTemplate ||
      "命中客户自定义加严规则。该规则由贵司合规负责人配置，请按内部规范处理。",
    platformOverrides: {},
    effectiveAt: c.createdAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export interface DetectionResult {
  hits: RawHit[];
  verdict: "high_risk" | "attention" | "low_risk";
  episodeCount: number;
  summary: {
    totalHits: number;
    blockCount: number;
    highCount: number;
    noticeCount: number;
    byCategory: Record<string, number>;
    episodeCount: number;
    affectedEpisodes: number;
  };
  llmChannelEnabled: boolean;
}

/** LLM 候选映射回规则条目：取该类别下置信度要求最低的一条规则作为依据载体 */
function mapLlmCandidates(
  candidates: Awaited<ReturnType<typeof llmRecallEpisode>>,
  activeRules: Rule[],
): RawHit[] {
  const out: RawHit[] = [];
  for (const c of candidates) {
    const rule = activeRules
      .filter((r) => r.category === c.category)
      .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])[0];
    if (!rule) continue;
    out.push({
      episodeNo: c.episodeNo,
      location: `第${c.episodeNo}集`,
      spanText: c.spanText.slice(0, 120),
      category: rule.category,
      ruleCode: rule.ruleCode,
      ruleName: rule.name,
      severity: rule.severity === "block" ? "high" : rule.severity, // LLM 召回降级一级，人工复核收口
      confidence: 0.6,
      basis: `${rule.sourcePolicy}｜${rule.sourceClause}：${rule.originalText}（LLM语义召回：${c.rationale}）`,
      sourceConfidence: rule.sourceConfidence,
      remediation: rule.remediationTemplate.replace("{span}", c.spanText.slice(0, 20)),
      matchSource: "llm",
    });
  }
  return out;
}

export async function runDetection(opts: {
  scriptText: string;
  workTitle: string;
  targetPlatform: string;
  activeRules: Rule[];
  customRules?: CustomRule[];
}): Promise<DetectionResult> {
  const { scriptText, workTitle, targetPlatform, activeRules, customRules = [] } = opts;
  const parsed = parseScript(scriptText);
  const allRules: Rule[] = [
    ...activeRules,
    ...customRules.filter((c) => c.status === "active").map(customRuleToRule),
  ];

  // 1. 规则引擎三通道匹配（平台差分生效）
  const hits: RawHit[] = [];
  for (const rule of allRules) {
    if (rule.status !== "active") continue;
    // 元数据类提示规则（无判定逻辑，如 R9 形式要件提示）：每部剧固定附加一条
    const effective = applyPlatformOverride(rule, targetPlatform);
    const hasLogic =
      (rule.keywords?.length ?? 0) > 0 ||
      (rule.patterns?.length ?? 0) > 0 ||
      (rule.cooccurrence?.length ?? 0) > 0;
    if (!hasLogic) {
      hits.push({
        episodeNo: 1,
        location: "全剧 · 形式要件",
        spanText: effective.name,
        category: effective.category,
        ruleCode: effective.ruleCode,
        ruleName: effective.name,
        severity: "notice",
        confidence: Number(effective.baseConfidence ?? 0.8),
        basis: `${effective.sourcePolicy}｜${effective.sourceClause}：${effective.originalText}`,
        sourceConfidence: effective.sourceConfidence,
        remediation: effective.remediationTemplate.replace("{span}", "全剧"),
        matchSource: "rule_engine",
      });
      continue;
    }
    hits.push(...matchRule(effective, parsed, workTitle));
  }

  // 2. LLM 语义召回（可选通道，映射回规则库条目）
  const llmEnabled = isLlmEnabled();
  if (llmEnabled) {
    const byEp = new Map<number, string>();
    for (const l of parsed.lines) {
      byEp.set(l.episodeNo, (byEp.get(l.episodeNo) ?? "") + "\n" + l.text);
    }
    const episodes = [...byEp.entries()].slice(0, 100);
    const results = await Promise.allSettled(
      episodes.map(([ep, text]) => llmRecallEpisode(ep, text)),
    );
    const candidates = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    hits.push(...mapLlmCandidates(candidates, activeRules));
  }

  // 3. 冲突消解：同一位置 + 同一规则 只保留最高置信度一条
  const dedup = new Map<string, RawHit>();
  for (const h of hits) {
    const key = `${h.ruleCode}|${h.episodeNo}|${h.location}|${h.spanText.slice(0, 30)}`;
    const prev = dedup.get(key);
    if (!prev || h.confidence > prev.confidence) dedup.set(key, h);
  }
  const finalHits = [...dedup.values()].sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      a.episodeNo - b.episodeNo ||
      b.confidence - a.confidence,
  );

  // 4. 聚合判定
  const blockCount = finalHits.filter((h) => h.severity === "block").length;
  const highCount = finalHits.filter((h) => h.severity === "high").length;
  const noticeCount = finalHits.filter((h) => h.severity === "notice").length;
  const verdict =
    blockCount > 0 ? "high_risk" : highCount > 0 ? "attention" : "low_risk";

  const byCategory: Record<string, number> = {};
  for (const h of finalHits) byCategory[h.category] = (byCategory[h.category] ?? 0) + 1;

  return {
    hits: finalHits,
    verdict,
    episodeCount: parsed.episodeCount,
    llmChannelEnabled: llmEnabled,
    summary: {
      totalHits: finalHits.length,
      blockCount,
      highCount,
      noticeCount,
      byCategory,
      episodeCount: parsed.episodeCount,
      affectedEpisodes: new Set(finalHits.map((h) => h.episodeNo)).size,
    },
  };
}
