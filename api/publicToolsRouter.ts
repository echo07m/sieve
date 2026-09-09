import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "./middleware";
import { getActiveRules } from "./queries/compliance";

/** 公开工具限流：同一 IP 每小时 20 次（单实例内存口径） */
const WINDOW_MS = 3600_000;
const MAX_PER_WINDOW = 20;
const buckets = new Map<string, { windowStart: number; count: number }>();

function hitLimit(key: string): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    buckets.set(key, { windowStart: now, count: 1 });
    return false;
  }
  b.count += 1;
  return b.count > MAX_PER_WINDOW;
}

type TitleHit = {
  ruleCode: string;
  ruleName: string;
  category: string;
  severity: "block" | "high" | "notice";
  matched: string;
  basis: string;
  remediation: string;
};

/**
 * 片名/宣传文案免费快检（获客工具）。
 * 仅用规则库中 scope 覆盖 title / promo_copy 的规则做关键词+正则匹配，
 * 不扣额度、不落库、不出报告——完整剧本检测请注册。
 */
export const publicToolsRouter = createRouter({
  titleCheck: publicQuery
    .input(
      z.object({
        title: z.string().min(1, "请填写片名").max(64),
        promoCopy: z.string().max(500).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const fwd = ctx.req.headers.get("x-forwarded-for") ?? "";
      const ip = fwd.split(",")[0]?.trim() || "unknown";
      if (hitLimit(ip)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "检测过于频繁，请稍后再试" });
      }

      const allRules = await getActiveRules();
      const titleRules = allRules.filter((r) => {
        const scope = (r.scope as string[] | null) ?? [];
        return scope.includes("title") || scope.includes("promo_copy");
      });

      const texts: { field: "片名" | "宣传文案"; value: string }[] = [
        { field: "片名", value: input.title },
      ];
      if (input.promoCopy?.trim()) texts.push({ field: "宣传文案", value: input.promoCopy });

      const hits: TitleHit[] = [];
      for (const rule of titleRules) {
        const keywords = (rule.keywords as string[] | null) ?? [];
        const patterns = (rule.patterns as string[] | null) ?? [];
        for (const { field, value } of texts) {
          for (const kw of keywords) {
            if (kw && value.includes(kw)) {
              hits.push({
                ruleCode: rule.ruleCode,
                ruleName: rule.name,
                category: rule.category,
                severity: rule.severity,
                matched: `${field}含「${kw}」`,
                basis: `${rule.sourcePolicy}｜${rule.sourceClause}`,
                remediation: rule.remediationTemplate.replace("[{span}]", kw),
              });
              break; // 同规则同字段取一个代表命中
            }
          }
          for (const p of patterns) {
            try {
              const m = value.match(new RegExp(p, "u"));
              if (m) {
                hits.push({
                  ruleCode: rule.ruleCode,
                  ruleName: rule.name,
                  category: rule.category,
                  severity: rule.severity,
                  matched: `${field}命中「${m[0]}」`,
                  basis: `${rule.sourcePolicy}｜${rule.sourceClause}`,
                  remediation: rule.remediationTemplate.replace("[{span}]", m[0]),
                });
                break;
              }
            } catch {
              // 规则库正则均经录入校验，防御性跳过
            }
          }
        }
      }

      // 去重（同规则只保留最严重一条）
      const rank = { block: 3, high: 2, notice: 1 } as const;
      const byRule = new Map<string, TitleHit>();
      for (const h of hits) {
        const prev = byRule.get(h.ruleCode);
        if (!prev || rank[h.severity] > rank[prev.severity]) byRule.set(h.ruleCode, h);
      }
      const deduped = [...byRule.values()].sort((a, b) => rank[b.severity] - rank[a.severity]);
      const maxSev = deduped.reduce<string | null>(
        (m, h) => (m === null || rank[h.severity as keyof typeof rank] > rank[m as keyof typeof rank] ? h.severity : m),
        null,
      );

      return {
        title: input.title,
        verdict: maxSev === "block" ? "high_risk" : maxSev === "high" ? "attention" : "low_risk",
        hits: deduped,
        checkedRules: titleRules.length,
        note: "本工具仅检测片名/宣传文案维度。完整剧本合规预检（8 大类 19 项规则、分平台口径、整改建议、报告存证）请注册使用。",
      };
    }),
});
