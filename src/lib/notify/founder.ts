import "server-only";

import { after } from "next/server";

import { brand } from "@/config/brand";
import { requestOrigin } from "@/lib/site-url";

import { sendKakaoMemo } from "./kakao";

const MESSAGES = {
  host: { text: "새 호스트 지원서가 도착했어요. 관리자 화면에서 확인해 주세요.", path: "/admin/hosts" },
  creator: { text: "새 크리에이터 지원이 접수되었어요. 관리자 화면에서 확인해 주세요.", path: "/admin/creators" },
} as const;

/**
 * 운영자(대표) 알림: 새 지원이 들어왔을 때 카카오톡으로 알립니다. (개인정보는 보내지 않고 안내 문구와 링크만)
 * 응답이 끝난 뒤에 보내므로 지원자 화면을 느리게 하지 않고, 실패해도 제출은 그대로 성공합니다.
 */
export async function notifyFounderNewApplication(kind: keyof typeof MESSAGES): Promise<void> {
  const origin = await requestOrigin();
  const m = MESSAGES[kind];
  after(async () => {
    const result = await sendKakaoMemo(
      {
        KAKAO_REST_API_KEY: process.env.KAKAO_REST_API_KEY,
        KAKAO_REFRESH_TOKEN: process.env.KAKAO_REFRESH_TOKEN,
        KAKAO_CLIENT_SECRET: process.env.KAKAO_CLIENT_SECRET,
      },
      { text: `[${brand.name}] ${m.text}`, linkUrl: `${origin}${m.path}` },
    );
    if (!result.sent && result.reason !== "not_configured") console.error("운영자 카카오톡 알림 실패:", result.reason);
  });
}

/** (호환) 정식 호스트 지원서 제출 알림 */
export const notifyFounderNewHostApplication = () => notifyFounderNewApplication("host");
