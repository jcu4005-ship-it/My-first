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
      <Field name="displayName" label="호스트 이름" defaultValue={v.displayName} error={e.displayName} hint="클래스 페이지에 표시돼요. 예: 필름로그 도현" />
      <Field name="headline" label="한 줄 소개" defaultValue={v.headline} error={e.headline} hint="예: 필름 현상소를 운영하는 10년 차 사진가" />
      <TextareaField name="career" label="가르칠 분야의 경력" rows={4} defaultValue={v.career} error={e.career}
        hint="어디서 몇 년 동안 어떤 일을 했는지 적어 주세요. 운영팀 심사 기준이며 호스트 소개에 표시돼요." />
      <Field name="credentials" label="자격증·수상·학력 (선택)" defaultValue={v.credentials} error={e.credentials} hint="예: 가죽공예 지도사, 사진 공모전 입선" />
      <Field name="portfolioUrl" label="포트폴리오 링크 (선택)" defaultValue={v.portfolioUrl} error={e.portfolioUrl}
        placeholder="https://" hint="작업물을 볼 수 있는 웹사이트·블로그·인스타그램 주소. 심사에 큰 도움이 돼요." />
      <Field name="teachingExperience" label="가르쳐 본 경험 (선택)" defaultValue={v.teachingExperience} error={e.teachingExperience}
        hint="예: 원데이 클래스 50회, 사내 교육 강사 2년" />
      <TextareaField name="bio" label="어떤 클래스를 열고 싶나요?" rows={5} defaultValue={v.bio} error={e.bio}
        hint="수강생이 무엇을 배우고 어떤 결과물을 가져가는지 적어 주세요." />
      <Field name="expertise" label="전문 분야 (쉼표로 구분)" defaultValue={v.expertise} error={e.expertise} hint="예: 필름 사진, 노출, 현상" />
      <Field name="instagram" label="인스타그램 (선택)" defaultValue={v.instagram} error={e.instagram} placeholder="@아이디" />
      <Button type="submit" size="lg" disabled={pending}>{pending ? "보내는 중…" : "호스트 신청하기"}</Button>
    </form>
  );
}
