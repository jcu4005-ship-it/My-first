#!/usr/bin/env node
/** Vercel 접근 보호 우회 값(자동 검증 전용)을 가져오거나 만듭니다 (값은 가림). */
import { api, exportEnv, need } from "./lib.mjs";

const token = need("VERCEL_TOKEN");
const project = need("VERCEL_PROJECT");
const team = need("VERCEL_TEAM_SLUG");
const q = `slug=${encodeURIComponent(team)}`;
const V = "https://api.vercel.com";

function pick(p) {
  const entries = Object.entries(p?.protectionBypass ?? {});
  const found = entries.find(([, v]) => v?.scope === "automation-bypass");
  return found?.[0];
}

let proj = await api(`${V}/v9/projects/${project}?${q}`, { token });
let secret = pick(proj);
if (!secret) {
  await api(`${V}/v1/projects/${project}/protection-bypass?${q}`, { token, method: "PATCH", body: {} });
  proj = await api(`${V}/v9/projects/${project}?${q}`, { token });
  secret = pick(proj);
}
if (!secret) {
  console.error("::error::자동 검증용 우회 값을 만들지 못했습니다");
  process.exit(1);
}
exportEnv("VERCEL_AUTOMATION_BYPASS_SECRET", secret, { secret: true });
console.log("자동 검증용 우회 값 준비 완료 (값: 가림)");
