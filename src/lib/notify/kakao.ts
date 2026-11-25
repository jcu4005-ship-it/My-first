/**
 * 카카오톡 "나에게 보내기" (운영자 본인에게 알림)
 *
 * - 카카오 개발자 앱의 REST API 키와, 운영자가 한 번 동의해서 받은 리프레시 토큰으로 동작합니다.
 * - 환경변수가 없으면 아무것도 하지 않습니다(로컬·테스트 환경 안전).
 * - 알림은 보조 수단입니다. 실패해도 호출한 쪽(지원서 제출 등)은 절대 실패하지 않습니다.
 * - 개인정보(이름·연락처·답변)는 보내지 않습니다. 건수 안내와 관리자 화면 링크만 보냅니다.
 *
 * 한계: 카카오 리프레시 토큰은 60일 유효이고, 만료 1개월 전부터 사용하면 새 토큰이 발급됩니다.
 * 이 코드는 새 토큰을 저장하지 못하므로 60일 이상 알림을 한 번도 안 쓰면 토큰을 다시 받아야 합니다.
 * 정식 운영에서는 알림톡(사업자 필요)으로 바꾸는 것을 권장합니다.
 */

export type KakaoEnv = {
  KAKAO_REST_API_KEY?: string;
  KAKAO_REFRESH_TOKEN?: string;
  KAKAO_CLIENT_SECRET?: string;
};

export type KakaoResult = { sent: boolean; reason?: "not_configured" | "token_failed" | "send_failed" | "error" };

const TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const MEMO_URL = "https://kapi.kakao.com/v2/api/talk/memo/default/send";

export async function sendKakaoMemo(
  env: KakaoEnv,
  message: { text: string; linkUrl: string },
  fetchImpl: typeof fetch = fetch,
): Promise<KakaoResult> {
  const apiKey = env.KAKAO_REST_API_KEY;
  const refresh = env.KAKAO_REFRESH_TOKEN;
  if (!apiKey || !refresh) return { sent: false, reason: "not_configured" };

  try {
    const tokenBody = new URLSearchParams({ grant_type: "refresh_token", client_id: apiKey, refresh_token: refresh });
    if (env.KAKAO_CLIENT_SECRET) tokenBody.set("client_secret", env.KAKAO_CLIENT_SECRET);
    const tokenRes = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: tokenBody,
      signal: AbortSignal.timeout(5000),
    });
    if (!tokenRes.ok) return { sent: false, reason: "token_failed" };
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) return { sent: false, reason: "token_failed" };

    const template = {
      object_type: "text",
      text: message.text,
      link: { web_url: message.linkUrl, mobile_web_url: message.linkUrl },
      button_title: "확인하기",
    };
    const sendRes = await fetchImpl(MEMO_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
      body: new URLSearchParams({ template_object: JSON.stringify(template) }),
      signal: AbortSignal.timeout(5000),
    });
    return sendRes.ok ? { sent: true } : { sent: false, reason: "send_failed" };
  } catch {
    return { sent: false, reason: "error" };
  }
}
