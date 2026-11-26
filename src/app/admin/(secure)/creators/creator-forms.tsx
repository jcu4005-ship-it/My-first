"use client";

import { useActionState, useEffect, useRef } from "react";

import { FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { CREATOR_NOTE_KINDS, CREATOR_STATUSES } from "@/lib/creators/constants";
import { initialFormState, type FormState } from "@/lib/forms";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

const selectClass = "h-10 border border-border bg-white px-3 text-sm";

/** 지원 상태 바꾸기 */
export function StatusForm({ action, id, current }: { action: Action; id: string; current: string }) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-2" data-testid="creator-status-form">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-center gap-2">
        <select name="status" defaultValue={current} aria-label="지원 상태" className={selectClass}>
          {CREATOR_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? "저장 중…" : "상태 저장"}</Button>
      </div>
      <FormMessage message={state.message} tone={state.status === "success" ? "success" : "error"} />
    </form>
  );
}

/** 전화 인터뷰 메모·녹취록 쓰기 */
export function NoteForm({ action, id }: { action: Action; id: string }) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-3" data-testid="creator-note-form">
      <input type="hidden" name="id" value={id} />
      <select name="kind" defaultValue="interview_memo" aria-label="메모 종류" className={`${selectClass} self-start`}>
        {CREATOR_NOTE_KINDS.map((k) => (
          <option key={k.value} value={k.value}>{k.label}</option>
        ))}
      </select>
      <Textarea name="body" rows={5} aria-label="인터뷰 메모 내용" placeholder="전화 인터뷰에서 들은 이야기, 강점으로 보이는 점, 다음에 물어볼 것 등을 적어 주세요." />
      <Button type="submit" size="sm" disabled={pending} className="self-start">{pending ? "저장 중…" : "메모 저장"}</Button>
      <FormMessage message={state.message} tone={state.status === "success" ? "success" : "error"} />
    </form>
  );
}
