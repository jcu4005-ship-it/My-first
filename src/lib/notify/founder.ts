import "server-only";

import { after } from "next/server";

import { brand } from "@/config/brand";
import { requestOrigin } from "@/lib/site-url";

import { sendKakaoMemo } from "./kakao";

/**
 * 운영자(대표) 알림: 새 호스트 지원서가 제출되었을 때 카카오톡으로 알립니다.
 * 응답이 끝난 뒤에 보내므로 지원자 화면을 느리게 하지 않고, 실패해도 제출은 그대로 성공합니다.
 */
export async function notifyFounderNewHostApplication(): Promise<void> {
  const origin = await requestOrigin();
  after(async () => {
    const result = await sendKakaoMemo(
      {
        KAKAO_REST_API_KEY: process.env.KAKAO_REST_API_KEY,
        KAKAO_REFRESH_TOKEN: process.env.KAKAO_REFRESH_TOKEN,
        KAKAO_CLIENT_SECRET: process.env.KAKAO_CLIENT_SECRET,
      },
      { text: `[${brand.name}] 새 호스트 지원서가 도착했어요. 관리자 화면에서 확인해 주세요.`, linkUrl: `${origin}/admin/hosts` },
    );
    if (!result.sent && result.reason !== "not_configured") console.error("운영자 카카오톡 알림 실패:", result.reason);
  });
}
