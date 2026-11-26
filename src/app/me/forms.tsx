"use client";

import { useActionState } from "react";

import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/forms";

import { updatePrivateAction, updateProfileAction } from "./actions";

export function ProfileForm({ nickname, bio }: { nickname: string; bio: string | null }) {
  const [state, action, pending] = useActionState(updateProfileAction, initialFormState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage message={state.message} tone={state.status === "success" ? "success" : "error"} />
      <Field name="nickname" label="닉네임" defaultValue={state.values?.nickname ?? nickname} error={e.nickname} required />
      <div className="flex flex-col gap-2">
        <Label htmlFor="bio">소개</Label>
        <Textarea id="bio" name="bio" maxLength={300} defaultValue={state.values?.bio ?? bio ?? ""} aria-invalid={e.bio ? true : undefined} />
        {e.bio && <p className="text-xs text-destructive">{e.bio}</p>}
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "저장 중…" : "프로필 저장"}
      </Button>
    </form>
  );
}

export function PrivateForm({ phone, birthYear }: { phone: string | null; birthYear: number | null }) {
  const [state, action, pending] = useActionState(updatePrivateAction, initialFormState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage message={state.message} tone={state.status === "success" ? "success" : "error"} />
      <Field
        name="phone"
        label="휴대폰 번호 (선택)"
        inputMode="tel"
        autoComplete="tel"
        defaultValue={state.values?.phone ?? phone ?? ""}
        error={e.phone}
        hint="호스트에게 공개되지 않습니다. 예약 관련 운영 연락에만 사용합니다."
      />
      <Field
        name="birthYear"
        label="출생연도 (선택)"
        inputMode="numeric"
        defaultValue={state.values?.birthYear ?? (birthYear ? String(birthYear) : "")}
        error={e.birthYear}
      />
      <Button type="submit" disabled={pending} variant="outline" className="self-start">
        {pending ? "저장 중…" : "비공개 정보 저장"}
      </Button>
    </form>
  );
}
