/**
 * 약관·정책 문서 버전과 개정 정보 — 현재 문구는 임시이며 출시 전 법률 검토 후 교체합니다. (설계안 9-4)
 *
 * 구조: 문서마다 버전 · 개정일 · 시행일 · 개정 이력을 가집니다.
 *  - version 은 가입 동의 이력(legal_consents)에 함께 저장됩니다. 문구를 실질적으로 바꾸면 version 을 올리세요.
 *  - isDraft 가 true 인 동안은 화면에 "초안 · 법률 검토 전" 안내와 "법률 검토 필요" 표시가 나옵니다.
 *  - revisedAt(개정일)·effectiveAt(시행일)은 확정 전에는 null — 임의로 날짜를 적지 않습니다. 확정하면 YYYY-MM-DD 로 입력하세요.
 *  - 개정할 때는 현재 값을 history 맨 위로 옮기고 새 버전·날짜를 적습니다. (약관 변경은 시행일 7일 전 공지 — 불리한 변경은 30일 전, 법률 검토 확인)
 */
export type LegalDocumentMeta = {
  version: string;
  isDraft: boolean;
  /** 개정일 (YYYY-MM-DD). 확정 전에는 null */
  revisedAt: string | null;
  /** 시행일 (YYYY-MM-DD). 확정 전에는 null */
  effectiveAt: string | null;
  /** 이전 버전 기록 (최신이 맨 위) */
  history: { version: string; revisedAt: string; effectiveAt: string; summary: string }[];
};

export const LEGAL_DOCUMENTS = {
  terms: { version: "draft-2026-11-26", isDraft: true, revisedAt: null, effectiveAt: null, history: [] },
  privacy: { version: "draft-2026-11-26", isDraft: true, revisedAt: null, effectiveAt: null, history: [] },
  refund: { version: "draft-2026-11-26", isDraft: true, revisedAt: null, effectiveAt: null, history: [] },
  marketing: { version: "draft-2026-11-03", isDraft: true, revisedAt: null, effectiveAt: null, history: [] },
} as const satisfies Record<string, LegalDocumentMeta>;

export type LegalDocumentKey = keyof typeof LEGAL_DOCUMENTS;

/** 가입 가능 최소 연령 (만 나이) */
export const MINIMUM_SIGNUP_AGE = 14;

/** 약관 변경 공지 기간(일) — 일반 변경. 회원에게 불리한 변경의 기간은 법률 검토 후 확정 */
export const TERMS_CHANGE_NOTICE_DAYS = 7;
