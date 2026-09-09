/**
 * F9 多平台规则差异化适配（M3）：平台通道配置展示 + 规则差分对比
 * 平台差分为参数覆盖（severity 调整 + 口径备注），非独立规则。
 */
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { platformConfigs, rules } from "@db/schema";
import { desc } from "drizzle-orm";

export const platformsRouter = createRouter({
  /** 平台通道配置全量（按审核严格度降序） */
  list: authedQuery.query(async () => {
    return getDb()
      .select()
      .from(platformConfigs)
      .orderBy(desc(platformConfigs.strictness));
  }),

  /** 规则差分：过滤出 platformOverrides 非空的规则，输出通用口径与各平台覆盖 */
  ruleDiff: authedQuery.query(async () => {
    const all = await getDb().select().from(rules);
    return all
      .filter((r) => Object.keys(r.platformOverrides ?? {}).length > 0)
      .map((r) => ({
        ruleCode: r.ruleCode,
        name: r.name,
        category: r.category,
        baseSeverity: r.severity,
        overrides: r.platformOverrides ?? {},
      }));
  }),
});
