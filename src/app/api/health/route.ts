import { connection } from "next/server";

import { brand } from "@/config/brand";
import { assertValidEnv, integrationStatus } from "@/config/env";
import { LOCKED } from "@/config/platform-policy";

/**
 * 상태 확인용 주소 (/api/health)
 * 배포가 정상인지, 어떤 환경·결제 모드인지 확인합니다. 비밀값은 절대 포함하지 않습니다.
 */
export async function GET() {
  await connection(); // 요청 시점에 실행 (빌드 시 고정 방지)
  const env = assertValidEnv(process.env);
  return Response.json(
    {
      status: "ok",
      service: brand.codeName,
      appEnv: env.NEXT_PUBLIC_APP_ENV,
      paymentMode: env.NEXT_PUBLIC_PAYMENT_MODE,
      livePaymentsEnabled: LOCKED.livePaymentsEnabled,
      settlementMode: LOCKED.settlementMode,
      integrations: integrationStatus(env),
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
