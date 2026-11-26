#!/usr/bin/env node
/**
 * V1: 빌드 결과물 중 브라우저로 전달되는 파일(.next/static)에 비밀키가 들어 있지 않은지 검사합니다.
 * - 알려진 비밀키 형식(Supabase secret, service_role 토큰, 토스 시크릿 키)
 * - 현재 환경변수에 설정된 실제 비밀값 (값 자체는 출력하지 않음)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = ".next/static";
const PATTERNS = [
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{8,}/],
  ["Toss secret key", /\b(test|live)_sk_[A-Za-z0-9]{6,}/],
  ["Toss live client key", /\blive_(ck|gck)_[A-Za-z0-9]{6,}/],
  ["env var name SUPABASE_SECRET_KEY", /SUPABASE_SECRET_KEY/],
];
const SECRET_ENV_NAMES = ["SUPABASE_SECRET_KEY", "TOSS_SECRET_KEY", "TEST_SUPABASE_SECRET_KEY"];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function jwtRoles(text) {
  const roles = [];
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) {
    try {
      const payload = JSON.parse(Buffer.from(m[1], "base64url").toString("utf8"));
      if (payload.role) roles.push(payload.role);
    } catch {
      /* not a JWT */
    }
  }
  return roles;
}

let files;
try {
  files = walk(ROOT);
} catch {
  console.error(`[scan-bundle] ${ROOT} 가 없습니다. 먼저 npm run build 를 실행하세요.`);
  process.exit(2);
}

const secretValues = SECRET_ENV_NAMES.map((n) => [n, process.env[n]]).filter(([, v]) => v && v.length >= 8);
const findings = [];
for (const file of files) {
  if (!/\.(js|css|html|json|txt|map)$/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  for (const [label, re] of PATTERNS) if (re.test(text)) findings.push(`${file}: ${label}`);
  for (const [name, value] of secretValues) if (text.includes(value)) findings.push(`${file}: value of ${name}`);
  if (jwtRoles(text).includes("service_role")) findings.push(`${file}: service_role JWT`);
}

console.log(`[scan-bundle] 검사 파일 ${files.length}개, 환경변수 비밀값 ${secretValues.length}개 대조`);
if (findings.length) {
  console.error("[scan-bundle] 비밀키 의심 항목 발견:\n" + findings.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
console.log("[scan-bundle] 통과: 비밀키 없음");
