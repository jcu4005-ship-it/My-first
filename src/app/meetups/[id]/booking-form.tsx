"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

import { SeatCircle } from "@/components/brand/seat-circle";
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
  capacity: number;
  reserved: number;
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
  face,
  initial,
}: {
  meetupId: string;
  price: number;
  maxQuantity: number;
  sessions: BookingSession[];
  /** guest: 비로그인, sample: 샘플, own: 내 프로그램, ok: 신청 가능 */
  state: "guest" | "sample" | "own" | "ok" | "beta_paid";
  /** 호스트가 쿠폰 허용에 동의한 유료 프로그램 */
  acceptCoupons?: boolean;
  /** 원 가운데 크리에이터 얼굴(없으면 첫 글자) */
  face?: string | null;
  initial?: string;
}) {
  const [result, action, pending] = useActionState(bookAction, initialFormState);
  const firstAvailable = sessions.find((s) => s.open && s.left > 0 && !s.mine);
  const [sessionId, setSessionId] = useState(firstAvailable?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const selected = sessions.find((s) => s.id === sessionId);
  const canBook = viewerState === "ok" && Boolean(firstAvailable);
  // 테이블 그림: 고른 일정(없으면 첫 일정)
  const shown = selected ?? sessions[0];
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
    <form action={action} className="flex scroll-mt-24 flex-col gap-3.5" id="booking" data-testid="booking-form">
      <input type="hidden" name="meetupId" value={meetupId} />
      {shown && (
        <div className="flex items-center gap-5 rounded-[22px] border border-border bg-card p-4 sm:gap-6">
          <div className="w-28 shrink-0 sm:w-32">
            <SeatCircle
              decorative
              capacity={shown.capacity}
              taken={shown.reserved + (canBook && selected ? quantity - 1 : 0)}
              you={!shown.open || shown.left === 0 ? false : canBook && selected ? "open" : false}
              face={face}
              initial={initial}
            />
          </div>
          <div className="min-w-0">
            <p className="text-[20px] leading-tight font-bold tracking-[-0.02em] break-keep sm:text-[22px]">
              {!shown.open || shown.left === 0 ? "모집 마감 · 원이 가득 찼어요" : shown.reserved === 0 ? "첫 번째 자리예요" : `${shown.left}자리 남았어요`}
            </p>
            <p className="mt-1 text-[14.5px] text-muted-foreground">
              정원 {shown.capacity}명 · {shown.reserved}명 신청{shown.open && shown.left > 0 ? ` · ${shown.left}자리 남음` : ""}
            </p>
          </div>
        </div>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">일정 선택</legend>
        {sessions.map((s) => {
          const disabled = !s.open || s.left === 0 || s.mine || viewerState !== "ok";
          return (
            <label
              key={s.id}
              data-testid="session-row"
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 rounded-[14px] border-[1.5px] border-border bg-card px-4 py-3 transition-colors",
                sessionId === s.id && !disabled ? "border-gold" : "hover:border-foreground/40",
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
                  className="size-4 accent-[var(--gold)]"
                />
                <span>
                  <span className="block font-semibold">{formatDate(s.starts_at)}</span>
                  <span className="block text-sm text-muted-foreground">{formatTime(s.starts_at)} · {s.area}</span>
                </span>
              </span>
              <span className="text-[13px]">
                {s.mine ? (
                  <span className="pill bg-gold text-gold-ink" data-testid="session-mine">내 자리</span>
                ) : !s.open || s.left === 0 ? (
                  <span className="text-muted-foreground" data-testid="seats-full">마감</span>
                ) : s.left <= 3 ? (
                  <span className="font-bold text-gold">{s.left}자리 남음</span>
                ) : (
                  <span className="text-muted-foreground">{s.left}자리 남음</span>
                )}
              </span>
            </label>
          );
        })}
      </fieldset>

      {viewerState === "ok" && firstAvailable && maxQuantity > 1 && (
        <label className="flex items-center justify-between rounded-[14px] border-[1.5px] border-border px-4 py-3 text-sm">
          <span className="font-medium">신청 인원</span>
          <select name="quantity" value={quantity} onChange={(e) => { setQuantity(Number(e.target.value)); resetCoupon(); }}
            className="h-10 rounded-xl border border-border bg-card px-3 text-foreground" aria-label="신청 인원">
            {Array.from({ length: Math.max(1, maxForSelected) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}명</option>
            ))}
          </select>
        </label>
      )}
      {(maxQuantity === 1 || viewerState !== "ok") && <input type="hidden" name="quantity" value="1" />}

      {viewerState === "ok" && firstAvailable && acceptCoupons && (
        <div className="flex flex-col gap-2 rounded-[14px] border-[1.5px] border-border px-4 py-3" data-testid="coupon">
          <label htmlFor="couponCode" className="text-sm font-medium">할인 쿠폰 (선택)</label>
          <div className="flex gap-2">
            <input
              id="couponCode"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); resetCoupon(); }}
              maxLength={20}
              autoComplete="off"
              placeholder="쿠폰 코드"
              className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-base text-foreground uppercase sm:text-sm"
            />
            <Button type="button" variant="outline" disabled={checking || !code.trim() || !sessionId} onClick={checkCoupon}>
              {checking ? "확인 중…" : "적용"}
            </Button>
          </div>
          {preview && (
            <p role={preview.ok ? "status" : "alert"} className={cn("text-sm", preview.ok ? "font-semibold text-forest" : "text-destructive")} data-testid="coupon-result">
              {preview.ok ? `${preview.percent}% 할인 적용 · −${formatPrice(preview.discount)}` : preview.message}
            </p>
          )}
          <input type="hidden" name="couponCode" value={applied?.code ?? ""} />
        </div>
      )}

      <FormMessage message={result.message} />

      {viewerState === "guest" ? (
        <Button asChild size="lg" className="h-14 w-full rounded-xl text-[16px] font-bold">
          <Link href={`/login?next=/meetups/${meetupId}`}>로그인하고 신청하기</Link>
        </Button>
      ) : viewerState === "beta_paid" ? (
        <div className="flex flex-col gap-2" data-testid="beta-paid-notice">
          <Button size="lg" className="w-full" disabled>비공개 베타 기간에는 무료 프로그램만 신청할 수 있어요</Button>
          <p className="text-center text-[13px] text-muted-foreground">결제 기능은 정식 오픈 때 열려요.</p>
        </div>
      ) : viewerState === "sample" ? (
        <Button size="lg" className="w-full" disabled>샘플 프로그램은 신청할 수 없어요</Button>
      ) : viewerState === "own" ? (
        <Button size="lg" className="w-full" disabled>내가 연 프로그램이에요</Button>
      ) : firstAvailable ? (
        <Button type="submit" size="lg" className="h-14 w-full rounded-xl text-[16px] font-bold" disabled={pending || !sessionId} data-testid="book-submit">
          {pending ? "자리 잡는 중…" : `이 자리에 앉기 · ${formatPrice(applied ? applied.total : price * quantity)}`}
        </Button>
      ) : (
        <Button size="lg" className="w-full" disabled>신청 가능한 일정이 없어요</Button>
      )}
      {viewerState === "ok" && <p className="text-center text-[13px] text-muted-foreground">무료 프로그램은 바로 확정되고, 유료 프로그램은 테스트 결제 화면으로 이동해요. (지금은 실제 청구가 없는 테스트 모드)</p>}
    </form>
  );
}
