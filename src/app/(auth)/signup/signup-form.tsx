"use client";

import { useActionState } from "react";

import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/forms";

import { signUpAction } from "../actions";

function Check({ name, label, required, error }: { name: string; label: string; required?: boolean; error?: string }) {
  return (
    <div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name={name} className="mt-0.5 size-4 accent-[var(--foreground)]" aria-invalid={error ? true : undefined} />
        <span>
          <span className={required ? "font-medium" : "text-muted-foreground"}>{required ? "[필수]" : "[선택]"}</span>{" "}
          {label}
        </span>
      </label>
      {error && (
        <p className="mt-1 pl-7 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, initialFormState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage message={state.message} />
      <Field name="email" label="이메일" type="email" autoComplete="email" required defaultValue={state.values?.email} error={e.email} />
      <Field
        name="nickname"
        label="닉네임"
        autoComplete="nickname"
        required
        defaultValue={state.values?.nickname}
        error={e.nickname}
        hint="2~20자, 한글·영문·숫자·_·. 사용 가능. 대소문자·띄어쓰기만 다른 닉네임은 같은 닉네임으로 봅니다."
      />
      <Field
        name="password"
        label="비밀번호"
        type="password"
        autoComplete="new-password"
        required
        error={e.password}
        hint="10자 이상, 영문과 숫자를 모두 포함해 주세요."
      />
      <Field name="passwordConfirm" label="비밀번호 확인" type="password" autoComplete="new-password" required error={e.passwordConfirm} />

      <fieldset className="mt-2 flex flex-col gap-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">약관 동의</legend>
        <p className="text-xs text-muted-foreground">
          현재 약관·개인정보 처리 문구는 출시 전 법률 검토를 거쳐 확정될 임시 문안입니다.
        </p>
        <Check name="agreeTerms" label="이용약관 동의" required error={e.agreeTerms} />
        <Check name="agreePrivacy" label="개인정보 수집·이용 동의" required error={e.agreePrivacy} />
        <Check name="confirmAge14" label="만 14세 이상입니다" required error={e.confirmAge14} />
        <Check name="agreeMarketing" label="이벤트·혜택 정보 수신 동의" />
      </fieldset>

      <Button type="submit" size="lg" disabled={pending} className="mt-2">
        {pending ? "처리 중…" : "가입하기"}
      </Button>
    </form>
  );
}
