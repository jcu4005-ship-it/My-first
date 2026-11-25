import { describe, expect, it, vi } from "vitest";

import { sendKakaoMemo } from "@/lib/notify/kakao";

const env = { KAKAO_REST_API_KEY: "key", KAKAO_REFRESH_TOKEN: "refresh" };
const msg = { text: "새 지원서", linkUrl: "https://example.com/admin/hosts" };
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("운영자 카카오톡 알림", () => {
  it("환경변수가 없으면 아무 요청도 보내지 않는다", async () => {
    const f = vi.fn();
    expect(await sendKakaoMemo({}, msg, f as unknown as typeof fetch)).toEqual({ sent: false, reason: "not_configured" });
    expect(f).not.toHaveBeenCalled();
  });

  it("토큰을 받은 뒤 나에게 보내기를 호출하고, 개인정보 없이 문구와 링크만 보낸다", async () => {
    const f = vi.fn().mockResolvedValueOnce(ok({ access_token: "access" })).mockResolvedValueOnce(ok({ result_code: 0 }));
    expect(await sendKakaoMemo(env, msg, f as unknown as typeof fetch)).toEqual({ sent: true });
    const [tokenUrl, tokenInit] = f.mock.calls[0];
    expect(tokenUrl).toBe("https://kauth.kakao.com/oauth/token");
    expect(String(tokenInit.body)).toContain("grant_type=refresh_token");
    const [sendUrl, sendInit] = f.mock.calls[1];
    expect(sendUrl).toBe("https://kapi.kakao.com/v2/api/talk/memo/default/send");
    expect(sendInit.headers.Authorization).toBe("Bearer access");
    const template = JSON.parse(new URLSearchParams(String(sendInit.body)).get("template_object")!);
    expect(template.text).toBe("새 지원서");
    expect(template.link.web_url).toBe("https://example.com/admin/hosts");
  });

  it("토큰 발급이 실패하면 보내지 않고 실패로 알려 준다 (예외는 던지지 않는다)", async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 401 }));
    expect(await sendKakaoMemo(env, msg, f as unknown as typeof fetch)).toEqual({ sent: false, reason: "token_failed" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("네트워크 오류가 나도 예외를 던지지 않는다", async () => {
    const f = vi.fn().mockRejectedValue(new Error("network"));
    expect(await sendKakaoMemo(env, msg, f as unknown as typeof fetch)).toEqual({ sent: false, reason: "error" });
  });
});
