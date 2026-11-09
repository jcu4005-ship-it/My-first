"use client";

import { SelectField, TextareaField } from "@/components/forms/controls";
import { Field, FormMessage } from "@/components/forms/field";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { PILLARS } from "@/config/pillars";

import { hostApplicationAction } from "./actions";

/** 호스트 지원서: 임시 저장 / 제출 (같은 폼, 버튼으로 구분) */
export function ApplicationForm({ defaults }: { defaults: Record<string, string> }) {
  const [state, action, pending, version] = useFormAction(hostApplicationAction);
  const e = state.fieldErrors ?? {};
  const v = state.values ?? defaults;
  return (
    <form key={version} action={action} className="flex flex-col gap-6" noValidate data-testid="host-application-form">
      <FormMessage message={state.message} tone={state.status === "success" ? "success" : "error"} />

      <fieldset className="flex flex-col gap-5">
        <legend className="eyebrow mb-2 text-muted-foreground">01 · 기본 정보</legend>
        <Field name="displayName" label="호스트 이름" defaultValue={v.displayName} error={e.displayName} hint="프로그램과 호스트 페이지에 보이는 이름이에요." />
        <Field name="contactPhone" label="휴대폰 번호" type="tel" inputMode="tel" defaultValue={v.contactPhone} error={e.contactPhone}
          placeholder="010-1234-5678" hint="심사 연락용이에요. 운영팀과 본인만 볼 수 있고 공개되지 않아요." />
        <SelectField name="pillar" label="지원 분류" defaultValue={v.pillar ?? ""} error={e.pillar}
          options={[{ value: "", label: "선택해 주세요" }, ...PILLARS.map((p) => ({ value: p.slug, label: `${p.label} · ${p.ko}` }))]} />
        <Field name="fields" label="활동 분야 (쉼표로 구분)" defaultValue={v.fields} error={e.fields} hint="예: 인물 사진, 자연광, 보정" />
        <Field name="headline" label="한 줄 소개" defaultValue={v.headline} error={e.headline} hint="예: 광고 사진가 출신, 스마트폰 인물 사진 코치" />
        <TextareaField name="bio" label="자기소개" rows={4} defaultValue={v.bio} error={e.bio} />
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="eyebrow mb-2 text-muted-foreground">02 · 전문성</legend>
        <TextareaField name="career" label="전문성과 경력" rows={4} defaultValue={v.career} error={e.career}
          hint="어디서 몇 년 동안 어떤 일을 했는지 구체적으로 적어 주세요. 심사의 가장 중요한 기준이에요." />
        <Field name="credentials" label="자격증·수상·학력 (선택)" defaultValue={v.credentials} error={e.credentials} />
        <Field name="teachingExperience" label="가르쳐 본 경험 (선택)" defaultValue={v.teachingExperience} error={e.teachingExperience} />
        <Field name="portfolioUrl" label="포트폴리오·활동 링크 (선택)" defaultValue={v.portfolioUrl} error={e.portfolioUrl} placeholder="https://" />
        <Field name="instagram" label="인스타그램 (선택)" defaultValue={v.instagram} error={e.instagram} placeholder="@아이디" />
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="eyebrow mb-2 text-muted-foreground">03 · 프로그램</legend>
        <TextareaField name="programProposal" label="프로그램 기획안" rows={6} defaultValue={v.programProposal} error={e.programProposal}
          hint="제목, 대상, 진행 순서, 시간, 희망 가격을 자유롭게 적어 주세요." />
        <TextareaField name="valueToParticipants" label="참가자에게 줄 가치" rows={3} defaultValue={v.valueToParticipants} error={e.valueToParticipants}
          hint="수업이 끝나면 참가자는 무엇을 할 수 있게 되나요?" />
        <TextareaField name="preferredFormat" label="희망 운영 방식 (선택)" rows={2} defaultValue={v.preferredFormat} error={e.preferredFormat}
          hint="예: 원데이 / 4주 시리즈, 희망 인원, 장소가 있는지" />
      </fieldset>

      <label className="flex items-start gap-3 text-sm" data-testid="consent">
        <input type="checkbox" name="consent" defaultChecked={v.consent === "on"} className="mt-0.5 size-4" />
        <span>
          심사를 위해 제출한 개인정보(이름·휴대폰 번호)와 자료를 이용하는 데 동의합니다. 심사가 끝난 뒤에도 운영 기록으로 보관되며, 회원 탈퇴 시 삭제됩니다.
          {e.consent && <span className="mt-1 block text-destructive">{e.consent}</span>}
        </span>
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" name="intent" value="save" variant="outline" size="lg" disabled={pending}>
          {pending ? "처리 중…" : "임시 저장"}
        </Button>
        <Button type="submit" name="intent" value="submit" size="lg" disabled={pending}>
          {pending ? "처리 중…" : "지원서 제출하기"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">제출하면 심사가 끝날 때까지 고칠 수 없어요. 운영팀이 수정을 요청하면 다시 고칠 수 있어요.</p>
    </form>
  );
}
