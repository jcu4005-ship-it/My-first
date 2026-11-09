import { IMAGE_MAX_BYTES, IMAGE_TYPES, publicImageUrl } from "@/lib/storage/images";

/** 호스트 사진 저장소 (Supabase Storage, 공개 버킷) */
export const HOST_AVATAR_BUCKET = "host-avatars";
export const HOST_AVATAR_MAX_BYTES = IMAGE_MAX_BYTES;
export const HOST_AVATAR_TYPES = IMAGE_TYPES;

/** 저장 위치(사용자id/파일명) → 공개 주소. 사진이 없으면 null */
export function hostAvatarUrl(path: string | null | undefined): string | null {
  return publicImageUrl(HOST_AVATAR_BUCKET, path);
}

/** 호스트 공개 주소 (slug가 없으면 id) */
export function hostHref(h: { slug?: string | null; user_id: string }) {
  return `/hosts/${h.slug ?? h.user_id}`;
}
