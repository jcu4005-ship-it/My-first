const TZ = "Asia/Seoul";

export function formatPrice(won: number): string {
  return won === 0 ? "무료" : `${won.toLocaleString("ko-KR")}원`;
}

/** 11월 8일 (토) */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, month: "long", day: "numeric", weekday: "short" }).format(
    new Date(iso),
  );
}

/** 오후 2:00 */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** 11.8 (토) 오후 2:00 */
export function formatShortDateTime(iso: string): string {
  const d = new Date(iso);
  const md = new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, month: "numeric", day: "numeric" })
    .formatToParts(d)
    .filter((p) => p.type === "month" || p.type === "day")
    .map((p) => p.value)
    .join(".");
  const wd = new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, weekday: "short" }).format(d);
  return `${md} (${wd}) ${formatTime(iso)}`;
}

export function durationLabel(startIso: string, endIso: string): string {
  const minutes = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h}시간` : "", m ? `${m}분` : ""].filter(Boolean).join(" ");
}

/** 아직 시작하지 않은 일정인지 (요청 시점 기준) */
export function isFuture(iso: string): boolean {
  return new Date(iso).getTime() > Date.now();
}

/** 2026. 11. 9. */
export function formatYmd(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric" }).format(new Date(iso));
}
