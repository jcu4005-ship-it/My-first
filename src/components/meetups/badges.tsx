import type { Session } from "@/lib/meetups/queries";

export function SampleBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center bg-sand-light/95 px-2 py-0.5 text-[11px] font-medium tracking-wider text-espresso ${className}`}
      data-testid="sample-badge"
      title="서비스 준비 중 보여 드리는 샘플 클래스입니다"
    >
      샘플
    </span>
  );
}

export function seatsLeft(s: Session) {
  return Math.max(0, s.capacity - s.reserved_count);
}

export function SeatsBadge({ session }: { session: Session }) {
  const left = seatsLeft(session);
  if (left === 0 || session.status !== "open") {
    return <span className="text-xs font-medium text-muted-foreground" data-testid="seats-full">마감</span>;
  }
  if (left <= 3) {
    return <span className="text-xs font-semibold text-terracotta-deep">{left}자리 남음</span>;
  }
  return <span className="text-xs text-muted-foreground">{left}자리 남음</span>;
}
