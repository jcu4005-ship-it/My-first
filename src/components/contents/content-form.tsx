"use client";

import { useActionState } from "react";

import { SelectField, TextareaField } from "@/components/forms/controls";
import { Field, FormMessage } from "@/components/forms/field";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { deleteContentAction, saveContentAction } from "@/lib/contents/actions";
import { CONTENT_COVER_BUCKET, CONTENT_TYPES, type ContentStatus } from "@/lib/contents/types";
import { initialFormState } from "@/lib/forms";

/**
 * 콘텐츠 작성 폼 (호스트·관리자 공용). 본문은 일반 텍스트 — 줄바꿈만 그대로 보여 줍니다.
 * - 호스트: 임시 저장 / 검토 요청
 * - 관리자(본인 글): 저장 / 공개하기, 연결할 호스트 선택 가능
 */
export function ContentForm({
  scope,
  userId,
  contentId,
  status,
  defaults,
  meetups,
  hosts,
}: {
  scope: "host" | "admin";
  userId: string;
  contentId?: string;
  status?: ContentStatus;
  defaults: Record<string, string>;
  meetups: { id: string; title: string }[];
  hosts?: { user_id: string; display_name: string }[];
}) {
  const [state, action, pending, version] = useFormAction(saveContentAction);
  const e = state.fieldErrors ?? {};
  const v = state.values ?? defaults;
  const locked = status === "submitted";
  return (
    <form key={version} action={action} className="flex flex-col gap-6" noValidate data-testid="content-form">
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="contentId" value={contentId ?? v.contentId ?? ""} />
      <FormMessage message={state.message} tone={state.status === "success" ? "success" : "error"} />
      {locked && <p className="bg-notice px-4 py-3 text-sm text-notice-foreground">검토 중이라 지금은 고칠 수 없어요. 결과가 나오면 알림으로 알려 드려요.</p>}
      {status === "published" && scope === "host" && (
        <p className="bg-notice px-4 py-3 text-sm text-notice-foreground">공개된 글을 고쳐 저장하면 비공개로 바뀌고, 다시 검토를 받아야 공개돼요.</p>
      )}

      <fieldset disabled={locked || pending} className="flex flex-col gap-5">
        <SelectField name="type" label="종류" defaultValue={v.type || "article"} error={e.type}
          options={CONTENT_TYPES.map((t) => ({ value: t.slug, label: `${t.ko} · ${t.label}` }))} />
        <Field name="title" label="제목" defaultValue={v.title} error={e.title} hint="5~80자" />
        <TextareaField name="summary" label="요약" rows={2} defaultValue={v.summary} error={e.summary}
          hint="목록에 보이는 한두 문장 (10~200자)" />
        <TextareaField name="body" label="본문" rows={14} defaultValue={v.body} error={e.body}
          hint="일반 텍스트로 써 주세요. 빈 줄로 문단을 나눠요. 100자 이상." />
        <ImageUploadField
          bucket={CONTENT_COVER_BUCKET}
          userId={userId}
          initialPath={v.coverPath || null}
          name="coverPath"
          label="대표 사진 (선택)"
          filePrefix="cover"
          testIdPrefix="cover"
          aspect="aspect-[4/3] w-40"
          hint="jpg·png·webp, 5MB 이하. 직접 찍었거나 사용 허락을 받은 사진만 올려 주세요."
        />
        {hosts && (
          <SelectField name="hostId" label="연결할 호스트 (선택)" defaultValue={v.hostId ?? ""} error={e.hostId}
            options={[{ value: "", label: "없음 (운영팀 글)" }, ...hosts.map((h) => ({ value: h.user_id, label: h.display_name }))]} />
        )}
        <SelectField name="relatedMeetupId" label="관련 프로그램 (선택)" defaultValue={v.relatedMeetupId ?? ""} error={e.relatedMeetupId}
          options={[{ value: "", label: "없음" }, ...meetups.map((m) => ({ value: m.id, label: m.title }))]} />
      </fieldset>

      {!locked && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" name="intent" value="save" variant="outline" size="lg" disabled={pending}>
            {pending ? "처리 중…" : scope === "admin" ? "저장" : "임시 저장"}
          </Button>
          {scope === "host" ? (
            <Button type="submit" name="intent" value="submit" size="lg" disabled={pending}>
              {pending ? "처리 중…" : "검토 요청하기"}
            </Button>
          ) : (
            status !== "published" && (
              <Button type="submit" name="intent" value="publish" size="lg" disabled={pending}>
                {pending ? "처리 중…" : "공개하기"}
              </Button>
            )
          )}
        </div>
      )}
    </form>
  );
}

/** 작성 중·보완 요청·비공개 글 지우기 */
export function DeleteContentForm({ contentId, scope }: { contentId: string; scope: "host" | "admin" }) {
  const [state, action, pending] = useActionState(deleteContentAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-2" data-testid="delete-content">
      <input type="hidden" name="contentId" value={contentId} />
      <input type="hidden" name="scope" value={scope} />
      <FormMessage message={state.message} />
      <button type="submit" disabled={pending} className="self-start text-sm text-destructive underline underline-offset-4">
        {pending ? "지우는 중…" : "이 글 지우기"}
      </button>
    </form>
  );
}
