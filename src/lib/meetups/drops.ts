import { isFuture } from "@/lib/format";

const TZ = "Asia/Seoul";

/** 열림 시각(드롭)이 아직 안 된 일정인지 — 비어 있으면 바로 신청 가능 */
export function isNotYetOpen(s: { opens_at?: string | null }): boolean {
  return Boolean(s.opens_at) && isFuture(s.opens_at as string);
}

/** 한국 날짜 기준 하루 번호 (오늘·내일 계산용) */
function kstDay(d: Date): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(d).map((x) => [x.type, x.value]));
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)) / 86_400_000;
}

/** "오늘 20:00" · "내일 20:00" · "11.27 (목) 20:00" */
export function opensLabel(iso: string): string {
  const d = new Date(iso);
  const hm = new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  const diff = kstDay(d) - kstDay(new Date());
  if (diff === 0) return `오늘 ${hm}`;
  if (diff === 1) return `내일 ${hm}`;
  const md = new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, month: "numeric", day: "numeric" }).formatToParts(d).filter((p) => p.type === "month" || p.type === "day").map((p) => p.value).join(".");
  const wd = new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, weekday: "short" }).format(d);
  return `${md} (${wd}) ${hm}`;
}

/** 한국 날짜 키 "2026-11-27" (하루 묶음·정렬용) */
export function kstDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** 오늘로부터 몇 일 뒤인지 (한국 날짜 기준, 오늘 = 0) */
export function kstDaysFromToday(iso: string): number {
  return kstDay(new Date(iso)) - kstDay(new Date());
}

/** "27 (목)" */
export function kstDayShort(iso: string): { day: string; wd: string } {
  const d = new Date(iso);
  return {
    day: new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, day: "numeric" }).format(d).replace("일", ""),
    wd: new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, weekday: "short" }).format(d),
  };
}

/** "20:00" */
export function kstTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}
