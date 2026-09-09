import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { platformConfigs } from "@db/schema";

/** AI标识合法位置：片头（intro）或画面四角/居中均视为「明显位置」 */
const MARK_POSITIONS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "center",
  "intro",
] as const;

type AiMarkingSpec = {
  position: string;
  minFontScale: number;
  minDurationSec: number;
  requiredText: string;
};

/** 数据库缺失配置时的兜底通用口径（与平台种子 universal 一致） */
const UNIVERSAL_SPEC: AiMarkingSpec = {
  position: "每集明显位置",
  minFontScale: 0.03,
  minDurationSec: 3,
  requiredText: "AI生成",
};

const episodeInput = z.object({
  episodeNo: z.number().int().min(1),
  position: z.enum(MARK_POSITIONS),
  fontScale: z.number().min(0).max(1),
  durationSec: z.number().min(0),
  text: z.string().max(200),
});

/**
 * F7 AI标识形式要件校验（无状态，不入库）
 * 按目标平台 aiMarkingSpec 口径逐集校验：字号 / 展示时长 / 必需字样 / 位置
 */
export const markingRouter = createRouter({
  /** GB 45438-2025《人工智能生成合成内容标识办法》配套国标自检清单（公开） */
  standards: publicQuery.query(() => ({
    basis: "GB 45438-2025《网络安全技术 人工智能生成合成内容标识方法》＋《人工智能生成合成内容标识办法》（2025-09-01 施行）",
    explicit: [
      { key: "font_height", label: "显式标识字高 ≥ 画面最短边 5%", detail: "视频类显式标识文字高度不得低于画面最短边长度的 5%" },
      { key: "start_frame", label: "起始画面强制展示", detail: "标识须出现在视频起始画面，不得以片尾代替" },
      { key: "min_duration", label: "持续展示 ≥ 2 秒", detail: "起始画面标识持续时间不得少于 2 秒" },
      { key: "position", label: "位置醒目不遮挡", detail: "标识位置应明显易见，不得被其他元素遮挡" },
      { key: "ai_assist_credit", label: "片头「AI 辅助制作」标注", detail: "剧本/画面/配音任一环节 AI 占比 ≥70% 时须在片头显著标注（2026-07 起 AI 微短剧口径）" },
    ],
    implicit: [
      { key: "metadata_field", label: "元数据写入 AIGC 字段", detail: "文件元数据须包含 AIGC 标识 JSON 字段（生成平台、内容编号等）" },
      { key: "label_level", label: "Label 级别正确", detail: "Label 1=AI 生成、2=AI 编辑、3=含 AI 成分，按实际生产方式填写" },
      { key: "no_strip", label: "不删除/伪造标识", detail: "不得删除、篡改、伪造或隐匿显式/隐式标识（罚则 1–10 万元）" },
    ],
    platformNote: "各平台另有细化口径（尺寸/颜色/位置偏好），送检时请选择目标平台做差分校验。",
  })),

  validate: authedQuery
    .input(
      z.object({
        platform: z.string().min(1).max(64),
        episodes: z.array(episodeInput).min(1).max(200),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const selected = await db
        .select()
        .from(platformConfigs)
        .where(eq(platformConfigs.code, input.platform))
        .limit(1);
      let config = selected[0];
      if (!config || !config.aiMarkingSpec) {
        const fallback = await db
          .select()
          .from(platformConfigs)
          .where(eq(platformConfigs.code, "universal"))
          .limit(1);
        if (fallback[0]?.aiMarkingSpec) config = fallback[0];
      }
      const spec: AiMarkingSpec = config?.aiMarkingSpec ?? UNIVERSAL_SPEC;

      const results = input.episodes.map((ep) => {
        const deviations: string[] = [];
        if (ep.fontScale < spec.minFontScale) {
          deviations.push(
            `字号不足：当前${(ep.fontScale * 100).toFixed(1)}%，要求≥${(spec.minFontScale * 100).toFixed(1)}%`,
          );
        }
        if (ep.durationSec < spec.minDurationSec) {
          deviations.push(
            `展示时长不足：当前${ep.durationSec}秒，要求≥${spec.minDurationSec}秒`,
          );
        }
        if (spec.requiredText && !ep.text.includes(spec.requiredText)) {
          deviations.push(`缺少必需字样：标识文字须包含「${spec.requiredText}」`);
        }
        return {
          episodeNo: ep.episodeNo,
          pass: deviations.length === 0,
          deviations,
        };
      });

      const passCount = results.filter((r) => r.pass).length;
      return {
        spec,
        results,
        passCount,
        failCount: results.length - passCount,
      };
    }),
});
