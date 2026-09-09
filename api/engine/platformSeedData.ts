/**
 * F9 平台通道配置种子（M3 平台规则差分库基础数据）
 * AI标识口径字段为平台公开口径的整理，执行细则以各平台最新公告为准。
 */
import type { PlatformConfig } from "@db/schema";

type PlatformSeed = Omit<PlatformConfig, "id" | "createdAt">;

export const platformSeeds: PlatformSeed[] = [
  {
    code: "universal",
    name: "通用口径（监管原文）",
    strictness: 3,
    filingChannel: "按分层判定：重点→广电总局，普通→省级广电，其他→平台自审通道",
    aiMarkingSpec: {
      position: "每集明显位置",
      minFontScale: 0.03,
      minDurationSec: 3,
      requiredText: "AI生成",
    },
    notes: "以广电总局监管原文为准的通用检测口径，不绑定任何平台执行细则。",
  },
  {
    code: "hongguo",
    name: "红果短剧",
    strictness: 5,
    filingChannel: "平台自审通道（投资<100万作品）+ 普通/重点通道",
    aiMarkingSpec: {
      position: "每集片头或画面四角明显位置",
      minFontScale: 0.04,
      minDurationSec: 5,
      requiredText: "AI生成",
    },
    notes:
      "2026年4月起强制备案标注，升级明星肖像库比对与声纹溯源；AI剧本冒充人工剧本已被平台内查。擦边与涉未成年人内容口径显著严于通用口径。",
  },
  {
    code: "fanqie",
    name: "番茄免费小说（漫剧）",
    strictness: 4,
    filingChannel: "平台自审通道 + IP授权核验（番茄IP库联动）",
    aiMarkingSpec: {
      position: "每集明显位置",
      minFontScale: 0.03,
      minDurationSec: 3,
      requiredText: "AI生成",
    },
    notes: "与番茄IP库打通，改编作品须完成授权链核验；漫剧分账比例高但审核联动IP侧。",
  },
  {
    code: "kuaishou",
    name: "快手星芒短剧",
    strictness: 4,
    filingChannel: "平台自审通道 + 星芒内容规范",
    aiMarkingSpec: {
      position: "每集明显位置",
      minFontScale: 0.03,
      minDurationSec: 4,
      requiredText: "AI生成",
    },
    notes: "星芒计划对AIGC内容有专项标注要求；低俗片名与诱导性封面为高频驳回点。",
  },
  {
    code: "wechat",
    name: "微信小程序剧",
    strictness: 4,
    filingChannel: "小程序主体自审 + 微信平台巡检",
    aiMarkingSpec: {
      position: "每集明显位置",
      minFontScale: 0.03,
      minDurationSec: 3,
      requiredText: "AI生成",
    },
    notes: "小程序主体承担备案主体责任，个人与小微主体须经平台自审通道并如实核算成本。",
  },
];
