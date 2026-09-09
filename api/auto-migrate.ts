/**
 * 启动时自动确保表结构存在（幂等）。
 * 开发期推荐使用 `npm run db:push`；本兜底逻辑用于首次部署环境尚未执行迁移的场景。
 * 策略：顺序执行 db/migrations/*.sql；CREATE TABLE 改写为 IF NOT EXISTS；
 * ALTER/其他语句逐条尝试，遇「已存在」类错误（重复列/索引）跳过，绝不执行 DROP。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";
import { env } from "./lib/env";

let done = false;

const IGNORABLE_CODES = new Set([
  "ER_DUP_FIELDNAME", // 重复列
  "ER_DUP_KEYNAME", // 重复索引
  "ER_TABLE_EXISTS_ERROR",
  "ER_DUP_ENTRY",
]);

export async function ensureSchema(): Promise<void> {
  if (done) return;
  let conn: mysql.Connection | null = null;
  try {
    const dir = join(process.cwd(), "db/migrations");
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    conn = await mysql.createConnection({ uri: env.databaseUrl, multipleStatements: false });
    for (const file of files) {
      const raw = readFileSync(join(dir, file), "utf8");
      const statements = raw
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/;\s*$/, ""));
      for (let stmt of statements) {
        if (/^DROP /i.test(stmt)) continue; // 永不执行删除
        if (/^CREATE TABLE /i.test(stmt)) {
          stmt = stmt.replace(/^CREATE TABLE /i, "CREATE TABLE IF NOT EXISTS ");
        }
        try {
          await conn.query(stmt);
        } catch (e) {
          const code = (e as { code?: string }).code;
          if (!code || !IGNORABLE_CODES.has(code)) throw e;
        }
      }
    }
    done = true; // 仅在全部语句成功（或跳过白名单错误）后置位，失败留待下次重试
    console.log("[auto-migrate] schema ensured");
  } catch (e) {
    // 建表失败不阻断服务启动（可能表已存在或网络暂不可达），但需显眼告警：
    // 注意本兜底无法修复「表已存在但列残缺」的场景（IF NOT EXISTS 不会补列），
    // 出现该情况时请人工核对表结构或执行 npm run db:push。
    console.error(
      "[auto-migrate] FAILED — schema may be incomplete; service continues but DB queries may fail:",
      e instanceof Error ? e.message : e,
    );
  } finally {
    if (conn) await conn.end().catch(() => undefined);
  }
}
