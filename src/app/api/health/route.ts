import { connection } from "next/server";

import { brand } from "@/config/brand";
import { assertValidEnv, integrationStatus } from "@/config/env";
import { LOCKED } from "@/config/platform-policy";

/** 데이터베이스(로그인 서버) 응답 확인: 연결 설정이 있을 때만, 3초 안에 답이 없으면 "down" */
async function databaseStatus(url: string | undefined, key: string | undefined): Promise<"ok" | "down" | "not_configured"> {
  if (!url || !key) return "not_configured";
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, { headers: { apikey: key }, signal: AbortSignal.timeout(3000), cache: "no-store" });
    return res.ok ? "ok" : "down";
  } catch {
    return "down";
  }
}

/**
 * 상태 확인용 주소 (/api/health)
 * 배포가 정상인지, 어떤 환경·결제 모드인지, 데이터베이스가 응답하는지 확인합니다. 비밀값은 절대 포함하지 않습니다.
 * 데이터베이스가 연결돼 있는데 응답이 없으면 503 — 외부 감시 서비스(업타임 체크)가 장애를 알아챌 수 있게 합니다.
 */
export async function GET() {
  await connection(); // 요청 시점에 실행 (빌드 시 고정 방지)
  const env = assertValidEnv(process.env);
  const database = await databaseStatus(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return Response.json(
    {
      status: database === "down" ? "degraded" : "ok",
      database,
      service: brand.codeName,
      appEnv: env.NEXT_PUBLIC_APP_ENV,
      paymentMode: env.NEXT_PUBLIC_PAYMENT_MODE,
      livePaymentsEnabled: LOCKED.livePaymentsEnabled,
      settlementMode: LOCKED.settlementMode,
      integrations: integrationStatus(env),
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
    { status: database === "down" ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
