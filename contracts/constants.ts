export const Session = {
  cookieName: "kimi_sid",
  maxAgeMs: 365 * 24 * 60 * 60 * 1000,
} as const;

export const ErrorMessages = {
  unauthenticated: "Authentication required",
  insufficientRole: "Insufficient permissions",
} as const;

export const Paths = {
  login: "/login",
  oauthCallback: "/api/oauth/callback",
} as const;

/** 8 类违规类别元数据（前后端共享） */
export const CATEGORIES = {
  child_harm: { label: "涉儿童有害", color: "#dc2626" },
  soft_porn: { label: "软色情擦边", color: "#ea580c" },
  money_worship: { label: "拜金炫富", color: "#ca8a04" },
  marriage_distortion: { label: "畸形婚恋观", color: "#9333ea" },
  feudal_dregs: { label: "封建糟粕", color: "#4d7c0f" },
  violent_revenge: { label: "暴力复仇", color: "#be123c" },
  vulgar_title: { label: "低俗片名", color: "#c026d3" },
  ip_infringement: { label: "侵权盗版", color: "#1d4ed8" },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

export const SEVERITIES = {
  block: { label: "阻断", color: "#dc2626", desc: "任一命中即整体高风险，必须整改" },
  high: { label: "高危", color: "#ea580c", desc: "置信度加权结论，建议整改后送审" },
  notice: { label: "提示", color: "#2563eb", desc: "低风险提示，供人工复核参考" },
} as const;

export const VERDICTS = {
  high_risk: { label: "高风险 · 须整改", color: "#dc2626" },
  attention: { label: "需关注 · 建议整改", color: "#ea580c" },
  low_risk: { label: "低风险", color: "#16a34a" },
} as const;

export const PLATFORMS = {
  universal: { label: "通用口径（不指定平台）" },
  hongguo: { label: "红果短剧" },
  fanqie: { label: "番茄免费小说" },
  kuaishou: { label: "快手星芒" },
  wechat: { label: "微信小程序剧" },
} as const;

export const WORK_TYPES = {
  ai_drama: { label: "AI短剧" },
  ai_comic: { label: "AI漫剧" },
  live_drama: { label: "真人短剧" },
} as const;

/** 报告统一免责声明（开发文档 3.4.1：免责的技术固化） */
export const REPORT_DISCLAIMER =
  "本报告为上线前合规预检参考，不构成过审保证，最终以平台/监管审核为准。每条结论附置信度与依据条文；标注“企服解读”的口径请以广电总局原文为准。";

// ============================================================
// 商业化定价（开发文档 §4：800–1500元/部剧本预检、2000–4000元/部成片包、
// 团队订阅 1500–4000元/月、API 年框 20万–60万元/年、免费单集试检引流）
// 注：平台内不接入第三方支付，转化路径为「留资线索 → 管理员后台激活」。
// ============================================================

export type PlanCode = "free" | "per_use" | "team" | "enterprise";

export const PLANS: Record<
  PlanCode,
  {
    code: PlanCode;
    name: string;
    priceText: string; // 展示用价格口径
    quota: number; // 检测额度（-1 = 不限）
    periodText: string;
    features: string[];
    cta: string; // 转化按钮文案
    highlight?: boolean;
  }
> = {
  free: {
    code: "free",
    name: "免费试检",
    priceText: "¥0",
    quota: 3,
    periodText: "注册即享",
    features: ["3 次剧本预检额度", "8 大违规类别检测", "带存证编号的预检报告"],
    cta: "免费开始",
  },
  per_use: {
    code: "per_use",
    name: "按部检测",
    priceText: "¥800–1500/部",
    quota: 1,
    periodText: "剧本预检；成片+备案材料包 ¥2000–4000/部",
    features: ["单部剧本/成片全量检测", "备案材料清单生成", "平台差分适配（红果/快手等）"],
    cta: "留资开通",
  },
  team: {
    code: "team",
    name: "团队订阅",
    priceText: "¥1500–4000/月",
    quota: 60,
    periodText: "按月订阅，团队协作",
    features: ["每月 60 次检测额度", "自定义规则库", "数据看板与导出", "优先规则库更新"],
    cta: "留资开通",
    highlight: true,
  },
  enterprise: {
    code: "enterprise",
    name: "企业 API 年框",
    priceText: "¥20万–60万/年",
    quota: -1,
    periodText: "API 接入 + 私有化选项",
    features: ["开放 API 不限量调用", "专属规则定制与驻场支持", "SLA 与合规咨询"],
    cta: "预约洽谈",
  },
};

export const PLAN_ORDER: PlanCode[] = ["free", "per_use", "team", "enterprise"];
