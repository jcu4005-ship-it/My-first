#!/usr/bin/env node
/**
 * 스테이징 Supabase 로그인 설정을 코드 기준으로 맞춥니다.
 * - 가입 허용, 이메일 인증 필수, 익명 로그인·수동 연결 끔, 비밀번호 10자+영문·숫자, 2단계 인증(TOTP)
 * - 사이트 주소·리디렉트 주소 = 스테이징 주소
 * - 인증 메일 문구 = supabase/templates/*.html
 */
import { readFileSync } from "node:fs";

import { api, need } from "./lib.mjs";

const token = need("SUPABASE_ACCESS_TOKEN");
const ref = need("PROJECT_REF");
const appUrl = need("STAGING_APP_URL").replace(/\/$/, "");

const body = {
  disable_signup: false,
  external_email_enabled: true,
  mailer_autoconfirm: false,
  external_anonymous_users_enabled: false,
  security_manual_linking_enabled: false,
  security_update_password_require_reauthentication: true,
  password_min_length: 10,
  password_required_characters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789",
  mfa_totp_enroll_enabled: true,
  mfa_totp_verify_enabled: true,
  site_url: appUrl,
  uri_allow_list: `${appUrl}/**`,
  mailer_subjects_confirmation: "이메일 주소를 인증해 주세요",
  mailer_templates_confirmation_content: readFileSync("supabase/templates/confirmation.html", "utf8"),
  mailer_subjects_recovery: "비밀번호 재설정 안내",
  mailer_templates_recovery_content: readFileSync("supabase/templates/recovery.html", "utf8"),
};

await api(`https://api.supabase.com/v1/projects/${ref}/config/auth`, { token, method: "PATCH", body });
console.log(`로그인 설정 적용 완료 (사이트 주소: ${appUrl})`);
