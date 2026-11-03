"use client";

import { useActionState } from "react";

import { SelectField, TextareaField } from "@/components/forms/controls";
import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/forms";
import { MEETUP_TYPES } from "@/lib/validation/meetup";

import { saveMeetupAction } from "../actions";

export type MeetupFormDefaults = Record<string, string>;

export function MeetupForm({
  meetupId,
  categories,
  defaults,
}: {
  meetupId?: string;
  categories: { slug: string; name: string }[];
  defaults?: MeetupFormDefaults;
}) {
  const [state, action, pending] = useActionState(saveMeetupAction, initialFormState);
  const e = state.fieldErrors ?? {};
  const v = state.values ?? defaults ?? {};
  return (
    <form action={action} className="flex flex-col gap-6" noValidate data-testid="meetup-form">
      {meetupId && <input type="hidden" name="meetupId" value={meetupId} />}
      <FormMessage message={state.message} />

      <Field name="title" label="모임 제목" defaultValue={v.title} error={e.title} hint="5~60자. 무엇을 하는 모임인지 한눈에 보이게" />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          name="categorySlug"
          label="카테고리"
          defaultValue={v.categorySlug ?? categories[0]?.slug}
          options={categories.filter((c) => c.slug !== "wine").map((c) => ({ value: c.slug, label: c.name }))}
          error={e.categorySlug}
        />
        <SelectField name="meetupType" label="모임 유형" defaultValue={v.meetupType ?? "general"}
          options={MEETUP_TYPES.map((t) => ({ value: t.value, label: t.label }))} error={e.meetupType} />
      </div>
      <Field name="summary" label="한 줄 요약" defaultValue={v.summary} error={e.summary} hint="목록 카드에 보이는 문장 (10~120자)" />
      <TextareaField name="description" label="모임 소개" rows={8} defaultValue={v.description} error={e.description}
        hint="어떤 시간을 보내게 되는지, 누구와 함께하는지 구체적으로 적어 주세요." />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="price" label="참가비 (원)" inputMode="numeric" defaultValue={v.price ?? "0"} error={e.price} hint="결제는 아직 연결되지 않았어요. 0이면 무료" />
        <SelectField name="maxQuantity" label="1회 신청 가능 인원" defaultValue={v.maxQuantity ?? "1"}
          options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `최대 ${n}명` }))} error={e.maxQuantity} />
      </div>
      <TextareaField name="agenda" label="진행 순서 (한 줄에 하나)" rows={4} defaultValue={v.agenda} error={e.agenda}
        placeholder={"14:00 인사와 자기소개\n14:20 주제 대화"} hint="‘시간 내용’ 형식으로 적으면 시간표로 보여요." />
      <TextareaField name="targetAudience" label="이런 분께 추천해요" rows={2} defaultValue={v.targetAudience} error={e.targetAudience} />
      <TextareaField name="whatToBring" label="준비물" rows={2} defaultValue={v.whatToBring} error={e.whatToBring} />
      <TextareaField name="requirements" label="참여 조건" rows={2} defaultValue={v.requirements} error={e.requirements} />
      <TextareaField name="refundPolicyText" label="취소·환불 안내" rows={2} defaultValue={v.refundPolicyText} error={e.refundPolicyText}
        hint="결제 연동 전까지는 안내 문구로만 표시돼요." />
      <p className="text-xs text-muted-foreground">주류가 포함된 모임은 운영 검토가 끝난 뒤 열 수 있어요.</p>
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "저장 중…" : meetupId ? "변경 내용 저장" : "저장하고 일정 추가하기"}
      </Button>
    </form>
  );
}
