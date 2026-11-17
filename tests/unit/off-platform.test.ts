import { describe, expect, it } from "vitest";

import { hasOffPlatformPayment } from "@/lib/validation/off-platform";
import { meetupFormSchema } from "@/lib/validation/meetup";

describe("플랫폼 밖 결제 안내 막기", () => {
  it.each([
    "참가비는 계좌로 보내 주세요",
    "국민 123456-01-234567 로 입금해 주세요",
    "문의 010-1234-5678",
    "01012345678 로 연락 주세요",
    "현장 결제도 가능해요",
    "현금으로 내셔도 돼요",
    "토스 송금 부탁드려요",
    "https://open.kakao.com/o/abc 오픈채팅",
    "toss.me/someone",
    "따로 결제하시면 할인",
  ])("막음: %s", (t) => expect(hasOffPlatformPayment(t)).toBe(true));

  it.each([
    "2026-11-17 오후 7시에 만나요",
    "참가비 30,000원에는 재료비가 포함돼요",
    "19:00 인사 / 19:30 실습",
    "환불은 결제하신 수단으로 처리돼요",
    "1~4명까지 함께 신청할 수 있어요",
    "",
  ])("통과: %s", (t) => expect(hasOffPlatformPayment(t)).toBe(false));

  it("프로그램 소개에 계좌가 있으면 저장 검사에서 걸린다", () => {
    const base = {
      title: "떨지 않고 3분 말하기", categorySlug: "speech", meetupType: "class", level: "all",
      learningOutcomes: "3분 동안 떨지 않고 말할 수 있어요", materialsNote: "", priceRationale: "",
      summary: "작은 자리에서 말하기 연습", description: "작은 자리에서 한 사람씩 연습합니다. 충분히 길게 적어요.",
      price: "30000", maxQuantity: "1", targetAudience: "", requirements: "", whatToBring: "", agenda: "", refundPolicyText: "",
    };
    expect(meetupFormSchema.safeParse(base).success).toBe(true);
    const bad = meetupFormSchema.safeParse({ ...base, description: base.description + " 참가비는 카카오뱅크 3333-01-1234567 로 송금" });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.path[0]).toBe("description");
  });
});
