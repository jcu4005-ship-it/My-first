export const SUPPORT_CATEGORIES = [
  { value: "booking", label: "신청·결제" },
  { value: "refund", label: "취소·환불" },
  { value: "hosting", label: "호스트·프로그램 운영" },
  { value: "account", label: "계정·로그인" },
  { value: "safety", label: "신고·안전" },
  { value: "other", label: "기타" },
] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["value"];
export type SupportStatus = "open" | "answered" | "closed";

export const SUPPORT_CATEGORY_LABEL = Object.fromEntries(SUPPORT_CATEGORIES.map((c) => [c.value, c.label])) as Record<SupportCategory, string>;
export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = { open: "답변 대기", answered: "답변 완료", closed: "해결됨" };
export const SUPPORT_STATUS_TONE: Record<SupportStatus, "warn" | "ok" | "muted"> = { open: "warn", answered: "ok", closed: "muted" };

export function isSupportCategory(v: unknown): v is SupportCategory {
  return typeof v === "string" && SUPPORT_CATEGORIES.some((c) => c.value === v);
}
