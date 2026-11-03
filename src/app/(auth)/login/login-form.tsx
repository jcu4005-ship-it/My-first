"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";

import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/forms";

import { signInAction } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signInAction, initialFormState);
  const next = useSearchParams().get("next") ?? "";
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage message={state.message} />
      <input type="hidden" name="next" value={next} />
      <Field name="email" label="이메일" type="email" autoComplete="email" required defaultValue={state.values?.email} error={e.email} />
      <Field name="password" label="비밀번호" type="password" autoComplete="current-password" required error={e.password} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "확인 중…" : "로그인"}
      </Button>
    </form>
  );
}
