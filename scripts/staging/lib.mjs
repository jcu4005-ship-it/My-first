/**
 * 스테이징 자동 설정 공통 도구 — 비밀 값은 절대 출력하지 않습니다.
 * GitHub Actions에서는 비밀 값을 ::add-mask:: 로 가린 뒤 다음 단계로 넘깁니다.
 */
import { appendFileSync } from "node:fs";

export function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`::error::${name} 가 없습니다`);
    process.exit(2);
  }
  return v;
}

/** 다음 단계에서 쓸 환경변수로 넘김 (secret=true면 로그에서 가림) */
export function exportEnv(name, value, { secret = false } = {}) {
  if (secret) console.log(`::add-mask::${value}`);
  if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `${name}=${value}\n`);
}

export async function api(url, { token, method = "GET", body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    // 응답 본문에 비밀 값이 있을 수 있어 오류 메시지·코드만 출력
    const msg = json?.message ?? json?.error?.message ?? json?.error ?? "";
    throw new Error(`${method} ${new URL(url).pathname} → HTTP ${res.status} ${typeof msg === "string" ? msg.slice(0, 200) : ""}`);
  }
  return json;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
