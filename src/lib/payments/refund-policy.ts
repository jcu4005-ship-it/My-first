/**
 * 플랫폼 공통 환불 기준 (대표 결정 2026-11-18) — 화면 안내용.
 * 실제 환불 금액은 DB(private.refund_percent)가 같은 규칙으로 계산합니다.
 * 참가자 취소: 프로그램 날짜(한국 시간) 기준 3일 전까지 100% · 2~1일 전 50% · 당일 0%
 * 호스트 사정 취소: 항상 100%
 */
export const REFUND_RULES = [
  { when: "프로그램 3일 전까지", percent: 100 },
  { when: "프로그램 2일 전 ~ 1일 전", percent: 50 },
  { when: "프로그램 당일", percent: 0 },
] as const;

function kstDay(d: Date): number {
  const k = new Date(d.getTime() + 9 * 3600000);
  return Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()) / 86400000;
}

/** 지금 참가자가 취소하면 몇 % 환불되는지 */
export function refundPercent(startsAtIso: string, now: Date = new Date()): number {
  const days = kstDay(new Date(startsAtIso)) - kstDay(now);
  return days >= 3 ? 100 : days >= 1 ? 50 : 0;
}
