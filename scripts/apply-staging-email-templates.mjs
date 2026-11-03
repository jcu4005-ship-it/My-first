#!/usr/bin/env node
/**
 * 스테이징 Supabase의 인증 메일 문구(가입 인증·비밀번호 재설정)를 저장소 템플릿으로 맞춥니다.
 * Supabase Management API 사용 — 메일 문구 4개 항목만 바꾸고 다른 설정은 건드리지 않습니다.
 * 비밀 값은 출력하지 않습니다.
 */
import { readFileSync } from "node:fs";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.PROJECT_REF;
if (!token || !ref) {
  console.error("SUPABASE_ACCESS_TOKEN / PROJECT_REF 가 필요합니다.");
  process.exit(2);
}

const body = {
  mailer_subjects_confirmation: "이메일 주소를 인증해 주세요",
  mailer_templates_confirmation_content: readFileSync("supabase/templates/confirmation.html", "utf8"),
  mailer_subjects_recovery: "비밀번호 재설정 안내",
  mailer_templates_recovery_content: readFileSync("supabase/templates/recovery.html", "utf8"),
};

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
if (!res.ok) {
  console.error(`메일 문구 적용 실패: HTTP ${res.status}`);
  process.exit(1);
}
const after = await res.json();
const ok =
  after.mailer_templates_confirmation_content?.includes("/auth/confirm?token_hash=") &&
  after.mailer_templates_recovery_content?.includes("type=recovery");
console.log(ok ? "메일 문구 적용 완료 (가입 인증·비밀번호 재설정)" : "적용 응답에서 문구를 확인하지 못했습니다");
process.exit(ok ? 0 : 1);
