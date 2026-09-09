import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  int,
  json,
  decimal,
  longtext,
  index,
  boolean,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================
// 规则与知识库层（M1 政策规则库）
// ============================================================

/** 规则库版本快照：每次规则变更生成不可变版本，历史报告可溯源 */
export const ruleVersions = mysqlTable("rule_versions", {
  id: serial("id").primaryKey(),
  version: varchar("version", { length: 32 }).notNull().unique(),
  note: text("note"),
  ruleCount: int("ruleCount").notNull().default(0),
  snapshot: json("snapshot"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RuleVersion = typeof ruleVersions.$inferSelect;

/** 政策规则：条文 → 机器可执行规则的映射（见开发文档 3.2.2 Schema） */
export const rules = mysqlTable("rules", {
  id: serial("id").primaryKey(),
  ruleCode: varchar("ruleCode", { length: 32 }).notNull().unique(), // 如 R7-2026-001
  version: varchar("version", { length: 32 }).notNull().default("1.0.0"),
  status: mysqlEnum("status", ["active", "disabled"]).notNull().default("active"),
  category: mysqlEnum("category", [
    "child_harm", // 涉儿童有害
    "soft_porn", // 软色情擦边
    "money_worship", // 拜金炫富
    "marriage_distortion", // 畸形婚恋观
    "feudal_dregs", // 封建糟粕
    "violent_revenge", // 暴力复仇
    "vulgar_title", // 低俗片名
    "ip_infringement", // 侵权盗版
  ]).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  severity: mysqlEnum("severity", ["block", "high", "notice"]).notNull(),
  // 来源条款
  sourcePolicy: varchar("sourcePolicy", { length: 255 }).notNull(),
  sourceClause: varchar("sourceClause", { length: 255 }).notNull(),
  originalText: text("originalText").notNull(),
  sourceConfidence: mysqlEnum("sourceConfidence", [
    "official_text", // 原文直引
    "vendor_interpretation", // 企服解读，以广电原文为准
  ]).notNull().default("official_text"),
  // 判定逻辑
  scope: json("scope").$type<string[]>().notNull(), // title/episode_title/dialogue/narration/promo_copy/full_text
  keywords: json("keywords").$type<string[]>().notNull().default([]),
  patterns: json("patterns").$type<string[]>().notNull().default([]), // 正则
  cooccurrence: json("cooccurrence")
    .$type<{ groupA: string[]; groupB: string[]; window: number }[]>()
    .default([]), // 共现规则：A组与B组在window字符内共现才命中
  baseConfidence: decimal("baseConfidence", { precision: 3, scale: 2 })
    .notNull()
    .default("0.80"),
  remediationTemplate: text("remediationTemplate").notNull(),
  platformOverrides: json("platformOverrides")
    .$type<Record<string, { severity?: "block" | "high" | "notice"; note?: string }>>()
    .default({}),
  effectiveAt: timestamp("effectiveAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Rule = typeof rules.$inferSelect;
export type InsertRule = typeof rules.$inferInsert;

// ============================================================
// 应用层：送检工单 + 命中记录 + 报告（M5/M6/M9）
// ============================================================

/** 送检工单 */
export const submissions = mysqlTable("submissions", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  workTitle: varchar("workTitle", { length: 255 }).notNull(),
  workType: mysqlEnum("workType", ["ai_drama", "ai_comic", "live_drama"])
    .notNull()
    .default("ai_drama"), // AI短剧 / AI漫剧 / 真人短剧
  targetPlatform: varchar("targetPlatform", { length: 64 })
    .notNull()
    .default("universal"), // universal / hongguo / fanqie / kuaishou / wechat
  scriptText: longtext("scriptText").notNull(),
  episodeCount: int("episodeCount").notNull().default(1),
  charCount: int("charCount").notNull().default(0),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"])
    .notNull()
    .default("pending"),
  resubmitOfId: bigint("resubmitOfId", { mode: "number", unsigned: true }),
  verdict: mysqlEnum("verdict", ["high_risk", "attention", "low_risk"]),
  ruleVersion: varchar("ruleVersion", { length: 32 }),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
},
  (t) => [
    index("submissions_userId_idx").on(t.userId),
  ],
);

export type Submission = typeof submissions.$inferSelect;

/** 检测命中记录：每条命中附依据条文、置信度、整改建议 */
export const detectionHits = mysqlTable("detection_hits", {
  id: serial("id").primaryKey(),
  submissionId: bigint("submissionId", { mode: "number", unsigned: true }).notNull(),
  episodeNo: int("episodeNo").notNull().default(1),
  location: varchar("location", { length: 255 }).notNull().default(""), // 集/场/句定位
  spanText: text("spanText").notNull(), // 命中片段
  category: mysqlEnum("category", [
    "child_harm",
    "soft_porn",
    "money_worship",
    "marriage_distortion",
    "feudal_dregs",
    "violent_revenge",
    "vulgar_title",
    "ip_infringement",
  ]).notNull(),
  ruleCode: varchar("ruleCode", { length: 32 }).notNull(),
  ruleName: varchar("ruleName", { length: 255 }).notNull(),
  severity: mysqlEnum("severity", ["block", "high", "notice"]).notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).notNull(),
  basis: text("basis").notNull(), // 依据条文原文
  sourceConfidence: mysqlEnum("sourceConfidence", [
    "official_text",
    "vendor_interpretation",
  ]).notNull().default("official_text"),
  remediation: text("remediation").notNull(),
  matchSource: mysqlEnum("matchSource", ["rule_engine", "keyword", "llm"])
    .notNull()
    .default("rule_engine"),
  reviewStatus: mysqlEnum("reviewStatus", ["open", "accepted", "dismissed"])
    .notNull()
    .default("open"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
},
  (t) => [
    index("detection_hits_submissionId_idx").on(t.submissionId),
  ],
);

export type DetectionHit = typeof detectionHits.$inferSelect;

/** 预检报告（含留痕存证：SHA-256 哈希 + 生成时间戳 + 规则版本） */
export const reports = mysqlTable("reports", {
  id: serial("id").primaryKey(),
  submissionId: bigint("submissionId", { mode: "number", unsigned: true })
    .notNull()
    .unique(),
  reportNo: varchar("reportNo", { length: 40 }).notNull().unique(),
  verdict: mysqlEnum("verdict", ["high_risk", "attention", "low_risk"]).notNull(),
  summary: json("summary")
    .$type<{
      totalHits: number;
      blockCount: number;
      highCount: number;
      noticeCount: number;
      byCategory: Record<string, number>;
      episodeCount: number;
      affectedEpisodes: number;
    }>()
    .notNull(),
  contentHash: varchar("contentHash", { length: 64 }).notNull(), // SHA-256
  ruleVersion: varchar("ruleVersion", { length: 32 }).notNull(),
  disclaimer: text("disclaimer").notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
});

export type Report = typeof reports.$inferSelect;

// ============================================================
// 应用层：备案材料生成（M4）+ 分层判定
// ============================================================

export const filingPackages = mysqlTable("filing_packages", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  workTitle: varchar("workTitle", { length: 255 }).notNull(),
  workType: mysqlEnum("workType", ["ai_drama", "ai_comic", "live_drama"])
    .notNull()
    .default("ai_drama"),
  targetPlatform: varchar("targetPlatform", { length: 64 })
    .notNull()
    .default("universal"),
  investment: decimal("investment", { precision: 12, scale: 2 }).notNull(), // 投资额（万元）
  episodeCount: int("episodeCount").notNull(),
  episodeDuration: int("episodeDuration").notNull().default(2), // 单集分钟
  synopsis: text("synopsis"),
  producerName: varchar("producerName", { length: 255 }),
  licenseNo: varchar("licenseNo", { length: 255 }),
  costBreakdown: json("costBreakdown")
    .$type<{ item: string; amount: number }[]>()
    .default([]),
  tierResult: json("tierResult").$type<{
    tier: string; // 重点 / 普通 / 其他
    tierCode: "key" | "normal" | "other";
    filingPath: string;
    basisNote: string; // 口径标注
  }>(),
  materials: json("materials").$type<
    { key: string; title: string; content: string; ready: boolean }[]
  >(),
  missingFields: json("missingFields").$type<string[]>().default([]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
},
  (t) => [
    index("filing_packages_userId_idx").on(t.userId),
  ],
);

export type FilingPackage = typeof filingPackages.$inferSelect;

// ============================================================
// F4 AI魔改识别：经典IP参照库（C4）
// ============================================================

export const ipReferences = mysqlTable("ip_references", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  aliases: json("aliases").$type<string[]>().default([]),
  origin: varchar("origin", { length: 128 }).notNull().default(""), // 出处，如《西游记》
  category: varchar("category", { length: 32 }).notNull().default("名著"), // 神话/名著/动画/影视/游戏
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IpReference = typeof ipReferences.$inferSelect;

// ============================================================
// F13 客户规则自定义
// ============================================================

export const customRules = mysqlTable("custom_rules", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  ruleCode: varchar("ruleCode", { length: 40 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  category: mysqlEnum("category", [
    "child_harm",
    "soft_porn",
    "money_worship",
    "marriage_distortion",
    "feudal_dregs",
    "violent_revenge",
    "vulgar_title",
    "ip_infringement",
  ]).notNull(),
  severity: mysqlEnum("severity", ["block", "high", "notice"]).notNull().default("notice"),
  keywords: json("keywords").$type<string[]>().notNull().default([]),
  patterns: json("patterns").$type<string[]>().notNull().default([]),
  remediationTemplate: text("remediationTemplate").notNull().default(""),
  status: mysqlEnum("status", ["active", "disabled"]).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
},
  (t) => [
    index("custom_rules_userId_idx").on(t.userId),
  ],
);

export type CustomRule = typeof customRules.$inferSelect;

// ============================================================
// F12 开放API：API Key 管理
// ============================================================

export const apiKeys = mysqlTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  prefix: varchar("prefix", { length: 16 }).notNull(),
  keyHash: varchar("keyHash", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", ["active", "revoked"]).notNull().default("active"),
  lastUsedAt: timestamp("lastUsedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
},
  (t) => [
    index("api_keys_userId_idx").on(t.userId),
  ],
);

export type ApiKey = typeof apiKeys.$inferSelect;

// ============================================================
// F8 版权自查：授权链六节点留痕 + 桥段查重记录
// ============================================================

export const authChains = mysqlTable("auth_chains", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  workTitle: varchar("workTitle", { length: 255 }).notNull(),
  ipName: varchar("ipName", { length: 255 }).notNull(),
  node: mysqlEnum("node", [
    "authorization_application", // 授权申请
    "adaptation_boundary", // 改编红线确认
    "key_plot_confirm", // 关键剧情确认
    "mid_review", // 中期审查
    "final_review", // 成片审查
    "filing_record", // 成片备案
  ]).notNull(),
  status: mysqlEnum("status", ["pending", "done"]).notNull().default("pending"),
  evidenceText: text("evidenceText").notNull().default(""), // 留痕说明/证据描述
  evidenceHash: varchar("evidenceHash", { length: 64 }).notNull().default(""), // SHA-256
  operatorName: varchar("operatorName", { length: 128 }).notNull().default(""),
  occurredAt: timestamp("occurredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuthChain = typeof authChains.$inferSelect;

export const copyrightChecks = mysqlTable("copyright_checks", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  workTitle: varchar("workTitle", { length: 255 }).notNull(),
  refTitle: varchar("refTitle", { length: 255 }).notNull(),
  refText: text("refText").notNull(), // 参照原文
  targetText: text("targetText").notNull(), // 待查文本
  result: json("result").$type<{
    similarity: number; // 0-1 总体相似度
    segments: {
      targetExcerpt: string;
      refExcerpt: string;
      similarity: number;
    }[];
    refHash: string;
    targetHash: string;
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
},
  (t) => [
    index("copyright_checks_userId_idx").on(t.userId),
  ],
);

export type CopyrightCheck = typeof copyrightChecks.$inferSelect;

// ============================================================
// F10 备案代办聚合：投递记录与进度跟踪
// ============================================================

export const deliveries = mysqlTable("deliveries", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  filingId: bigint("filingId", { mode: "number", unsigned: true }).notNull(),
  channel: varchar("channel", { length: 64 }).notNull(), // 平台通道
  status: mysqlEnum("status", [
    "preparing", // 待投递
    "submitted", // 已投递
    "under_review", // 审核中
    "accepted", // 已通过
    "rejected", // 已驳回
  ]).notNull().default("preparing"),
  receiptNo: varchar("receiptNo", { length: 128 }).notNull().default(""), // 投递回执编号
  rejectReason: text("rejectReason"),
  deadlineDays: int("deadlineDays").notNull().default(15), // 时限（工作日）
  submittedAt: timestamp("submittedAt"),
  resolvedAt: timestamp("resolvedAt"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
},
  (t) => [
    index("deliveries_userId_idx").on(t.userId),
  ],
);

export type Delivery = typeof deliveries.$inferSelect;

// ============================================================
// F9 多平台规则差异化适配：平台通道配置（M3）
// ============================================================

export const platformConfigs = mysqlTable("platform_configs", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  strictness: int("strictness").notNull().default(3), // 1-5 审核严格度
  filingChannel: varchar("filingChannel", { length: 255 }).notNull().default(""), // 备案通道说明
  aiMarkingSpec: json("aiMarkingSpec").$type<{
    position: string; // 标识位置口径
    minFontScale: number; // 最小字号（相对画面高度比例）
    minDurationSec: number; // 最短展示时长（秒）
    requiredText: string; // 必须包含的字样
  }>(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PlatformConfig = typeof platformConfigs.$inferSelect;

// ============================================================
// 商业化：订阅配额（M9 计费）与销售线索（留资转化）
// ============================================================

/**
 * 订阅与配额：每用户一条当前订阅记录。
 * 免费档默认 3 次检测额度；按部/团队/年框由管理员在留资转化后激活并写入额度。
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  planCode: varchar("planCode", { length: 32 }).notNull().default("free"), // free | per_use | team | enterprise
  planName: varchar("planName", { length: 64 }).notNull().default("免费试检"),
  status: mysqlEnum("status", ["active", "expired"]).notNull().default("active"),
  quotaTotal: int("quotaTotal").notNull().default(3), // 检测额度总量（-1 = 不限）
  quotaUsed: int("quotaUsed").notNull().default(0),
  expiresAt: timestamp("expiresAt"),
  note: varchar("note", { length: 255 }).notNull().default(""),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
},
  (t) => [
    index("subscriptions_userId_idx").on(t.userId),
  ],
);

export type Subscription = typeof subscriptions.$inferSelect;

/** 销售线索：公开留资表单提交，管理员在后台跟进转化为付费方案 */
export const leads = mysqlTable("leads", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  company: varchar("company", { length: 128 }).notNull().default(""),
  contact: varchar("contact", { length: 128 }).notNull(), // 手机/微信/邮箱
  message: text("message"),
  source: varchar("source", { length: 32 }).notNull().default("pricing"), // pricing | paywall | docs | api
  planInterest: varchar("planInterest", { length: 32 }).notNull().default(""),
  status: mysqlEnum("status", ["new", "contacted", "converted"])
    .notNull()
    .default("new"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
},
  (t) => [
    index("leads_status_idx").on(t.status),
  ],
);

export type Lead = typeof leads.$inferSelect;

// ============================================================
// 商业化：订单与收款（无在线支付下的线下签约收款登记）
// ============================================================

/**
 * 订单：留资转化后由管理员录入；标记已收款时联动开通对应订阅方案。
 * amount 单位为元（decimal）。
 */
export const orders = mysqlTable("orders", {
  id: serial("id").primaryKey(),
  orderNo: varchar("orderNo", { length: 40 }).notNull().unique(), // DD-YYYYMMDD-NNNN
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  planCode: varchar("planCode", { length: 32 }).notNull(),
  planName: varchar("planName", { length: 64 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  contractNo: varchar("contractNo", { length: 64 }).notNull().default(""),
  payStatus: mysqlEnum("payStatus", ["pending", "paid", "refunded"])
    .notNull()
    .default("pending"),
  note: varchar("note", { length: 500 }).notNull().default(""),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Order = typeof orders.$inferSelect;

/** 站内通知：检测完成/额度告警/套餐开通等事件触达 */
export const notifications = mysqlTable("notifications", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  type: mysqlEnum("type", [
    "detection_done",
    "detection_failed",
    "quota_low",
    "plan_activated",
    "plan_expiring",
    "system",
  ]).notNull(),
  title: varchar("title", { length: 128 }).notNull(),
  content: varchar("content", { length: 1000 }).notNull().default(""),
  refId: bigint("refId", { mode: "number", unsigned: true }),
  isRead: boolean("isRead").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
},
  (t) => [
    index("notifications_userId_isRead_idx").on(t.userId, t.isRead),
  ],
);

export type Notification = typeof notifications.$inferSelect;
