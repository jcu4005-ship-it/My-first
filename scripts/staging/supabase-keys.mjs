#!/usr/bin/env node
/** 스테이징 Supabase의 공개 키·비밀 키를 Management API로 가져옵니다 (값은 출력하지 않음). */
import { api, exportEnv, need } from "./lib.mjs";

const token = need("SUPABASE_ACCESS_TOKEN");
const ref = need("PROJECT_REF");
const base = `https://api.supabase.com/v1/projects/${ref}`;

let keys = await api(`${base}/api-keys?reveal=true`, { token });
let publishable = keys.find((k) => k.type === "publishable")?.api_key;
let secret = keys.find((k) => k.type === "secret" && k.api_key)?.api_key;

if (!secret) {
  console.log("비밀 키(secret)가 없어 스테이징용으로 새로 만듭니다");
  await api(`${base}/api-keys`, { token, method: "POST", body: { type: "secret", name: "vercel_staging", description: "Vercel staging server (test payments)" } });
  keys = await api(`${base}/api-keys?reveal=true`, { token });
  secret = keys.find((k) => k.type === "secret" && k.api_key)?.api_key;
}
if (!publishable) {
  // 새 형식 키가 없으면 기존(anon) 키 사용
  publishable = keys.find((k) => k.name === "anon")?.api_key;
}
if (!publishable || !secret) {
  console.error("::error::Supabase 키를 가져오지 못했습니다");
  process.exit(1);
}
exportEnv("STAGING_SUPABASE_URL", `https://${ref}.supabase.co`);
exportEnv("STAGING_SUPABASE_PUBLISHABLE_KEY", publishable);
exportEnv("STAGING_SUPABASE_SECRET_KEY", secret, { secret: true });
console.log(`Supabase 키 확인 완료 (공개 키: ${publishable.slice(0, 15)}…, 비밀 키: 가림)`);
