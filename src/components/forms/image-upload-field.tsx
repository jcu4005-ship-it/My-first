"use client";

import { useState } from "react";

import { IMAGE_MAX_BYTES, IMAGE_TYPES, publicImageUrl } from "@/lib/storage/images";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const MAX_SIDE = 2000;

/**
 * 개인정보 보호: 휴대폰 사진에는 촬영 위치(GPS)·기기 정보(EXIF)가 숨어 있어요.
 * 사진을 화면에 다시 그려(재인코딩) 이런 정보를 모두 지운 뒤 올립니다. 너무 큰 사진은 줄여요.
 * 다시 그리기에 실패하면 원본을 올리지 않고 멈춥니다 (원본 유출 방지).
 */
async function stripMetadata(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const type = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
  if (!blob) throw new Error("encode");
  return blob;
}

/**
 * 사진 올리기: 고르면 바로 본인 폴더(사용자id/)에 올리고, 폼의 저장 버튼을 눌러야 반영됩니다.
 * 저장소 규칙(DB 정책)이 다른 사람 폴더에는 올릴 수 없게 막습니다.
 */
export function ImageUploadField({
  bucket,
  userId,
  initialPath,
  name,
  label,
  filePrefix,
  testIdPrefix,
  aspect = "aspect-[4/5] w-28",
  hint,
}: {
  bucket: string;
  userId: string;
  initialPath: string | null;
  name: string;
  label: string;
  filePrefix: string;
  testIdPrefix: string;
  aspect?: string;
  hint: string;
}) {
  const [path, setPath] = useState(initialPath ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = publicImageUrl(bucket, path);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return setError("jpg, png, webp 사진만 올릴 수 있어요.");
    if (file.size > IMAGE_MAX_BYTES) return setError("사진은 5MB 이하만 올릴 수 있어요.");
    setBusy(true);
    let clean: Blob;
    try {
      clean = await stripMetadata(file);
    } catch {
      setBusy(false);
      return setError("사진을 처리하지 못했어요. 다른 사진으로 시도해 주세요.");
    }
    const ext = clean.type === "image/png" ? "png" : clean.type === "image/webp" ? "webp" : "jpg";
    const next = `${userId}/${filePrefix}-${Date.now()}.${ext}`;
    const { error: upErr } = await createSupabaseBrowserClient().storage.from(bucket).upload(next, clean, { contentType: clean.type, upsert: false });
    setBusy(false);
    if (upErr) return setError("사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요.");
    setPath(next);
  }

  return (
    <div className="flex flex-col gap-3" data-testid={`${testIdPrefix}-field`}>
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-end gap-4">
        <div className={`relative flex items-center justify-center overflow-hidden bg-espresso text-xs text-sand ${aspect}`}>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- 방금 올린 사진 미리보기
            <img src={url} alt={`${label} 미리보기`} className="absolute inset-0 size-full object-cover" data-testid={`${testIdPrefix}-preview`} />
          ) : (
            "사진 없음"
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center rounded-[2px] border border-current/40 px-4 text-sm hover:border-current">
            {busy ? "올리는 중…" : url ? "사진 바꾸기" : "사진 올리기"}
            <input type="file" accept={IMAGE_TYPES.join(",")} className="sr-only" onChange={onFile} disabled={busy} data-testid={`${testIdPrefix}-input`} />
          </label>
          {url && (
            <button type="button" className="self-start text-xs text-muted-foreground underline underline-offset-4" onClick={() => setPath("")}>
              사진 빼기
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <input type="hidden" name={name} value={path} />
    </div>
  );
}
