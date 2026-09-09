/** 规则库种子脚本：npx tsx db/seed-rules.ts */
import "dotenv/config";
import { getDb } from "../api/queries/connection";
import { rules, ruleVersions } from "./schema";
import { seedRules, RULE_SEED_VERSION } from "../api/engine/seedData";

async function seed() {
  const db = getDb();
  await db.insert(ruleVersions).values({
    version: RULE_SEED_VERSION,
    note: "MVP 初始规则库：2026年6月专项治理8类问题 + AI魔改管理提示 + 备案形式要件",
    ruleCount: seedRules.length,
  });
  for (const r of seedRules) {
    await db.insert(rules).values(r);
  }
  console.log(`Seeded ${seedRules.length} rules, rule version ${RULE_SEED_VERSION}`);
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
