"use client";

import { useActionState } from "react";

import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/forms";

import { updatePasswordAction } from "../actions";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, initialFormState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage message={state.message} />
      <Field name="password" label="새 비밀번호" type="password" autoComplete="new-password" required error={e.password} hint="10자 이상, 영문과 숫자를 모두 포함해 주세요." />
      <Field name="passwordConfirm" label="새 비밀번호 확인" type="password" autoComplete="new-password" required error={e.passwordConfirm} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "변경 중…" : "비밀번호 변경"}
      </Button>
    </form>
  );
}
