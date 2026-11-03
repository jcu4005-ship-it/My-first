"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { formatDate, formatPrice, formatTime } from "@/lib/format";
import { initialFormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

import { bookAction } from "./actions";

export type BookingSession = {
  id: string;
  starts_at: string;
  area: string;
  left: number;
  open: boolean;
  mine: boolean;
};

export function BookingForm({
  meetupId,
  price,
  maxQuantity,
  sessions,
  state: viewerState,
}: {
  meetupId: string;
  price: number;
  maxQuantity: number;
  sessions: BookingSession[];
  /** guest: 비로그인, sample: 샘플, own: 내 모임, ok: 신청 가능 */
  state: "guest" | "sample" | "own" | "ok";
}) {
  const [result, action, pending] = useActionState(bookAction, initialFormState);
  const firstAvailable = sessions.find((s) => s.open && s.left > 0 && !s.mine);
  const [sessionId, setSessionId] = useState(firstAvailable?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const selected = sessions.find((s) => s.id === sessionId);
  const maxForSelected = Math.min(maxQuantity, selected?.left ?? 1);

  return (
    <form action={action} className="flex flex-col gap-4" id="booking" data-testid="booking-form">
      <input type="hidden" name="meetupId" value={meetupId} />
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">일정 선택</legend>
        {sessions.map((s) => {
          const disabled = !s.open || s.left === 0 || s.mine || viewerState !== "ok";
          return (
            <label
              key={s.id}
              data-testid="session-row"
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors",
                sessionId === s.id && !disabled ? "border-foreground ring-1 ring-foreground" : "",
                disabled && "cursor-default opacity-70",
              )}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="sessionId"
                  value={s.id}
                  checked={sessionId === s.id}
                  disabled={disabled}
                  onChange={() => { setSessionId(s.id); setQuantity(1); }}
                  className="size-4 accent-[var(--foreground)]"
                />
                <span>
                  <span className="block font-medium">{formatDate(s.starts_at)}</span>
                  <span className="block text-sm text-muted-foreground">{formatTime(s.starts_at)} · {s.area}</span>
                </span>
              </span>
              <span className="text-xs">
                {s.mine ? (
                  <span className="font-semibold text-foreground" data-testid="session-mine">신청 완료</span>
                ) : !s.open || s.left === 0 ? (
                  <span className="text-muted-foreground" data-testid="seats-full">마감</span>
                ) : s.left <= 3 ? (
                  <span className="font-semibold text-accent">{s.left}자리 남음</span>
                ) : (
                  <span className="text-muted-foreground">{s.left}자리 남음</span>
                )}
              </span>
            </label>
          );
        })}
      </fieldset>

      {viewerState === "ok" && firstAvailable && maxQuantity > 1 && (
        <label className="flex items-center justify-between text-sm">
          <span>신청 인원</span>
          <select name="quantity" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}
            className="h-10 rounded-lg border border-border bg-background px-3" aria-label="신청 인원">
            {Array.from({ length: Math.max(1, maxForSelected) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}명</option>
            ))}
          </select>
        </label>
      )}
      {(maxQuantity === 1 || viewerState !== "ok") && <input type="hidden" name="quantity" value="1" />}

      <FormMessage message={result.message} />

      {viewerState === "guest" ? (
        <Button asChild size="lg">
          <Link href={`/login?next=/meetups/${meetupId}`}>로그인하고 신청하기</Link>
        </Button>
      ) : viewerState === "sample" ? (
        <Button size="lg" disabled>샘플 모임은 신청할 수 없어요</Button>
      ) : viewerState === "own" ? (
        <Button size="lg" disabled>내가 연 모임이에요</Button>
      ) : firstAvailable ? (
        <Button type="submit" size="lg" disabled={pending || !sessionId} data-testid="book-submit">
          {pending ? "신청 중…" : `${formatPrice(price * quantity)} · 참가 신청`}
        </Button>
      ) : (
        <Button size="lg" disabled>신청 가능한 일정이 없어요</Button>
      )}
      {viewerState === "ok" && <p className="text-center text-xs text-muted-foreground">결제 기능 준비 중으로, 지금은 신청 즉시 확정되고 참가비는 현장 안내에 따릅니다.</p>}
    </form>
  );
}
