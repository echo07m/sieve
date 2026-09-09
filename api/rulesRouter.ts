import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { getAllRules, getLatestRuleVersion } from "./queries/compliance";
import { rules } from "@db/schema";
import { eq } from "drizzle-orm";

export const rulesRouter = createRouter({
  /** 规则库列表 + 当前版本 */
  list: authedQuery.query(async () => {
    const [all, version] = await Promise.all([getAllRules(), getLatestRuleVersion()]);
    return { rules: all, currentVersion: version };
  }),

  /** 启用/停用规则（规则热更新的管理端入口，仅管理员） */
  setStatus: adminQuery
    .input(z.object({ ruleCode: z.string(), status: z.enum(["active", "disabled"]) }))
    .mutation(async ({ input }) => {
      await getDb()
        .update(rules)
        .set({ status: input.status })
        .where(eq(rules.ruleCode, input.ruleCode));
      return { ok: true };
    }),
});
