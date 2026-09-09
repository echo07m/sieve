import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { detectionHits, rules, submissions } from "@db/schema";
import { authedQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import { isLlmEnabled } from "./engine/llm";

/** 违规类别 → 整改方向模板（LLM 未配置时的兜底建议） */
const CATEGORY_PLAYBOOK: Record<string, { direction: string; tips: string[] }> = {
  child_harm: {
    direction: "删除或重构涉儿童风险情节",
    tips: [
      "移除未成年人恋爱、霸凌、成人化表演等情节",
      "涉及未成年人的角色仅保留适龄、正向引导内容",
      "必要时调整角色设定为成年人并同步修改关联台词",
    ],
  },
  soft_porn: {
    direction: "去除性暗示与擦边表达",
    tips: [
      "将露骨/暗示性描写改为克制的情感表达",
      "删除以身体部位、暧昧场景为卖点的台词",
      "亲密情节一笔带过，不做细节渲染",
    ],
  },
  money_worship: {
    direction: "弱化拜金炫富叙事",
    tips: [
      "删除具体金额炫耀、奢侈品堆砌式描写",
      "将“金钱万能”反转结局改为靠努力/真情解决问题",
      "保留商战元素但去除奢靡生活方式的正面宣扬",
    ],
  },
  marriage_distortion: {
    direction: "纠正畸形婚恋观导向",
    tips: [
      "删除骗婚、代孕交易、重婚等被正面化的情节",
      "冲突解决方式回归沟通与法律途径",
      "避免将出轨、报复塑造成“爽点”结局",
    ],
  },
  feudal_dregs: {
    direction: "去除封建迷信正向呈现",
    tips: [
      "算命、风水、鬼神情节不得作为解决问题的关键手段",
      "改为科学/现实逻辑推动剧情",
      "如剧情需要保留民俗元素，需明确其文化展示属性而非宣扬迷信",
    ],
  },
  violent_revenge: {
    direction: "弱化暴力复仇细节",
    tips: [
      "删除以暴制暴、私刑复仇被正面化的桥段",
      "暴力冲突改为法律/规则框架内解决",
      "不得细致描写酷刑、虐杀过程",
    ],
  },
  vulgar_title: {
    direction: "更换低俗/擦边片名与宣传语",
    tips: [
      "片名避免两性暗示、猎奇、哗众取宠用词",
      "宣传文案与正片基调保持一致，不做标题党",
      "可参考同类过审作品的命名方式",
    ],
  },
  ip_infringement: {
    direction: "消除侵权与魔改风险",
    tips: [
      "替换未经授权的经典 IP 名称、人物、标志性桥段",
      "AI 生成角色不得直接复刻真人肖像或知名角色形象",
      "保留 AI 生成提示词、素材授权合同等权属证据备查",
    ],
  },
};

type Suggestion = {
  kind: "rewrite" | "delete" | "replace";
  text: string;
  rationale: string;
};

/** LLM 改写建议：未配置/失败时返回 null，由模板兜底 */
async function llmSuggestRewrite(spanText: string, category: string): Promise<string | null> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;
  const base = process.env.LLM_API_BASE ?? "https://api.moonshot.cn/v1";
  const model = process.env.LLM_MODEL ?? "moonshot-v1-32k";
  const prompt = [
    "你是短剧剧本合规整改助手。以下剧本片段命中了合规规则，类别：" + category + "。",
    "请给出 1 条改写后的台词/情节文本（保持剧情连贯、人物不变，只消除违规点），",
    "要求：直接输出改写后的文本，不超过 120 字，不要解释。",
    "---",
    spanText.slice(0, 500),
  ].join("\n");
  try {
    const resp = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, temperature: 0.3, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text && text.length <= 200 ? text : null;
  } catch {
    return null;
  }
}

/**
 * 智能整改助手：针对单条命中生成整改建议。
 * LLM 通道（可选）负责个性化改写；规则模板兜底保证永远有输出。
 * 判定与建议均为参考性质，最终以平台与监管审核为准。
 */
export const remediateRouter = createRouter({
  suggest: authedQuery
    .input(z.object({ hitId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [hit] = await db
        .select()
        .from(detectionHits)
        .where(eq(detectionHits.id, input.hitId))
        .limit(1);
      if (!hit) throw new TRPCError({ code: "NOT_FOUND", message: "命中记录不存在" });

      // 归属校验：命中所属工单必须是当前用户的
      const [sub] = await db
        .select({ userId: submissions.userId })
        .from(submissions)
        .where(eq(submissions.id, hit.submissionId))
        .limit(1);
      if (!sub || sub.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权访问该命中记录" });
      }

      const [rule] = await db
        .select()
        .from(rules)
        .where(and(eq(rules.ruleCode, hit.ruleCode)))
        .limit(1);

      const playbook = CATEGORY_PLAYBOOK[hit.category] ?? {
        direction: "按规则整改要求调整",
        tips: ["对照命中规则的整改建议逐条落实"],
      };

      const suggestions: Suggestion[] = [];
      const llmText = await llmSuggestRewrite(hit.spanText, hit.category);
      if (llmText) {
        suggestions.push({
          kind: "rewrite",
          text: llmText,
          rationale: "AI 改写建议（保留剧情连贯性，仅消除违规点），请人工复核后使用",
        });
      }
      suggestions.push({
        kind: "delete",
        text: `删除该片段：「${hit.spanText.slice(0, 60)}${hit.spanText.length > 60 ? "…" : ""}」`,
        rationale: `整改方向：${playbook.direction}。删除是最稳妥的处置方式`,
      });
      if (rule?.remediationTemplate) {
        suggestions.push({
          kind: "replace",
          text: rule.remediationTemplate,
          rationale: "规则库整改建议（维护方依据政策口径编写）",
        });
      }

      return {
        hitId: hit.id,
        spanText: hit.spanText,
        category: hit.category,
        ruleName: rule?.name ?? hit.ruleCode,
        direction: playbook.direction,
        tips: playbook.tips,
        suggestions,
        llmEnabled: isLlmEnabled(),
      };
    }),
});
