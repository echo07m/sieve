import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { filingPackages } from "@db/schema";
import { findFilingById, findFilingsByUser } from "./queries/compliance";

/**
 * 分层判定（US-10）
 * 真人剧口径：重点≥300万 / 普通100–300万 / 其他<100万（2026-01-01 起施行的新分层标准，
 *   取代 2025-02 通知的 100万/30万 旧口径；以广电总局最新原文为准）
 * AI剧口径：重点≥80万 / 普通30–80万 / 其他<30万（企服解读口径，置信度中等，以广电原文复核）
 */
/** 公开工具限流：同一 IP 每小时 30 次（单实例内存口径） */
const PUBLIC_TOOL_WINDOW_MS = 3600_000;
const PUBLIC_TOOL_MAX = 30;
const publicToolBuckets = new Map<string, { windowStart: number; count: number }>();
function hitPublicToolLimit(key: string): boolean {
  const now = Date.now();
  const b = publicToolBuckets.get(key);
  if (!b || now - b.windowStart >= PUBLIC_TOOL_WINDOW_MS) {
    publicToolBuckets.set(key, { windowStart: now, count: 1 });
    return false;
  }
  b.count += 1;
  return b.count > PUBLIC_TOOL_MAX;
}

const AI_TIER = { key: 80, normal: 30 };
const LIVE_TIER = { key: 300, normal: 100 };
const TIER_STANDARD_NOTE = "真人剧分层依据 2026-01-01 起施行的新标准（重点≥300万/普通100–300万/其他<100万）；AI 剧数字为企服解读口径，以广电总局原文复核。";

export function judgeTier(workType: "ai_drama" | "ai_comic" | "live_drama", investmentWan: number) {
  const isAI = workType !== "live_drama";
  const t = isAI ? AI_TIER : LIVE_TIER;
  const tierCode = investmentWan >= t.key ? "key" : investmentWan >= t.normal ? "normal" : "other";
  const tier = tierCode === "key" ? "重点微短剧" : tierCode === "normal" ? "普通微短剧" : "其他微短剧";
  const filingPath =
    tierCode === "key"
      ? "国家广播电视总局备案（重点微短剧通道）"
      : tierCode === "normal"
        ? "省级广电部门备案（普通微短剧通道）"
        : "平台自审通道备案（须如实核算成本、做好内容自查与版权合规）";
  const basisNote = isAI
    ? `AI剧适用独立且更严的分层口径（重点≥${t.key}万 / 普通${t.normal}–${t.key}万）。该数字为企服解读口径，置信度中等，须以广电总局原文复核。`
    : `真人剧分层口径（重点≥${t.key}万 / 普通${t.normal}–${t.key}万，2026-01-01 起施行）。须以广电总局原文复核。`;
  return { tier, tierCode: tierCode as "key" | "normal" | "other", filingPath, basisNote };
}

const PLATFORM_VALUES = ["universal", "hongguo", "fanqie", "kuaishou", "wechat"] as const;
const WORK_TYPE_VALUES = ["ai_drama", "ai_comic", "live_drama"] as const;

export const filingRouter = createRouter({
  list: authedQuery.query(({ ctx }) => findFilingsByUser(ctx.user.id)),

  /** 分层判定（独立调用，不入库） */
  judgeTier: authedQuery
    .input(
      z.object({
        workType: z.enum(WORK_TYPE_VALUES),
        investment: z.number().min(0, "投资额不能为负"),
      }),
    )
    .query(({ input }) => judgeTier(input.workType, input.investment)),

  /** 公开备案向导：分层判定 + AI 占比自评 → 标注义务 + 材料清单（免登录获客工具，IP 限流） */
  wizardAssess: publicQuery
    .input(
      z.object({
        workType: z.enum(WORK_TYPE_VALUES),
        investment: z.number().min(0, "投资额不能为负"),
        aiShare: z
          .object({
            script: z.number().min(0).max(100),
            visual: z.number().min(0).max(100),
            voice: z.number().min(0).max(100),
          })
          .optional(),
      }),
    )
    .query(({ ctx, input }) => {
      const fwd = ctx.req.headers.get("x-forwarded-for") ?? "";
      const ip = fwd.split(",")[0]?.trim() || "unknown";
      if (hitPublicToolLimit(ip)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "查询过于频繁，请稍后再试" });
      }
      const tierResult = judgeTier(input.workType, input.investment);
      const isAI = input.workType !== "live_drama";

      // AI 占比自评：任一环节 AI 占比 ≥70% → 片头"AI 辅助制作"标注义务（2026-07 起 AI 微短剧管理口径）
      const markingDuties: string[] = [];
      if (isAI) {
        markingDuties.push("每集明显位置添加 AI 生成显式标识（字高≥画面最短边 5%，起始画面展示，持续≥2 秒）");
        markingDuties.push("文件元数据写入 AIGC 隐式标识（GB 45438-2025）");
      }
      if (input.aiShare) {
        const high = (["script", "visual", "voice"] as const).filter((k) => (input.aiShare?.[k] ?? 0) >= 70);
        if (high.length > 0) {
          const labelMap = { script: "剧本", visual: "画面", voice: "配音" } as const;
          markingDuties.push(
            `${high.map((k) => labelMap[k]).join("、")}环节 AI 占比 ≥70%：须在片头显著位置标注"AI 辅助制作"`,
          );
        }
      }

      // 分层材料清单
      const materials: string[] = ["作品信息表（片名/集数/时长/题材）", "剧本纲要或全集剧本", "成本核算明细"];
      if (tierResult.tierCode !== "other") {
        materials.push("《广播电视节目制作经营许可证》", "主创人员名单", "演员聘用合同与片酬承诺书");
      }
      if (tierResult.tierCode === "key") materials.push("省级广电协审意见");
      if (isAI) materials.push("AI 使用情况说明（剧本/画面/配音各环节 AI 占比）", "素材商用授权凭证清单");
      materials.push("上线平台信息（平台名称/账号/排期）");

      return {
        ...tierResult,
        standardNote: TIER_STANDARD_NOTE,
        markingDuties,
        materials,
        cta: "注册后可一键生成全套备案材料包（作品信息表+剧本纲要+成本核算）",
      };
    }),

  /** 生成备案材料三件套（F6）：作品信息表 + 剧本纲要 + 成本核算 */
  create: authedQuery
    .input(
      z.object({
        workTitle: z.string().min(1, "请填写作品名称").max(255),
        workType: z.enum(WORK_TYPE_VALUES).default("ai_drama"),
        targetPlatform: z.enum(PLATFORM_VALUES).default("universal"),
        investment: z.number().min(0),
        episodeCount: z.number().int().min(1).max(200),
        episodeDuration: z.number().min(0.5).max(30).default(2),
        synopsis: z.string().max(5000).optional(),
        producerName: z.string().max(255).optional(),
        licenseNo: z.string().max(255).optional(),
        costBreakdown: z.array(z.object({ item: z.string(), amount: z.number() })).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tierResult = judgeTier(input.workType, input.investment);
      const isAI = input.workType !== "live_drama";

      // 缺失字段校验（字段完整率100%校验，缺失显式提示）
      const missing: string[] = [];
      if (!input.synopsis?.trim()) missing.push("剧情梗概（作品信息表必填）");
      if (!input.producerName?.trim()) missing.push("制作机构名称");
      if (tierResult.tierCode !== "other" && !input.licenseNo?.trim())
        missing.push("《广播电视节目制作经营许可证》编号（重点/普通通道必填）");
      if (input.costBreakdown.length === 0) missing.push("成本核算明细（至少一项）");

      const costTotal = input.costBreakdown.reduce((s, c) => s + c.amount, 0);

      // episodeDuration 入库为 int：材料文本与 DB 使用同一取整值，避免自相矛盾
      const durationMin = Math.round(input.episodeDuration);

      const materials = [
        {
          key: "work_info",
          title: "作品信息表",
          ready: Boolean(input.synopsis?.trim() && input.producerName?.trim()),
          content: [
            `作品名称：${input.workTitle}`,
            `作品类型：${isAI ? (input.workType === "ai_comic" ? "AI漫剧" : "AI短剧") : "真人微短剧"}`,
            `集数：${input.episodeCount} 集 × 约 ${durationMin} 分钟`,
            `制作机构：${input.producerName || "【待补充】"}`,
            `许可证编号：${input.licenseNo || "【待补充】"}`,
            `备案分层：${tierResult.tier}（${tierResult.basisNote}）`,
            `剧情梗概：${input.synopsis || "【待补充】"}`,
            `AI标识承诺：${isAI ? "本作品为AI生成内容，每集已在明显位置添加AI标识（标识位置/字体/时长须符合平台口径）。" : "不适用"}`,
          ].join("\n"),
        },
        {
          key: "script_outline",
          title: "剧本纲要",
          ready: Boolean(input.synopsis?.trim()),
          content: "", // 在下方统一生成
        },
        {
          key: "cost_sheet",
          title: "成本核算表",
          ready: input.costBreakdown.length > 0,
          content: [
            `作品：《${input.workTitle}》`,
            `申报投资额：${input.investment} 万元`,
            `成本明细：`,
            ...(input.costBreakdown.length
              ? input.costBreakdown.map((c) => `  · ${c.item}：${c.amount} 万元`)
              : ["  【待补充：请逐项列支制作、算力、授权、配音等成本】"]),
            input.costBreakdown.length ? `合计：${costTotal.toFixed(2)} 万元` : "",
            `核算声明：本成本核算为如实申报，与备案分层判定（${tierResult.tier}）口径一致。`,
          ].join("\n"),
        },
      ];
      // 生成剧本纲要内容
      materials[1].content = [
        `作品：《${input.workTitle}》（${input.episodeCount}集）`,
        `类型：${isAI ? (input.workType === "ai_comic" ? "AI漫剧" : "AI短剧") : "真人微短剧"}`,
        `故事梗概：${input.synopsis || "【待补充】"}`,
        `剧本全文：请以附件形式上传完整剧本（平台自审通道要求提交剧本全稿）。`,
        `内容自查结论：□ 已通过上线前合规预检（报告编号可于预检报告中查询）`,
      ].join("\n");

      const db = getDb();
      const [inserted] = await db.insert(filingPackages).values({
        userId: ctx.user.id,
        workTitle: input.workTitle,
        workType: input.workType,
        targetPlatform: input.targetPlatform,
        investment: String(input.investment),
        episodeCount: input.episodeCount,
        episodeDuration: durationMin,
        synopsis: input.synopsis ?? null,
        producerName: input.producerName ?? null,
        licenseNo: input.licenseNo ?? null,
        costBreakdown: input.costBreakdown,
        tierResult,
        materials,
        missingFields: missing,
      });
      return { id: Number(inserted.insertId) };
    }),

  detail: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const filing = await findFilingById(input.id, ctx.user.id);
      if (!filing) throw new TRPCError({ code: "NOT_FOUND", message: "备案材料不存在" });
      return filing;
    }),
});
