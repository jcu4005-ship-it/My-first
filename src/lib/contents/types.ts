import { publicImageUrl } from "@/lib/storage/images";

/** 콘텐츠(저널) 공통 정의 — 화면·서버 어디서나 사용 */
export const CONTENT_COVER_BUCKET = "content-covers";

export const CONTENT_TYPES = [
  { slug: "article", label: "Article", ko: "아티클" },
  { slug: "interview", label: "Interview", ko: "인터뷰" },
  { slug: "portfolio", label: "Portfolio", ko: "포트폴리오" },
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number]["slug"];
export type ContentStatus = "draft" | "submitted" | "published" | "rejected" | "archived";

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  draft: "작성 중",
  submitted: "검토 대기",
  published: "공개",
  rejected: "보완 요청",
  archived: "비공개",
};

export const CONTENT_STATUS_TONE: Record<ContentStatus, "muted" | "accent" | "ok" | "warn"> = {
  draft: "muted",
  submitted: "warn",
  published: "ok",
  rejected: "accent",
  archived: "muted",
};

export function isContentType(v: unknown): v is ContentType {
  return CONTENT_TYPES.some((t) => t.slug === v);
}

export function contentTypeInfo(v: string | null | undefined) {
  return CONTENT_TYPES.find((t) => t.slug === v) ?? null;
}

export function contentCoverUrl(path: string | null | undefined) {
  return publicImageUrl(CONTENT_COVER_BUCKET, path);
}
