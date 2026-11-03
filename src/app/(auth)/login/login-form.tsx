"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";

import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/forms";

import { signInAction } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signInAction, initialFormState);
  const search = useSearchParams();
  const next = search.get("next") ?? "";
  const verified = search.get("notice") === "verified";
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {verified && !state.message && <FormMessage message="이메일 인증이 완료됐어요. 로그인해 주세요." tone="success" />}
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
