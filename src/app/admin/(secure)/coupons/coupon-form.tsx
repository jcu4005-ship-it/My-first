"use client";

import { SelectField } from "@/components/forms/controls";
import { Field, FormMessage } from "@/components/forms/field";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";

import { createCouponAction } from "../actions";

/** 쿠폰 발급 폼 — 할인율은 1~10%만 (DB도 같은 한도를 강제) */
export function CouponForm() {
  const [state, action, pending, version] = useFormAction(createCouponAction);
  const e = state.fieldErrors ?? {};
  const v = state.status === "error" ? (state.values ?? {}) : {};
  return (
    <form key={version} action={action} className="grid gap-4 border p-5 sm:grid-cols-2" data-testid="coupon-form" noValidate>
      <div className="sm:col-span-2"><FormMessage message={state.message} tone={state.status === "success" ? "success" : "error"} /></div>
      <Field name="code" label="쿠폰 코드" defaultValue={v.code} error={e.code} hint="영문 대문자·숫자·하이픈, 예: WELCOME10" />
      <Field name="name" label="쿠폰 이름" defaultValue={v.name} error={e.name} hint="참가자 결제 화면에 보여요" />
      <SelectField name="percent" label="할인율" defaultValue={v.percent ?? "10"}
        options={Array.from({ length: 10 }, (_, i) => ({ value: String(10 - i), label: `${10 - i}%` }))} />
      <Field name="max" label="사용 한도 (선택)" inputMode="numeric" defaultValue={v.max} error={e.max} hint="비우면 제한 없음" />
      <Field name="endsOn" label="마지막 사용일 (선택)" type="date" defaultValue={v.endsOn} error={e.endsOn} />
      <label className="flex items-center gap-2 self-end text-sm">
        <input type="checkbox" name="firstOnly" defaultChecked={v.firstOnly === "on"} className="size-4" />
        첫 참여 전용 (확정된 신청이 없는 회원만)
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "만드는 중…" : "쿠폰 만들기"}</Button>
      </div>
    </form>
  );
}
