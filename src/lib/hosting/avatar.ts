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

/**
 * 첫 크리에이터 출시용 사진 (대표가 본인 사진을 받아 전달, 2026-11-17).
 * 크리에이터가 직접 프로필 사진을 올리면 그 사진이 항상 우선입니다. 올리면 이 목록에서 지워도 됩니다.
 */
const LAUNCH_PHOTOS: Record<string, string> = {
  "hong-jiwan": "/images/creators/hong-jiwan.jpg",
  "yang-seunghyo": "/images/creators/yang-seunghyo.jpg",
  "joo-chanwook": "/images/creators/joo-chanwook.jpg",
};

/** 크리에이터 사진: 직접 올린 사진 → 출시용 사진 → 없음 */
export function creatorPhoto(h: { avatar_path?: string | null; slug?: string | null }): string | null {
  return hostAvatarUrl(h.avatar_path) ?? (h.slug ? (LAUNCH_PHOTOS[h.slug] ?? null) : null);
}
