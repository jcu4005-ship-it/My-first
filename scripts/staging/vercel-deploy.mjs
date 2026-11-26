#!/usr/bin/env node
/**
 * Vercel 스테이징(Preview) 설정·배포
 * 1) Preview 환경변수 5개 설정 (비밀 키는 Sensitive) — Production에는 넣지 않음
 * 2) 작업 브랜치를 Preview로 배포하고 완료까지 대기
 * 3) 브랜치 고정 주소를 STAGING_APP_URL 로 넘김
 */
import { api, exportEnv, need, sleep } from "./lib.mjs";

const token = need("VERCEL_TOKEN");
const project = need("VERCEL_PROJECT");
const team = need("VERCEL_TEAM_SLUG");
const branch = need("DEPLOY_BRANCH");
const q = `slug=${encodeURIComponent(team)}`;
const V = "https://api.vercel.com";

const vars = [
  { key: "NEXT_PUBLIC_APP_ENV", value: "staging", type: "plain" },
  { key: "NEXT_PUBLIC_PAYMENT_MODE", value: "test", type: "plain" },
  { key: "NEXT_PUBLIC_SUPABASE_URL", value: need("STAGING_SUPABASE_URL"), type: "plain" },
  { key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", value: need("STAGING_SUPABASE_PUBLISHABLE_KEY"), type: "plain" },
  { key: "SUPABASE_SECRET_KEY", value: need("STAGING_SUPABASE_SECRET_KEY"), type: "sensitive" },
];

// 같은 이름이 Production/Development에 들어 있으면 지움 (스테이징 값이 운영에 섞이지 않도록)
const existing = await api(`${V}/v10/projects/${project}/env?${q}`, { token });
for (const env of existing?.envs ?? []) {
  if (vars.some((v) => v.key === env.key) && (env.target ?? []).some((t) => t !== "preview")) {
    await api(`${V}/v9/projects/${project}/env/${env.id}?${q}`, { token, method: "DELETE" });
    console.log(`기존 ${env.key} (${(env.target ?? []).join(",")}) 제거`);
  }
}
for (const v of vars) {
  await api(`${V}/v10/projects/${project}/env?${q}&upsert=true`, {
    token,
    method: "POST",
    body: { key: v.key, value: v.value, type: v.type, target: ["preview"] },
  });
  console.log(`환경변수 설정: ${v.key} (Preview${v.type === "sensitive" ? ", Sensitive" : ""})`);
}

// 저장소 ID 조회 후 Preview 배포
const proj = await api(`${V}/v9/projects/${project}?${q}`, { token });
const repoId = proj?.link?.repoId;
if (!repoId) {
  console.error("::error::Vercel 프로젝트에 GitHub 저장소가 연결되어 있지 않습니다");
  process.exit(1);
}
const dep = await api(`${V}/v13/deployments?${q}`, {
  token,
  method: "POST",
  body: { name: project, project, gitSource: { type: "github", repoId, ref: branch } },
});
console.log(`Preview 배포 시작: ${dep.id}`);

let state = dep.readyState;
let info = dep;
for (let i = 0; i < 90 && !["READY", "ERROR", "CANCELED"].includes(state); i++) {
  await sleep(10_000);
  info = await api(`${V}/v13/deployments/${dep.id}?${q}`, { token });
  state = info.readyState;
}
if (state !== "READY") {
  console.error(`::error::Vercel 배포 실패 (상태: ${state}). Vercel 대시보드 → Deployments 의 Build Logs 를 확인하세요.`);
  process.exit(1);
}
if (info.target === "production") {
  console.error("::error::운영(Production)으로 배포되었습니다. Production Branch 설정을 확인하세요.");
  process.exit(1);
}
const aliases = info.alias ?? [];
const branchAlias = aliases.find((a) => a.includes("-git-")) ?? aliases[0] ?? info.url;
const appUrl = `https://${branchAlias}`;
exportEnv("STAGING_APP_URL", appUrl);
console.log(`스테이징 주소: ${appUrl}`);
