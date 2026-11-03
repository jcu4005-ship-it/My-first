import { describe, expect, it } from "vitest";

import { brand, displayName } from "@/config/brand";
import {
  INITIAL_SETTINGS,
  LOCKED,
  MEETUP_TYPES_LOCKED_PENDING_REVIEW,
} from "@/config/platform-policy";

describe("설계안 v1.0 잠금 규칙", () => {
  it("자동 정산과 실결제는 비활성이다", () => {
    expect(LOCKED.settlementMode).toBe("manual");
    expect(LOCKED.autoSettlementEnabled).toBe(false);
    expect(LOCKED.livePaymentsEnabled).toBe(false);
  });

  it("예약 인원은 1~4명, 기본 1명이다", () => {
    expect(LOCKED.bookingQuantity).toEqual({ min: 1, max: 4, default: 1 });
  });

  it("인원 변경·부분 취소는 MVP에서 제외된다", () => {
    expect(LOCKED.partialCancellationEnabled).toBe(false);
    expect(LOCKED.bookingQuantityChangeEnabled).toBe(false);
  });

  it("주류 모임 유형은 검토 완료 전 잠겨 있다", () => {
    expect(MEETUP_TYPES_LOCKED_PENDING_REVIEW).toContain("alcohol");
  });

  it("정산 초기값: 7일, 월 2회, 작성자/확정자 분리 비활성", () => {
    expect(INITIAL_SETTINGS.settlementEligibilityDays).toBe(7);
    expect(INITIAL_SETTINGS.settlementCycle).toBe("semi_monthly");
    expect(INITIAL_SETTINGS.requireSeparateSettlementConfirmer).toBe(false);
  });
});

describe("브랜드 설정", () => {
  it("가칭 표기를 선택적으로 붙인다", () => {
    expect(displayName()).toBe(brand.name);
    expect(displayName({ withPlaceholderMark: true })).toBe(`${brand.name} (가칭)`);
  });
});
