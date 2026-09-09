import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./connection";
import {
  detectionHits,
  filingPackages,
  ipReferences,
  platformConfigs,
  reports,
  rules,
  ruleVersions,
  submissions,
  type Rule,
} from "@db/schema";

// ---------- 规则库 ----------

/** 规则库增量播种：按 ruleCode 补齐缺失规则与 IP 参照库（幂等，可重复执行） */
let seeding: Promise<void> | null = null;
export async function ensureRulesSeeded(): Promise<void> {
  seeding ??= (async () => {
    const db = getDb();
    const { seedRules, RULE_SEED_VERSION } = await import("../engine/seedData");
    const { buildMagicAdaptRules, ipSeeds, IP_SEED_VERSION } = await import(
      "../engine/ipSeedData"
    );
    const allSeeds = [...seedRules, ...buildMagicAdaptRules()];

    const existing = await db.select({ ruleCode: rules.ruleCode }).from(rules);
    const existingCodes = new Set(existing.map((r) => r.ruleCode));
    const missing = allSeeds.filter((r) => !existingCodes.has(r.ruleCode!));
    for (const r of missing) {
      await db.insert(rules).values(r);
    }
    if (missing.length > 0) {
      const version = missing.some((r) => r.ruleCode!.startsWith("R8-2026-00"))
        ? IP_SEED_VERSION
        : RULE_SEED_VERSION;
      await db.insert(ruleVersions).values({
        version: `${version}-${Date.now().toString(36)}`,
        note: `增量播种 ${missing.length} 条规则（含AI魔改共现规则与既有规则补齐）`,
        ruleCount: missing.length,
      });
    }

    // IP 参照库播种
    const ipCount = await db.select({ id: ipReferences.id }).from(ipReferences).limit(1);
    if (ipCount.length === 0) {
      for (const ip of ipSeeds) {
        await db.insert(ipReferences).values(ip);
      }
    }

    // 平台通道配置播种
    const pc = await db.select({ id: platformConfigs.id }).from(platformConfigs).limit(1);
    if (pc.length === 0) {
      const { platformSeeds } = await import("../engine/platformSeedData");
      for (const p of platformSeeds) {
        await db.insert(platformConfigs).values(p);
      }
    }
  })();
  try {
    await seeding;
  } catch {
    seeding = null; // 失败允许下次重试
    throw new Error("规则库初始化失败");
  }
}

export async function getActiveRules(): Promise<Rule[]> {
  await ensureRulesSeeded();
  return getDb().select().from(rules).where(eq(rules.status, "active"));
}

export async function getAllRules(): Promise<Rule[]> {
  await ensureRulesSeeded();
  return getDb().select().from(rules).orderBy(rules.ruleCode);
}

export async function getLatestRuleVersion() {
  const rows = await getDb()
    .select()
    .from(ruleVersions)
    .orderBy(desc(ruleVersions.id))
    .limit(1);
  return rows[0] ?? null;
}

// ---------- 送检 ----------
/** 列表页投影：不取 scriptText（longtext 可达 200 万字符/行，列表场景无需传输） */
const SUBMISSION_LIST_COLUMNS = {
  id: submissions.id,
  userId: submissions.userId,
  workTitle: submissions.workTitle,
  workType: submissions.workType,
  targetPlatform: submissions.targetPlatform,
  charCount: submissions.charCount,
  status: submissions.status,
  verdict: submissions.verdict,
  resubmitOfId: submissions.resubmitOfId,
  episodeCount: submissions.episodeCount,
  ruleVersion: submissions.ruleVersion,
  errorMessage: submissions.errorMessage,
  createdAt: submissions.createdAt,
  completedAt: submissions.completedAt,
} as const;

export async function findSubmissionsByUser(userId: number) {
  return getDb()
    .select(SUBMISSION_LIST_COLUMNS)
    .from(submissions)
    .where(eq(submissions.userId, userId))
    .orderBy(desc(submissions.createdAt));
}

export async function findSubmissionById(id: number, userId: number) {
  const rows = await getDb()
    .select()
    .from(submissions)
    .where(and(eq(submissions.id, id), eq(submissions.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findHitsBySubmission(submissionId: number) {
  return getDb()
    .select()
    .from(detectionHits)
    .where(eq(detectionHits.submissionId, submissionId));
}

export async function findReportBySubmission(submissionId: number) {
  const rows = await getDb()
    .select()
    .from(reports)
    .where(eq(reports.submissionId, submissionId))
    .limit(1);
  return rows[0] ?? null;
}

// ---------- 备案材料 ----------
export async function findFilingsByUser(userId: number) {
  return getDb()
    .select()
    .from(filingPackages)
    .where(eq(filingPackages.userId, userId))
    .orderBy(desc(filingPackages.createdAt));
}

export async function findFilingById(id: number, userId: number) {
  const rows = await getDb()
    .select()
    .from(filingPackages)
    .where(and(eq(filingPackages.id, id), eq(filingPackages.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}
