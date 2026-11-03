"use client";

import { useActionState } from "react";

import { Field, FormMessage } from "@/components/forms/field";
import { TextareaField } from "@/components/forms/controls";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/forms";

import { applyHostAction } from "../actions";

export function ApplyForm({ defaults }: { defaults?: Record<string, string> }) {
  const [state, action, pending] = useActionState(applyHostAction, initialFormState);
  if (state.status === "success") {
    return <FormMessage message={state.message} tone="success" />;
  }
  const e = state.fieldErrors ?? {};
  const v = state.values ?? defaults ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage message={state.message} />
      <Field name="displayName" label="호스트 이름" defaultValue={v.displayName} error={e.displayName} hint="모임 페이지에 표시돼요. 예: 책방지기 윤서" />
      <Field name="headline" label="한 줄 소개" defaultValue={v.headline} error={e.headline} hint="예: 연남동 작은 책방에서 독서모임을 엽니다" />
      <TextareaField name="bio" label="어떤 모임을 열고 싶나요?" rows={6} defaultValue={v.bio} error={e.bio}
        hint="경험, 열고 싶은 모임, 참가자에게 주고 싶은 경험을 자유롭게 적어 주세요." />
      <Field name="expertise" label="관심 분야 (쉼표로 구분)" defaultValue={v.expertise} error={e.expertise} hint="예: 한국 문학, 에세이" />
      <Field name="instagram" label="인스타그램 (선택)" defaultValue={v.instagram} error={e.instagram} placeholder="@아이디" />
      <Button type="submit" size="lg" disabled={pending}>{pending ? "보내는 중…" : "호스트 신청하기"}</Button>
    </form>
  );
}
