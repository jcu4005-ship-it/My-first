"use client";

import { useState } from "react";

import { HOST_AVATAR_BUCKET, HOST_AVATAR_MAX_BYTES, HOST_AVATAR_TYPES, hostAvatarUrl } from "@/lib/hosting/avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * 프로필 사진: 고르면 바로 본인 폴더(사용자id/)에 올리고, 저장 버튼을 눌러야 프로필에 반영됩니다.
 * 저장소 규칙(DB 정책)이 다른 사람 폴더에는 올릴 수 없게 막습니다.
 */
export function AvatarField({ userId, initialPath }: { userId: string; initialPath: string | null }) {
  const [path, setPath] = useState(initialPath ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = hostAvatarUrl(path);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!(HOST_AVATAR_TYPES as readonly string[]).includes(file.type)) return setError("jpg, png, webp 사진만 올릴 수 있어요.");
    if (file.size > HOST_AVATAR_MAX_BYTES) return setError("사진은 5MB 이하만 올릴 수 있어요.");
    setBusy(true);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const next = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await createSupabaseBrowserClient().storage
      .from(HOST_AVATAR_BUCKET)
      .upload(next, file, { contentType: file.type, upsert: false });
    setBusy(false);
    if (upErr) return setError("사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요.");
    setPath(next);
  }

  return (
    <div className="flex flex-col gap-3" data-testid="avatar-field">
      <span className="text-sm font-medium">프로필 사진</span>
      <div className="flex items-end gap-4">
        <div className="relative flex aspect-[4/5] w-28 items-center justify-center overflow-hidden bg-espresso text-xs text-sand">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- 방금 올린 사진 미리보기
            <img src={url} alt="프로필 사진 미리보기" className="absolute inset-0 size-full object-cover" data-testid="avatar-preview" />
          ) : (
            "사진 없음"
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center rounded-[2px] border border-current/40 px-4 text-sm hover:border-current">
            {busy ? "올리는 중…" : url ? "사진 바꾸기" : "사진 올리기"}
            <input type="file" accept={HOST_AVATAR_TYPES.join(",")} className="sr-only" onChange={onFile} disabled={busy} data-testid="avatar-input" />
          </label>
          {url && (
            <button type="button" className="self-start text-xs text-muted-foreground underline underline-offset-4" onClick={() => setPath("")}>
              사진 빼기
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">jpg·png·webp, 5MB 이하. 본인이 찍었거나 사용 허락을 받은 사진만 올려 주세요. 저장을 눌러야 반영돼요.</p>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <input type="hidden" name="avatarPath" value={path} />
    </div>
  );
}
