"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

import { FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { formatDate, formatPrice, formatTime } from "@/lib/format";
import { initialFormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

import { bookAction, previewCouponAction, type CouponPreview } from "./actions";

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
  acceptCoupons = false,
}: {
  meetupId: string;
  price: number;
  maxQuantity: number;
  sessions: BookingSession[];
  /** guest: 비로그인, sample: 샘플, own: 내 프로그램, ok: 신청 가능 */
  state: "guest" | "sample" | "own" | "ok";
  /** 호스트가 쿠폰 허용에 동의한 유료 프로그램 */
  acceptCoupons?: boolean;
}) {
  const [result, action, pending] = useActionState(bookAction, initialFormState);
  const firstAvailable = sessions.find((s) => s.open && s.left > 0 && !s.mine);
  const [sessionId, setSessionId] = useState(firstAvailable?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const selected = sessions.find((s) => s.id === sessionId);
  const maxForSelected = Math.min(maxQuantity, selected?.left ?? 1);
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<CouponPreview | null>(null);
  const [checking, startCheck] = useTransition();
  const applied = preview?.ok ? preview : null;
  const resetCoupon = () => setPreview(null);
  const checkCoupon = () =>
    startCheck(async () => {
      setPreview(await previewCouponAction({ sessionId, quantity, code }));
    });

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
                "flex cursor-pointer items-center justify-between gap-3 border bg-white/60 px-4 py-4 transition-colors",
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
                  onChange={() => { setSessionId(s.id); setQuantity(1); resetCoupon(); }}
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
                  <span className="font-semibold text-clay">{s.left}자리 남음</span>
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
          <select name="quantity" value={quantity} onChange={(e) => { setQuantity(Number(e.target.value)); resetCoupon(); }}
            className="h-10 rounded-[2px] border border-border bg-white px-3" aria-label="신청 인원">
            {Array.from({ length: Math.max(1, maxForSelected) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}명</option>
            ))}
          </select>
        </label>
      )}
      {(maxQuantity === 1 || viewerState !== "ok") && <input type="hidden" name="quantity" value="1" />}

      {viewerState === "ok" && firstAvailable && acceptCoupons && (
        <div className="flex flex-col gap-2" data-testid="coupon">
          <label htmlFor="couponCode" className="text-sm">할인 쿠폰 (선택)</label>
          <div className="flex gap-2">
            <input
              id="couponCode"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); resetCoupon(); }}
              maxLength={20}
              autoComplete="off"
              placeholder="쿠폰 코드"
              className="h-10 min-w-0 flex-1 rounded-[2px] border border-border bg-white px-3 text-sm uppercase"
            />
            <Button type="button" variant="outline" disabled={checking || !code.trim() || !sessionId} onClick={checkCoupon}>
              {checking ? "확인 중…" : "적용"}
            </Button>
          </div>
          {preview && (
            <p role={preview.ok ? "status" : "alert"} className={cn("text-sm", preview.ok ? "text-foreground" : "text-destructive")} data-testid="coupon-result">
              {preview.ok ? `${preview.percent}% 할인 적용 · −${formatPrice(preview.discount)}` : preview.message}
            </p>
          )}
          <input type="hidden" name="couponCode" value={applied?.code ?? ""} />
        </div>
      )}

      <FormMessage message={result.message} />

      {viewerState === "guest" ? (
        <Button asChild size="lg">
          <Link href={`/login?next=/meetups/${meetupId}`}>로그인하고 신청하기</Link>
        </Button>
      ) : viewerState === "sample" ? (
        <Button size="lg" disabled>샘플 프로그램은 신청할 수 없어요</Button>
      ) : viewerState === "own" ? (
        <Button size="lg" disabled>내가 연 프로그램이에요</Button>
      ) : firstAvailable ? (
        <Button type="submit" size="lg" disabled={pending || !sessionId} data-testid="book-submit">
          {pending ? "신청 중…" : `${formatPrice(applied ? applied.total : price * quantity)} · 참가 신청`}
        </Button>
      ) : (
        <Button size="lg" disabled>신청 가능한 일정이 없어요</Button>
      )}
      {viewerState === "ok" && <p className="text-center text-xs text-muted-foreground">무료 프로그램은 바로 확정되고, 유료 프로그램은 테스트 결제 화면으로 이동해요. (지금은 실제 청구가 없는 테스트 모드)</p>}
    </form>
  );
}
