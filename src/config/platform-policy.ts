/**
 * 설계안 v1.0에서 확정된 "잠금" 규칙과 초기 운영값.
 *
 * - LOCKED: 코드로 고정된 안전장치. 바꾸려면 설계 변경 승인 + 코드 변경이 필요합니다.
 * - INITIAL_SETTINGS: 운영 설정의 초기값. 이후 단계에서 DB(platform_settings)로 옮겨
 *   관리자가 바꿀 수 있게 합니다. (아직 DB 미구현 — 0단계에서는 값만 정의)
 */
export const LOCKED = {
  /** 정산 방식: 관리자 수동 확인만 존재 (자동 정산·자동 이체 미구현) */
  settlementMode: "manual",
  autoSettlementEnabled: false,
  /** 실결제는 PG 계약·정산 구조 확인 + 승인 전까지 비활성 (env.ts에서도 차단) */
  livePaymentsEnabled: false,
  /** 예약 1건당 인원 허용 범위 (호스트가 이 범위 안에서 프로그램별 설정) */
  bookingQuantity: { min: 1, max: 4, default: 1 },
  /** 인원 변경·부분 취소는 MVP 제외 */
  partialCancellationEnabled: false,
  bookingQuantityChangeEnabled: false,
  /** 호스트 사유 취소 시 환불율(%) — 법적 최소 보호선 */
  hostCancellationRefundPercent: 100,
} as const;

/** 법률·운영 검토 완료 전까지 개설할 수 없는 프로그램 유형 (설계안 9-5) */
export const MEETUP_TYPES_LOCKED_PENDING_REVIEW = ["alcohol"] as const;

export const INITIAL_SETTINGS = {
  /** 정산 대상: 프로그램 종료 후 N일 경과 + 열린 분쟁 없음 */
  settlementEligibilityDays: 7,
  /** 정산 주기: 월 2회 (15일·말일 마감) */
  settlementCycle: "semi_monthly",
  /** 정산서 작성자와 확정자 분리 강제 — 초기 비활성 (이력은 항상 기록) */
  requireSeparateSettlementConfirmer: false,
  /** 결제 대기 좌석 확보 시간(분) */
  bookingHoldMinutes: 10,
} as const;
