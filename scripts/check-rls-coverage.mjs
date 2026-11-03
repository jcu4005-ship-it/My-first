#!/usr/bin/env node
/**
 * public 스키마의 모든 테이블이
 *  1) RLS가 켜져 있고
 *  2) supabase/tests/database/*.test.sql 에서 한 번 이상 테스트되는지 확인합니다.
 * 새 테이블을 만들고 권한 테스트를 빠뜨리면 CI가 실패합니다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const dbUrl = process.env.TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const TEST_DIR = "supabase/tests/database";

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
const { rows } = await client.query(`
  select c.relname as table, c.relrowsecurity as rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
  order by 1`);
await client.end();

const testText = readdirSync(TEST_DIR)
  .filter((f) => f.endsWith(".test.sql"))
  .map((f) => readFileSync(join(TEST_DIR, f), "utf8"))
  .join("\n");

const problems = [];
for (const { table, rls } of rows) {
  if (!rls) problems.push(`${table}: RLS 꺼짐`);
  if (!new RegExp(`public\\.${table}\\b`).test(testText)) problems.push(`${table}: 권한 테스트 없음`);
}
console.log(`[rls-coverage] public 테이블 ${rows.length}개: ${rows.map((r) => r.table).join(", ")}`);
if (problems.length) {
  console.error("[rls-coverage] 실패:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log("[rls-coverage] 통과");
