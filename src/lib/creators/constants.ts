/** 크리에이터 지원 접수에서 쓰는 분야·상태 이름 (DB 값 ↔ 화면 문구). 서버·클라이언트 모두에서 씀 */

export const CREATOR_FIELDS = [
  { value: "art_culture", label: "예술·문화·창작" },
  { value: "knowledge", label: "지식·교육·인문" },
  { value: "professional", label: "전문기술·직무·비즈니스" },
  { value: "lifestyle", label: "라이프스타일·자기계발" },
  { value: "other", label: "기타" },
] as const;
export type CreatorField = (typeof CREATOR_FIELDS)[number]["value"];

export const CREATOR_STATUSES = [
  { value: "new", label: "신규 지원" },
  { value: "reviewing", label: "검토 중" },
  { value: "interview_scheduled", label: "전화 인터뷰 예정" },
  { value: "interview_done", label: "인터뷰 완료" },
  { value: "collaborating", label: "협업 진행" },
  { value: "on_hold", label: "보류" },
  { value: "rejected", label: "거절" },
] as const;
export type CreatorApplicationStatus = (typeof CREATOR_STATUSES)[number]["value"];

export const creatorFieldLabel = (v: string) => CREATOR_FIELDS.find((f) => f.value === v)?.label ?? v;
export const creatorStatusLabel = (v: string) => CREATOR_STATUSES.find((s) => s.value === v)?.label ?? v;

export const CREATOR_NOTE_KINDS = [
  { value: "interview_memo", label: "인터뷰 메모" },
  { value: "transcript", label: "녹취록" },
  { value: "other", label: "기타" },
] as const;
