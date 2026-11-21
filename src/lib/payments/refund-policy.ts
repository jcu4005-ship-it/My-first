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

const WD = ["일", "월", "화", "수", "목", "금", "토"];
/** 프로그램 날짜(한국 시간)에서 days 만큼 이동한 날짜 */
function kstShift(iso: string, days: number) {
  const k = new Date(new Date(iso).getTime() + 9 * 3600000 + days * 86400000);
  return { m: k.getUTCMonth() + 1, d: k.getUTCDate(), wd: WD[k.getUTCDay()] };
}

/** 화면 안내용: 이 프로그램의 환불 단계가 "언제까지"인지 실제 날짜로 (규칙은 REFUND_RULES 와 같음) */
export function refundSchedule(startsAtIso: string) {
  const full = kstShift(startsAtIso, -3);
  const a = kstShift(startsAtIso, -2);
  const b = kstShift(startsAtIso, -1);
  const day = kstShift(startsAtIso, 0);
  return {
    fullUntil: `${full.m}월 ${full.d}일(${full.wd})`,
    fullShort: `~ ${full.m}/${full.d}(${full.wd})`,
    halfShort: a.m === b.m ? `${a.m}/${a.d}~${b.d}` : `${a.m}/${a.d}~${b.m}/${b.d}`,
    dayShort: `${day.m}/${day.d} 당일`,
  };
}

/** 한 줄 안내: 지금 취소하면 어떻게 되는지를 날짜와 함께 (이미 100% 기간이 지났으면 지금 기준으로 사실대로) */
export function refundNowLine(startsAtIso: string, now: Date = new Date()): string {
  const pct = refundPercent(startsAtIso, now);
  if (pct === 100) return `${refundSchedule(startsAtIso).fullUntil}까지 취소하면 100% 환불`;
  if (pct === 50) return "지금 취소하면 50% 환불 (당일은 환불 없음)";
  return "지금은 취소해도 환불이 없어요 (프로그램 당일)";
}
