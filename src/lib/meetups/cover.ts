import { publicImageUrl } from "@/lib/storage/images";

/** 프로그램 대표 사진 저장소 (호스트가 올림, 본인 폴더만) — 화면(브라우저)과 서버 공용 */
export const MEETUP_COVER_BUCKET = "meetup-covers";

export function meetupCoverUrl(path: string | null | undefined): string | null {
  return publicImageUrl(MEETUP_COVER_BUCKET, path);
}
