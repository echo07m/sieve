/**
 * 规则引擎匹配器：关键词 / 正则 / 共现 三通道
 * 判定权在规则引擎（见开发文档 3.1.2 判定权边界），LLM 只做候选召回。
 */
import type { Rule } from "@db/schema";
import type { ParsedScript, ScriptLine } from "./parser";

export interface RawHit {
  episodeNo: number;
  location: string;
  spanText: string;
  category: Rule["category"];
  ruleCode: string;
  ruleName: string;
  severity: "block" | "high" | "notice";
  confidence: number;
  basis: string;
  sourceConfidence: "official_text" | "vendor_interpretation";
  remediation: string;
  matchSource: "rule_engine" | "keyword" | "llm";
}

function lineScopeKinds(rule: Rule): ScriptLine["kind"][] {
  const scope = rule.scope ?? [];
  if (scope.includes("full_text")) return ["title", "dialogue", "narration"];
  const kinds: ScriptLine["kind"][] = [];
  if (scope.includes("episode_title") || scope.includes("title")) kinds.push("title");
  if (scope.includes("dialogue")) kinds.push("dialogue");
  if (scope.includes("narration")) kinds.push("narration");
  return kinds.length ? kinds : ["dialogue", "narration"];
}

function compilePatterns(patterns: string[]): RegExp[] {
  const out: RegExp[] = [];
  for (const p of patterns ?? []) {
    try {
      out.push(new RegExp(p, "u"));
    } catch {
      // 非法正则跳过，防止单条坏规则拖垮检测
    }
  }
  return out;
}

function truncate(s: string, n = 120): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/** 对单条规则在整部剧本上执行匹配 */
export function matchRule(rule: Rule, parsed: ParsedScript, workTitle: string): RawHit[] {
  const hits: RawHit[] = [];
  const kinds = lineScopeKinds(rule);
  const keywords = rule.keywords ?? [];
  const regexes = compilePatterns(rule.patterns ?? []);
  const cooc = rule.cooccurrence ?? [];
  const base = Number(rule.baseConfidence ?? 0.8);

  const push = (line: ScriptLine, matched: string, source: RawHit["matchSource"], boost = 0) => {
    const locBase = `第${line.episodeNo}集${line.lineNo > 0 ? ` · 第${line.lineNo}行` : " · 集标题"}`;
    hits.push({
      episodeNo: line.episodeNo,
      location: line.timecode ? `${locBase} · ${line.timecode}` : locBase,
      spanText: truncate(matched),
      category: rule.category,
      ruleCode: rule.ruleCode,
      ruleName: rule.name,
      severity: rule.severity,
      confidence: Math.min(0.99, base + boost),
      basis: `${rule.sourcePolicy}｜${rule.sourceClause}：${rule.originalText}`,
      sourceConfidence: rule.sourceConfidence,
      remediation: rule.remediationTemplate.replace("{span}", truncate(matched, 20)),
      matchSource: source,
    });
  };

  // 片名检测（scope 含 title）
  if ((rule.scope ?? []).includes("title") && workTitle) {
    const titleLine: ScriptLine = { episodeNo: 0, episodeTitle: "", lineNo: 0, text: workTitle, kind: "title" };
    if (keywords.some((k) => workTitle.includes(k))) push(titleLine, workTitle, "keyword");
    for (const re of regexes) if (re.test(workTitle)) { push(titleLine, workTitle, "rule_engine", 0.05); break; }
  }

  // 逐行匹配
  for (const line of parsed.lines) {
    if (!kinds.includes(line.kind)) continue;
    // 关键词通道
    for (const k of keywords) {
      if (k && line.text.includes(k)) {
        // 提示级规则每集只记一次，避免高频词噪音淹没报告
        if (
          rule.severity === "notice" &&
          hits.some((h) => h.ruleCode === rule.ruleCode && h.episodeNo === line.episodeNo)
        ) {
          break;
        }
        push(line, line.text, "keyword");
        break; // 同一行同一规则只记一次
      }
    }
    // 正则通道
    let regexHit = false;
    for (const re of regexes) {
      const m = line.text.match(re);
      if (m) {
        // 提示级规则每集只记一次（与关键词通道同口径），其余按 集+行 去重
        const dup =
          rule.severity === "notice"
            ? hits.some((h) => h.ruleCode === rule.ruleCode && h.episodeNo === line.episodeNo)
            : hits.some(
                (h) =>
                  h.ruleCode === rule.ruleCode &&
                  h.episodeNo === line.episodeNo &&
                  h.location.includes(`第${line.lineNo}行`),
              );
        if (!dup) {
          push(line, line.text, "rule_engine", 0.05);
        }
        regexHit = true;
        break;
      }
    }
    if (regexHit) continue;
    // 共现通道（以行为单位，同时看相邻行窗口）
    for (const c of cooc) {
      if (!c.groupA?.length || !c.groupB?.length) continue;
      const ctx = line.text; // 行内共现
      const hitA = c.groupA.find((w) => ctx.includes(w));
      const hitB = c.groupB.find((w) => ctx.includes(w));
      if (hitA && hitB) {
        push(line, line.text, "rule_engine", 0.03);
        break;
      }
    }
  }

  // 跨行共现（window 字符内）：按集拼接全文后检测
  for (const c of cooc) {
    if (!c.groupA?.length || !c.groupB?.length) continue;
    const byEp = new Map<number, string>();
    for (const l of parsed.lines) {
      byEp.set(l.episodeNo, (byEp.get(l.episodeNo) ?? "") + "\n" + l.text);
    }
    for (const [ep, text] of byEp) {
      for (const a of c.groupA) {
        let idx = text.indexOf(a);
        while (idx >= 0) {
          const window = text.slice(idx, idx + (c.window ?? 60));
          const b = c.groupB.find((w) => window.includes(w));
          if (b) {
            // 若该集已有此规则命中则跳过（防抖）
            if (!hits.some((h) => h.ruleCode === rule.ruleCode && h.episodeNo === ep)) {
              hits.push({
                episodeNo: ep,
                location: `第${ep}集`,
                spanText: truncate(window.trim(), 120),
                category: rule.category,
                ruleCode: rule.ruleCode,
                ruleName: rule.name,
                severity: rule.severity,
                confidence: Math.min(0.99, base + 0.06),
                basis: `${rule.sourcePolicy}｜${rule.sourceClause}：${rule.originalText}`,
                sourceConfidence: rule.sourceConfidence,
                remediation: rule.remediationTemplate.replace("{span}", truncate(`${a}…${b}`, 20)),
                matchSource: "rule_engine",
              });
            }
            idx = -1;
          } else {
            idx = text.indexOf(a, idx + a.length);
          }
        }
      }
    }
  }

  return hits;
}

/** 平台差分生效：同一条规则按平台覆盖参数 */
export function applyPlatformOverride(rule: Rule, platform: string): Rule {
  const ov = (rule.platformOverrides as Record<string, { severity?: Rule["severity"] }> | null)?.[
    platform
  ];
  if (!ov) return rule;
  return { ...rule, severity: ov.severity ?? rule.severity };
}
