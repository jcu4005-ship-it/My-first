/** 호스트 사진 저장소 (Supabase Storage, 공개 버킷) */
export const HOST_AVATAR_BUCKET = "host-avatars";
export const HOST_AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const HOST_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** 저장 위치(사용자id/파일명) → 공개 주소. 사진이 없으면 null */
export function hostAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${HOST_AVATAR_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** 호스트 공개 주소 (slug가 없으면 id) */
export function hostHref(h: { slug?: string | null; user_id: string }) {
  return `/hosts/${h.slug ?? h.user_id}`;
}
