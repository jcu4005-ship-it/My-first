"use client";

import { useActionState } from "react";

import { TextareaField } from "@/components/forms/controls";
import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/forms";

import { updateHostProfileAction } from "../actions";

import { AvatarField } from "./avatar-field";

export function HostProfileForm({ userId, avatarPath, defaults }: { userId: string; avatarPath: string | null; defaults: Record<string, string> }) {
  const [state, action, pending] = useActionState(updateHostProfileAction, initialFormState);
  const e = state.fieldErrors ?? {};
  const v = state.values ?? defaults;
  return (
    <form action={action} className="flex flex-col gap-6" noValidate data-testid="host-profile-form">
      <FormMessage message={state.message} tone={state.status === "success" ? "success" : "error"} />
      <AvatarField userId={userId} initialPath={avatarPath} />
      <Field name="displayName" label="호스트 이름" defaultValue={v.displayName} error={e.displayName} />
      <Field name="occupation" label="직업·전문 분야 (한 줄)" defaultValue={v.occupation} error={e.occupation} hint="예: 광고 사진가 · 스튜디오 운영" />
      <Field name="headline" label="한 줄 소개" defaultValue={v.headline} error={e.headline} />
      <TextareaField name="bio" label="호스트 소개" rows={5} defaultValue={v.bio} error={e.bio} />
      <TextareaField name="philosophy" label="작업 철학 (선택)" rows={3} defaultValue={v.philosophy} error={e.philosophy}
        hint="무엇을 중요하게 여기며 가르치는지. 호스트 페이지에 인용처럼 크게 보여요." />
      <TextareaField name="career" label="경력" rows={3} defaultValue={v.career} error={e.career} />
      <Field name="credentials" label="자격증·수상·학력 (선택)" defaultValue={v.credentials} error={e.credentials} />
      <Field name="teachingExperience" label="가르쳐 본 경험 (선택)" defaultValue={v.teachingExperience} error={e.teachingExperience} />
      <Field name="portfolioUrl" label="포트폴리오 링크 (선택)" defaultValue={v.portfolioUrl} error={e.portfolioUrl} placeholder="https://" />
      <Field name="expertise" label="전문 분야 (쉼표로 구분)" defaultValue={v.expertise} error={e.expertise} />
      <Field name="instagram" label="인스타그램 (선택)" defaultValue={v.instagram} error={e.instagram} placeholder="@아이디" />
      <Button type="submit" size="lg" disabled={pending} className="self-start">{pending ? "저장 중…" : "프로필 저장"}</Button>
    </form>
  );
}
