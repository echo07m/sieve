import { desc, eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { detectionHits, ruleVersions, submissions } from "@db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function formatWeekLabel(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}-${dd}周`;
}

export const analyticsRouter = createRouter({
  /** F11 客户级合规数据看板：送审通过率、驳回原因分布、规则更新推送（数据量小，内存聚合） */
  overview: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;

    const [subs, hits, versions] = await Promise.all([
      // 列投影：看板聚合不需要 scriptText（longtext，避免大字段传输）
      db
        .select({
          id: submissions.id,
          status: submissions.status,
          verdict: submissions.verdict,
          createdAt: submissions.createdAt,
        })
        .from(submissions)
        .where(eq(submissions.userId, userId)),
      db
        .select({
          id: detectionHits.id,
          category: detectionHits.category,
          ruleCode: detectionHits.ruleCode,
          ruleName: detectionHits.ruleName,
          createdAt: detectionHits.createdAt,
          targetPlatform: submissions.targetPlatform,
        })
        .from(detectionHits)
        .innerJoin(submissions, eq(detectionHits.submissionId, submissions.id))
        .where(eq(submissions.userId, userId)),
      db
        .select({
          version: ruleVersions.version,
          note: ruleVersions.note,
          ruleCount: ruleVersions.ruleCount,
          createdAt: ruleVersions.createdAt,
        })
        .from(ruleVersions)
        .orderBy(desc(ruleVersions.id))
        .limit(5),
    ]);

    // ---------- 送检与结论分布 ----------
    const totalSubmissions = subs.length;
    const completed = subs.filter((s) => s.status === "completed");
    const completedCount = completed.length;
    const verdictCounts = { high_risk: 0, attention: 0, low_risk: 0 };
    for (const s of completed) {
      if (s.verdict) verdictCounts[s.verdict] += 1;
    }
    const passRate =
      completedCount > 0
        ? Math.round((verdictCounts.low_risk / completedCount) * 1000) / 1000
        : null;

    // ---------- 命中分布 ----------
    const categoryMap = new Map<string, number>();
    const platformMap = new Map<string, number>();
    const ruleMap = new Map<string, { ruleCode: string; ruleName: string; count: number }>();
    for (const h of hits) {
      categoryMap.set(h.category, (categoryMap.get(h.category) ?? 0) + 1);
      platformMap.set(h.targetPlatform, (platformMap.get(h.targetPlatform) ?? 0) + 1);
      const entry = ruleMap.get(h.ruleCode) ?? {
        ruleCode: h.ruleCode,
        ruleName: h.ruleName,
        count: 0,
      };
      entry.count += 1;
      ruleMap.set(h.ruleCode, entry);
    }
    const hitsByCategory = [...categoryMap.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
    const hitsByPlatform = [...platformMap.entries()]
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count);
    const topRules = [...ruleMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // ---------- 最近 8 周趋势（按周分桶） ----------
    const now = Date.now();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const firstBucketStart = todayStart.getTime() - 7 * WEEK_MS;
    const bucketOf = (ts: number) => Math.floor((ts - firstBucketStart) / WEEK_MS);
    const weeklyTrend = Array.from({ length: 8 }, (_, i) => ({
      week: formatWeekLabel(new Date(firstBucketStart + i * WEEK_MS)),
      submissions: 0,
      hits: 0,
    }));
    for (const s of subs) {
      const b = bucketOf(s.createdAt.getTime());
      if (b >= 0 && b < 8) weeklyTrend[b].submissions += 1;
    }
    for (const h of hits) {
      const b = bucketOf(h.createdAt.getTime());
      if (b >= 0 && b < 8) weeklyTrend[b].hits += 1;
    }

    return {
      totalSubmissions,
      completedCount,
      verdictCounts,
      passRate,
      totalHits: hits.length,
      hitsByCategory,
      hitsByPlatform,
      weeklyTrend,
      topRules,
      ruleVersions: versions,
      currentRuleVersion: versions[0]?.version ?? null,
    };
  }),
});
