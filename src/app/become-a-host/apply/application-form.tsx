"use client";

import { TextareaField } from "@/components/forms/controls";
import { Field, FormMessage } from "@/components/forms/field";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";

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
        <Field name="displayName" label="활동 이름" defaultValue={v.displayName} error={e.displayName} hint="프로그램과 호스트 페이지에 보이는 이름이에요." />
        <Field name="contactPhone" label="휴대폰 번호" type="tel" inputMode="tel" defaultValue={v.contactPhone} error={e.contactPhone}
          placeholder="010-1234-5678" hint="심사 연락용이에요. 운영팀과 본인만 볼 수 있고 공개되지 않아요." />
        <Field name="instagram" label="인스타그램 (선택)" defaultValue={v.instagram} error={e.instagram} placeholder="@아이디" />
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="eyebrow mb-2 text-muted-foreground">02 · 나는 어떤 사람인가요</legend>
        <TextareaField name="passion" label="시간 가는 줄 모르고 하는 일은 무엇인가요?" rows={3} defaultValue={v.passion} error={e.passion}
          hint="2~3줄이면 충분해요. 예: 퇴근 후 동네 골목을 걸으며 오래된 가게를 사진으로 남겨요." />
        <TextareaField name="oftenAsked" label="주변 사람들이 나에게 자주 묻거나 부탁하는 것은 무엇인가요?" rows={3} defaultValue={v.oftenAsked} error={e.oftenAsked}
          hint="예: 친구들이 발표 전에 꼭 연습 상대가 되어 달라고 해요." />
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="eyebrow mb-2 text-muted-foreground">03 · 만들고 싶은 모임</legend>
        <TextareaField name="programProposal" label="만들고 싶은 모임을 편하게 적어 주세요" rows={4} defaultValue={v.programProposal} error={e.programProposal}
          hint="아직 막연해도 괜찮아요. 어떤 사람들과, 어떤 분위기로 만나고 싶은지 적어 주세요. 운영팀이 함께 다듬어요." />
      </fieldset>

      <details className="border p-4" open={Boolean(v.career || v.portfolioUrl)}>
        <summary className="cursor-pointer text-sm font-medium">더 알려 주고 싶다면 (선택)</summary>
        <div className="mt-4 flex flex-col gap-5">
          <TextareaField name="career" label="경력·자격 (선택)" rows={3} defaultValue={v.career} error={e.career} />
          <Field name="portfolioUrl" label="포트폴리오·활동 링크 (선택)" defaultValue={v.portfolioUrl} error={e.portfolioUrl} placeholder="https://" />
        </div>
      </details>

      {/* 예전 지원서에 적어 둔 내용은 이 화면에 없어도 지워지지 않게 그대로 보냄 */}
      {(["pillar", "fields", "headline", "bio", "credentials", "teachingExperience", "valueToParticipants", "preferredFormat"] as const).map((k) => (
        <input key={k} type="hidden" name={k} defaultValue={v[k] ?? ""} />
      ))}

      <label className="flex items-start gap-3 text-sm" data-testid="consent">
        <input type="checkbox" name="consent" defaultChecked={v.consent === "on"} className="mt-0.5 size-4" />
        <span>
          심사를 위해 제출한 개인정보(이름·휴대폰 번호)와 자료를 이용하는 데 동의합니다. 운영팀이 프로그램 기획을 검토할 때 제출 내용을 AI 도구로 분석할 수 있어요. 심사가 끝난 뒤에도 운영 기록으로 보관되며, 회원 탈퇴 시 삭제됩니다.
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
