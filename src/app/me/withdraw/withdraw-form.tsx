"use client";

import { useActionState } from "react";

import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/forms";

import { withdrawAction } from "./actions";

export function WithdrawForm() {
  const [state, action, pending] = useActionState(withdrawAction, initialFormState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate data-testid="withdraw-form">
      <FormMessage message={state.message} />
      <Field name="password" label="비밀번호 확인" type="password" autoComplete="current-password" error={e.password} />
      <Field name="confirm" label="‘탈퇴합니다’를 입력해 주세요" error={e.confirm} />
      <Button type="submit" variant="outline" size="lg" disabled={pending} className="border-destructive text-destructive">
        {pending ? "처리 중…" : "회원 탈퇴"}
      </Button>
    </form>
  );
}
