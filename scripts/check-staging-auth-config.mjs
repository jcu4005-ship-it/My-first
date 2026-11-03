#!/usr/bin/env node
/**
 * 스테이징 Supabase Auth 설정이 1단계 규칙과 같은지 Supabase Management API로 확인합니다.
 * (설정 값만 읽으며 아무것도 바꾸지 않습니다. 비밀 값은 출력하지 않습니다.)
 *  - 비밀번호 최소 10자, 영문+숫자 필수
 *  - 이메일 인증 필수 (자동 인증 꺼짐)
 *  - TOTP 2단계 인증 등록·확인 켜짐
 */
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.PROJECT_REF;
if (!token || !ref) {
  console.error("SUPABASE_ACCESS_TOKEN / PROJECT_REF 가 필요합니다.");
  process.exit(2);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!res.ok) {
  console.error(`Auth 설정 조회 실패: HTTP ${res.status}`);
  process.exit(2);
}
const c = await res.json();

const checks = [
  ["password_min_length >= 10", typeof c.password_min_length === "number" && c.password_min_length >= 10, c.password_min_length],
  [
    "password_required_characters = 영문+숫자 이상",
    typeof c.password_required_characters === "string" && /a-z/.test(c.password_required_characters) && /0-9/.test(c.password_required_characters),
    c.password_required_characters,
  ],
  ["mailer_autoconfirm = false (이메일 인증 필수)", c.mailer_autoconfirm === false, c.mailer_autoconfirm],
  ["mfa_totp_enroll_enabled = true", c.mfa_totp_enroll_enabled === true, c.mfa_totp_enroll_enabled],
  ["mfa_totp_verify_enabled = true", c.mfa_totp_verify_enabled === true, c.mfa_totp_verify_enabled],
];

let failed = 0;
for (const [label, ok, value] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (현재 값: ${JSON.stringify(value)})`);
  if (!ok) failed++;
}
if (failed) {
  console.error(`\n${failed}개 설정이 1단계 규칙과 다릅니다. docs/STAGING_SETUP.md 의 Auth 설정을 확인하세요.`);
  process.exit(1);
}
console.log("\n스테이징 Auth 설정 확인 완료");
