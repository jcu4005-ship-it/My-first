"use client";

import { SelectField, TextareaField } from "@/components/forms/controls";
import { Field, FormMessage } from "@/components/forms/field";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { MEETUP_COVER_BUCKET } from "@/lib/meetups/cover";
import { CLASS_LEVELS, MEETUP_TYPES } from "@/lib/validation/meetup";

import { saveMeetupAction } from "../actions";

export type MeetupFormDefaults = Record<string, string>;

export function MeetupForm({
  meetupId,
  categories,
  defaults,
  userId,
}: {
  /** 사진 저장 폴더 (본인 id) */
  userId: string;
  meetupId?: string;
  categories: { slug: string; name: string }[];
  defaults?: MeetupFormDefaults;
}) {
  const [state, action, pending, version] = useFormAction(saveMeetupAction);
  const e = state.fieldErrors ?? {};
  const v = state.values ?? defaults ?? {};
  return (
    <form
      key={version}
      action={action}
      className="flex flex-col gap-6"
      noValidate
      data-testid="meetup-form"
    >
      {meetupId && <input type="hidden" name="meetupId" value={meetupId} />}
      <FormMessage message={state.message} />

      <section
        className="flex flex-col gap-5 rounded-2xl bg-card/70 p-4 sm:p-6"
        aria-labelledby="step-1"
      >
        <header>
          <p className="text-[11px] font-bold tracking-[0.22em] text-sage">
            STEP 1
          </p>
          <h2 id="step-1" className="mt-0.5 font-display text-lg font-bold">
            기본 정보
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            목록과 메인에 보이는 모습이에요.
          </p>
        </header>
        <Field
          name="title"
          label="프로그램 제목"
          defaultValue={v.title}
          error={e.title}
          hint="5~60자. 무엇을 배우는 프로그램인지 한눈에 보이게"
        />
        <ImageUploadField
          bucket={MEETUP_COVER_BUCKET}
          userId={userId}
          initialPath={v.coverPath || null}
          name="coverPath"
          label="대표 사진 (선택)"
          filePrefix="meetup"
          testIdPrefix="meetup-cover"
          aspect="aspect-[4/3] w-48"
          hint="메인 첫 화면과 목록에 크게 보여요. 직접 찍었거나 사용 허락을 받은 사진만 올려 주세요. 촬영 위치·기기 정보는 지우고 저장해요."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            name="categorySlug"
            label="카테고리"
            defaultValue={v.categorySlug ?? categories[0]?.slug}
            options={categories.map((c) => ({ value: c.slug, label: c.name }))}
            error={e.categorySlug}
          />
          <SelectField
            name="meetupType"
            label="수업 방식"
            defaultValue={v.meetupType ?? "class"}
            options={MEETUP_TYPES.map((t) => ({
              value: t.value,
              label: t.label,
            }))}
            error={e.meetupType}
          />
          <SelectField
            name="level"
            label="난이도"
            defaultValue={v.level ?? "beginner"}
            options={CLASS_LEVELS.map((l) => ({
              value: l.value,
              label: l.label,
            }))}
            error={e.level}
          />
        </div>
        <Field
          name="summary"
          label="한 줄 요약"
          defaultValue={v.summary}
          error={e.summary}
          hint="목록 카드에 보이는 문장 (10~120자)"
        />
      </section>
      <section
        className="flex flex-col gap-5 rounded-2xl bg-card/70 p-4 sm:p-6"
        aria-labelledby="step-2"
      >
        <header>
          <p className="text-[11px] font-bold tracking-[0.22em] text-sage">
            STEP 2
          </p>
          <h2 id="step-2" className="mt-0.5 font-display text-lg font-bold">
            이 프로그램의 이야기
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            참가자가 신청을 결정하는 부분이에요.
          </p>
        </header>
        <TextareaField
          name="description"
          label="프로그램 이야기"
          rows={8}
          defaultValue={v.description}
          error={e.description}
          hint="왜 이 프로그램을 만들었는지, 참가자가 무엇을 경험하는지 내 말로 적어 주세요. 상세 화면에 가장 크게 보여요."
        />
        <TextareaField
          name="learningOutcomes"
          label="참가자가 얻는 것"
          rows={3}
          defaultValue={v.learningOutcomes}
          error={e.learningOutcomes}
          placeholder={
            "예: 3분 자기소개를 내 말투로 완성해요.\n예: 내가 찍은 사진 한 장을 인화해 가져가요."
          }
          hint="한 줄에 하나씩. 수강생이 신청 전에 가장 먼저 확인하는 내용이에요."
        />
        <TextareaField
          name="targetAudience"
          label="이런 분께 추천해요"
          rows={2}
          placeholder="예: 발표가 부담스러운 직장인, 처음 배우는 분"
          defaultValue={v.targetAudience}
          error={e.targetAudience}
        />
      </section>
      <section
        className="flex flex-col gap-5 rounded-2xl bg-card/70 p-4 sm:p-6"
        aria-labelledby="step-3"
      >
        <header>
          <p className="text-[11px] font-bold tracking-[0.22em] text-sage">
            STEP 3
          </p>
          <h2 id="step-3" className="mt-0.5 font-display text-lg font-bold">
            진행 방법
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            당일 흐름과 준비할 것을 알려 주세요.
          </p>
        </header>
        <TextareaField
          name="agenda"
          label="진행 순서 (한 줄에 하나)"
          rows={4}
          defaultValue={v.agenda}
          error={e.agenda}
          placeholder={"14:00 인사와 자기소개\n14:20 주제 대화"}
          hint="‘시간 내용’ 형식으로 적으면 시간표로 보여요."
        />
        <Field
          name="materialsNote"
          label="재료·도구 제공 안내 (선택)"
          defaultValue={v.materialsNote}
          error={e.materialsNote}
          hint="예: 재료비 포함, 완성품 지참 / 노트북 필요"
        />
        <TextareaField
          name="whatToBring"
          label="준비물"
          rows={2}
          defaultValue={v.whatToBring}
          error={e.whatToBring}
        />
        <TextareaField
          name="requirements"
          label="참여 조건"
          rows={2}
          defaultValue={v.requirements}
          error={e.requirements}
        />
      </section>
      <section
        className="flex flex-col gap-5 rounded-2xl bg-card/70 p-4 sm:p-6"
        aria-labelledby="step-4"
      >
        <header>
          <p className="text-[11px] font-bold tracking-[0.22em] text-sage">
            STEP 4
          </p>
          <h2 id="step-4" className="mt-0.5 font-display text-lg font-bold">
            가격과 안내
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            참가비와 취소 규정이에요.
          </p>
        </header>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            name="price"
            label="참가비 (원)"
            inputMode="numeric"
            defaultValue={v.price ?? "0"}
            error={e.price}
            hint="0이면 무료. 공개 후 올리면 다시 검수를 받아요"
          />
          <SelectField
            name="maxQuantity"
            label="1회 신청 가능 인원"
            defaultValue={v.maxQuantity ?? "1"}
            options={[1, 2, 3, 4].map((n) => ({
              value: String(n),
              label: `최대 ${n}명`,
            }))}
            error={e.maxQuantity}
          />
        </div>
        <TextareaField
          name="priceRationale"
          label="가격 근거 (유료 프로그램은 필수)"
          rows={2}
          defaultValue={v.priceRationale}
          error={e.priceRationale}
          placeholder="예: 3시간 실습, 재료비 1만 원 포함, 6명 정원, 완성작 1점"
          hint="운영팀이 검수할 때 참가비와 함께 봐요. 참가자에게는 보이지 않아요. 검수 요청 전에 10자 이상 적어 주세요."
        />
        <TextareaField
          name="refundPolicyText"
          label="취소·환불 추가 안내 (선택)"
          rows={2}
          defaultValue={v.refundPolicyText}
          error={e.refundPolicyText}
          hint="환불 비율은 플랫폼 공통 기준(3일 전 100% · 2~1일 전 50% · 당일 환불 없음)으로 정해져요. 재료 준비 등 참가자가 알아야 할 내용만 적어 주세요."
        />
      </section>
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending
          ? "저장 중…"
          : meetupId
            ? "변경 내용 저장"
            : "저장하고 일정 추가하기"}
      </Button>
    </form>
  );
}
