"use client";

import { useEffect, useRef } from "react";

import { TextareaField } from "@/components/forms/controls";
import { Field, FormMessage } from "@/components/forms/field";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { CREATOR_FIELDS } from "@/lib/creators/constants";

import { submitCreatorApplicationAction } from "./actions";

/** 크리에이터 지원: 필수 5개 + 연락처, 선택 2개. 제출하면 같은 자리에 접수 완료 화면 */
export function ApplyForm() {
  const [state, action, pending, version] = useFormAction(submitCreatorApplicationAction);
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};

  if (state.status === "success") return <ApplyDone />;

  return (
    <form key={version} action={action} className="flex flex-col gap-12" noValidate data-testid="creator-apply-form">
      <FormMessage message={state.message} tone="error" />

      <fieldset className="flex flex-col gap-8">
        <legend className="cap-kr mb-6 text-[13px] font-semibold text-brand">필수 질문 · 5개</legend>

        <Field name="name" label="1. 이름 또는 활동명" defaultValue={v.name} error={e.name} autoComplete="name" />

        <div className="flex flex-col gap-3" role="radiogroup" aria-labelledby="field-label" aria-describedby={e.field ? "field-error" : undefined}>
          <span id="field-label" className="text-sm font-medium">2. 주로 어떤 분야에 관심이 있거나 활동하고 있나요?</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {CREATOR_FIELDS.map((f) => (
              <label key={f.value} className="flex cursor-pointer items-center gap-3 border px-4 py-3 text-[15px] has-[:checked]:border-foreground has-[:checked]:bg-soft">
                <input type="radio" name="field" value={f.value} defaultChecked={v.field === f.value} className="size-4 accent-[var(--navy)]" />
                {f.label}
              </label>
            ))}
          </div>
          {e.field && <p id="field-error" role="alert" className="text-xs text-destructive">{e.field}</p>}
        </div>

        <TextareaField name="strength" label="3. 본인이 다른 사람보다 잘하거나 자신 있는 것은 무엇인가요?" rows={3}
          defaultValue={v.strength} error={e.strength} placeholder="작은 능력이나 경험도 괜찮습니다." />

        <TextareaField name="experience" label="4. 지금까지 관련해서 해본 활동이나 경험이 있나요?" rows={3}
          defaultValue={v.experience} error={e.experience} placeholder="직업, 취미, 프로젝트, 개인적인 경험 모두 좋습니다." />

        <TextareaField name="motivation" label={`5. ${brand.name}와 함께해 보고 싶은 이유는 무엇인가요?`} rows={3}
          defaultValue={v.motivation} error={e.motivation} placeholder="나의 경험을 나누고 싶다, 새로운 활동을 해보고 싶다 등 자유롭게 작성해 주세요." />

        <Field name="phone" label="연락받을 휴대폰 번호" type="tel" inputMode="tel" autoComplete="tel" defaultValue={v.phone} error={e.phone}
          placeholder="010-1234-5678" hint="전화 인터뷰 연락용이에요. 운영팀만 볼 수 있고 공개되지 않아요." />
      </fieldset>

      <fieldset className="flex flex-col gap-8">
        <legend className="cap-kr mb-6 text-[13px] font-semibold text-muted-foreground">선택 질문 · 비워 두셔도 돼요</legend>

        <Field name="link" label="6. 운영 중인 SNS 또는 포트폴리오가 있나요?" defaultValue={v.link} error={e.link} placeholder="https://" inputMode="url" />

        <TextareaField name="wish" label="7. 사람들과 함께 해보고 싶은 활동이 있나요?" rows={3} defaultValue={v.wish} error={e.wish}
          placeholder="아직 생각해 본 적 없다면 비워두셔도 됩니다." />
      </fieldset>

      {/* 자동 입력 방지: 사람 눈에는 보이지 않는 칸 (비어 있어야 정상) */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>웹사이트<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div className="flex flex-col gap-6">
        <label className="flex items-start gap-3 text-sm" data-testid="consent">
          <input type="checkbox" name="consent" defaultChecked={v.consent === "on"} className="mt-0.5 size-4" />
          <span>
            지원 내용 확인과 전화 인터뷰 연락을 위해 입력한 이름·연락처·답변을 수집·이용하는 데 동의합니다. 운영 기록으로 보관되며 요청하시면 삭제해 드려요. 운영팀이 기획을 검토할 때 지원 내용을 AI 도구로 분석할 수 있어요.
            {e.consent && <span className="mt-1 block text-destructive">{e.consent}</span>}
          </span>
        </label>
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto sm:self-start">
          {pending ? "접수 중…" : "지원하기"}
        </Button>
      </div>
    </form>
  );
}

/** 접수 완료 화면: 긴 폼을 내려서 제출해도 완료 문구가 잘리지 않게 위로 올려 보여 줌 */
function ApplyDone() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "start" });
  }, []);
  return (
    <section ref={ref} className="scroll-mt-24 border-t border-foreground pt-8" data-testid="apply-done" role="status">
      <p className="cap-kr text-[13px] font-semibold text-brand">— 접수 완료</p>
      <h2 className="font-display mt-3 text-[28px] leading-[1.3] font-light break-keep sm:text-[34px]">지원이 접수되었습니다.</h2>
      <p className="mt-5 leading-relaxed text-muted-foreground">
        {brand.name} 운영팀이 지원 내용을 확인한 후 연락드리겠습니다.
        <br />
        <br />
        짧은 대화를 통해 당신만의 가능성을 함께 발견해 보겠습니다.
      </p>
    </section>
  );
}
