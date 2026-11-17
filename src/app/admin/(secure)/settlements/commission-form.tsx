"use client";

import { startTransition, useActionState } from "react";

import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/forms";

import { setCommissionAction } from "../actions";

/** 수수료율·0% 기간 변경 (사유 필수, 감사 기록) */
export function CommissionForm({ ratePercent, freeMonths }: { ratePercent: number; freeMonths: number }) {
  const [state, action, pending] = useActionState(setCommissionAction, initialFormState);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="grid gap-3 sm:grid-cols-3"
      data-testid="commission-form"
      noValidate
    >
      <div className="sm:col-span-3"><FormMessage message={state.message} tone={state.status === "success" ? "success" : "error"} /></div>
      <Field name="ratePercent" label="수수료율 (%)" inputMode="decimal" defaultValue={String(ratePercent)} />
      <Field name="freeMonths" label="승인 후 0% 기간 (개월)" inputMode="numeric" defaultValue={String(freeMonths)} />
      <Field name="reason" label="변경 사유" hint="감사 기록에 남아요" />
      <div className="sm:col-span-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "저장 중…" : "수수료 설정 저장"}</Button>
      </div>
    </form>
  );
}
