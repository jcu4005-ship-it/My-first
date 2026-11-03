/**
 * 약관·개인정보 문서 버전 — 현재 문구는 임시이며 출시 전 법률 검토 후 교체합니다. (설계안 9-4)
 * 동의 이력(legal_consents)에 이 버전 문자열이 함께 저장됩니다.
 */
export const LEGAL_DOCUMENTS = {
  terms: { version: "draft-2026-11-03", isDraft: true },
  privacy: { version: "draft-2026-11-03", isDraft: true },
  marketing: { version: "draft-2026-11-03", isDraft: true },
} as const;

/** 가입 가능 최소 연령 (만 나이) */
export const MINIMUM_SIGNUP_AGE = 14;
