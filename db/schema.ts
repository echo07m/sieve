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
  username: varchar("username", { length: 64 }).unique(), // 用户名密码登录（可空：Kimi/GitHub 用户无用户名）
  passwordHash: varchar("passwordHash", { length: 255 }), // scrypt$N$r$p$salt$hash
  githubId: varchar("githubId", { length: 32 }).unique(), // GitHub OAuth 绑定
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

// ============================================================
// 判例库：平台驳回/下架/维权真实案例，为检测报告提供判例佐证
// ============================================================

/**
 * 判例：收录平台处置、司法判决、监管通报中的真实案例。
 * relatedRuleCodes 关联规则库 ruleCode，命中该规则时报告附判例佐证。
 */
export const precedentCases = mysqlTable(
  "precedent_cases",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 128 }).notNull(),
    platform: varchar("platform", { length: 32 }).notNull().default(""), // 红果/抖音/快手/微信/司法/监管
    caseType: mysqlEnum("caseType", [
      "platform_action", // 平台处置（下架/限流/封号）
      "judicial", // 司法判例
      "regulatory", // 监管通报/约谈
      "rights_protection", // 维权事件
    ]).notNull(),
    summary: varchar("summary", { length: 1000 }).notNull(),
    violation: varchar("violation", { length: 200 }).notNull().default(""), // 违规点概述
    outcome: varchar("outcome", { length: 300 }).notNull().default(""), // 处置结果
    source: varchar("source", { length: 128 }).notNull().default(""), // 信息来源（媒体/公告名）
    sourceUrl: varchar("sourceUrl", { length: 300 }).notNull().default(""),
    relatedRuleCodes: json("relatedRuleCodes").$type<string[]>().notNull(), // 关联规则 code 列表
    occurredAt: timestamp("occurredAt"),
    isActive: boolean("isActive").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("precedent_cases_type_idx").on(t.caseType, t.isActive)],
);

export type PrecedentCase = typeof precedentCases.$inferSelect;

// ============================================================
// 开放 API 工作流：异步检测任务 + Webhook 回调
// ============================================================

/** 异步检测任务：POST /api/v1/detect/async 创建，进程内 worker 执行 */
export const detectTasks = mysqlTable(
  "detect_tasks",
  {
    id: serial("id").primaryKey(),
    taskNo: varchar("taskNo", { length: 40 }).notNull().unique(), // DT-YYYYMMDD-NNNNNN
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    apiKeyId: bigint("apiKeyId", { mode: "number", unsigned: true }).notNull(),
    workTitle: varchar("workTitle", { length: 255 }).notNull(),
    status: mysqlEnum("status", ["pending", "processing", "done", "failed"])
      .notNull()
      .default("pending"),
    input: json("input").$type<{
      workTitle: string;
      scriptText: string;
      targetPlatform: string;
      workType?: string;
    }>().notNull(),
    result: json("result").$type<Record<string, unknown>>(), // 与同步端点同构
    error: varchar("error", { length: 500 }).notNull().default(""),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    finishedAt: timestamp("finishedAt"),
  },
  (t) => [index("detect_tasks_userId_idx").on(t.userId, t.status)],
);

export type DetectTask = typeof detectTasks.$inferSelect;

/** Webhook 端点：用户配置的回调地址（签名密钥服务端生成） */
export const webhookEndpoints = mysqlTable(
  "webhook_endpoints",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 64 }).notNull().default(""),
    url: varchar("url", { length: 300 }).notNull(),
    secret: varchar("secret", { length: 80 }).notNull(), // whsec_xxx，HMAC-SHA256 签名
    isActive: boolean("isActive").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("webhook_endpoints_userId_idx").on(t.userId)],
);

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;

/** Webhook 投递记录：签名 + 失败重推（最多 5 次，退避） */
export const webhookDeliveries = mysqlTable(
  "webhook_deliveries",
  {
    id: serial("id").primaryKey(),
    endpointId: bigint("endpointId", { mode: "number", unsigned: true }).notNull(),
    taskId: bigint("taskId", { mode: "number", unsigned: true }),
    event: varchar("event", { length: 32 }).notNull(), // detect.done / detect.failed / test.ping
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    status: mysqlEnum("status", ["pending", "success", "failed"])
      .notNull()
      .default("pending"),
    attempts: int("attempts").notNull().default(0),
    responseCode: int("responseCode"),
    lastError: varchar("lastError", { length: 500 }).notNull().default(""),
    nextRetryAt: timestamp("nextRetryAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    deliveredAt: timestamp("deliveredAt"),
  },
  (t) => [index("webhook_deliveries_status_idx").on(t.status, t.nextRetryAt)],
);

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;

// ============================================================
// 政策雷达：新规动态录入 + 影响评估 + 转规则草稿
// ============================================================

/** 政策动态：管理员录入的监管/平台新规，评估对规则库的影响 */
export const policyUpdates = mysqlTable(
  "policy_updates",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    source: varchar("source", { length: 128 }).notNull().default(""), // 广电总局/平台公告…
    sourceUrl: varchar("sourceUrl", { length: 300 }).notNull().default(""),
    publishedAt: timestamp("publishedAt"),
    summary: varchar("summary", { length: 1000 }).notNull(),
    impactAssessment: varchar("impactAssessment", { length: 1000 }).notNull().default(""), // 对现有规则的影响分析
    relatedRuleCodes: json("relatedRuleCodes").$type<string[]>().notNull(), // 受影响规则
    status: mysqlEnum("status", ["pending", "reviewed", "converted"])
      .notNull()
      .default("pending"), // pending 待评估 / reviewed 已评估 / converted 已转规则草稿
    draftRuleCode: varchar("draftRuleCode", { length: 32 }).notNull().default(""), // 转换后的规则 code
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("policy_updates_status_idx").on(t.status, t.publishedAt)],
);

export type PolicyUpdate = typeof policyUpdates.$inferSelect;

/** 团队组织：对应广电「3名持证审核员」的自审团队要求 */
export const organizations = mysqlTable(
  "organizations",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    ownerId: bigint("ownerId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("organizations_ownerId_idx").on(t.ownerId)],
);

export type Organization = typeof organizations.$inferSelect;

/** 组织成员：owner 负责人 / reviewer 审核员 / editor 编剧 */
export const orgMembers = mysqlTable(
  "org_members",
  {
    id: serial("id").primaryKey(),
    orgId: bigint("orgId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    role: mysqlEnum("role", ["owner", "reviewer", "editor"])
      .notNull()
      .default("editor"),
    licenseNo: varchar("licenseNo", { length: 64 }).notNull().default(""), // 审核员持证编号（可选登记）
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("org_members_orgId_idx").on(t.orgId),
    index("org_members_userId_idx").on(t.userId),
  ],
);

export type OrgMember = typeof orgMembers.$inferSelect;

/** 复核工单：把某次送检指派给组织内审核员复核 */
export const reviewAssignments = mysqlTable(
  "review_assignments",
  {
    id: serial("id").primaryKey(),
    orgId: bigint("orgId", { mode: "number", unsigned: true }).notNull(),
    submissionId: bigint("submissionId", { mode: "number", unsigned: true }).notNull(),
    assigneeId: bigint("assigneeId", { mode: "number", unsigned: true }).notNull(),
    assignedBy: bigint("assignedBy", { mode: "number", unsigned: true }).notNull(),
    status: mysqlEnum("status", ["pending", "in_review", "approved", "rejected"])
      .notNull()
      .default("pending"),
    note: varchar("note", { length: 500 }).notNull().default(""),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  (t) => [
    index("review_assignments_orgId_idx").on(t.orgId),
    index("review_assignments_assigneeId_idx").on(t.assigneeId, t.status),
  ],
);

export type ReviewAssignment = typeof reviewAssignments.$inferSelect;

/** 复核批注：挂在工单上，可针对具体命中条目 */
export const reviewAnnotations = mysqlTable(
  "review_annotations",
  {
    id: serial("id").primaryKey(),
    assignmentId: bigint("assignmentId", { mode: "number", unsigned: true }).notNull(),
    hitId: bigint("hitId", { mode: "number", unsigned: true }),
    authorId: bigint("authorId", { mode: "number", unsigned: true }).notNull(),
    content: varchar("content", { length: 1000 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("review_annotations_assignmentId_idx").on(t.assignmentId)],
);

export type ReviewAnnotation = typeof reviewAnnotations.$inferSelect;

/** 审计日志：组织内关键动作留痕（合规自查备查） */
export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    orgId: bigint("orgId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    action: varchar("action", { length: 64 }).notNull(), // org.create / member.add / assignment.create …
    targetType: varchar("targetType", { length: 32 }).notNull().default(""),
    targetId: bigint("targetId", { mode: "number", unsigned: true }),
    detail: json("detail").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("audit_logs_orgId_idx").on(t.orgId, t.createdAt)],
);

export type AuditLog = typeof auditLogs.$inferSelect;

/** 分镜拆解结果：剧本 → 结构化分镜表（衔接视频生成 agent） */
export const storyboards = mysqlTable(
  "storyboards",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    submissionId: bigint("submissionId", { mode: "number", unsigned: true }),
    workTitle: varchar("workTitle", { length: 255 }).notNull(),
    episodeCount: int("episodeCount").notNull().default(1),
    shotCount: int("shotCount").notNull().default(0),
    totalDurationSec: int("totalDurationSec").notNull().default(0),
    shots: json("shots").notNull(), // StoryboardShot[]
    engineVersion: varchar("engineVersion", { length: 32 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("storyboards_userId_idx").on(t.userId, t.createdAt)],
);

export type StoryboardRow = typeof storyboards.$inferSelect;

/** 第三方登录提供方配置（GitHub OAuth 等，管理员在后台配置） */
export const authProviders = mysqlTable("auth_providers", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 32 }).notNull().unique(), // github
  clientId: varchar("clientId", { length: 128 }).notNull().default(""),
  clientSecret: varchar("clientSecret", { length: 128 }).notNull().default(""),
  enabled: boolean("enabled").notNull().default(false),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type AuthProvider = typeof authProviders.$inferSelect;
