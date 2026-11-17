"use client";

import { Star } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import { FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { initialFormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

import { writeReviewAction } from "./actions";

/** 별점(1~5) + 후기 글. 별은 라디오 버튼이라 키보드로도 고를 수 있어요. */
export function ReviewForm({ bookingId, title }: { bookingId: string; title: string }) {
  const [state, action, pending] = useActionState(writeReviewAction, initialFormState);
  const [rating, setRating] = useState(0);
  if (state.status === "success") {
    return <FormMessage message={state.message} tone="success" />;
  }
  return (
    <form
      // 직접 제출: 기본 form action은 제출 뒤 입력을 비워서, 검사 오류가 나면 별점·글이 사라져요
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="mt-3 flex flex-col gap-3"
      data-testid="review-form"
      noValidate
    >
      <input type="hidden" name="bookingId" value={bookingId} />
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold">별점</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="rating" value={n} className="peer sr-only" checked={rating === n} onChange={() => setRating(n)} aria-label={`${n}점`} />
              <Star
                aria-hidden
                className={cn("size-7 text-ember transition-transform peer-focus-visible:scale-110 peer-focus-visible:outline", n <= rating ? "" : "opacity-35")}
                strokeWidth={1.5}
                fill={n <= rating ? "currentColor" : "none"}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">후기</span>
        <Textarea name="body" rows={4} maxLength={1000} placeholder={`'${title}'에서 어떤 시간을 보냈나요? (10자 이상)`} />
      </label>
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "남기는 중…" : "후기 남기기"}
      </Button>
      <FormMessage message={state.message} tone="error" />
    </form>
  );
}
