/**
 * 닉네임 규칙 — DB(supabase/migrations/*_members_and_roles.sql)의 규칙과 동일하게 유지합니다.
 * 최종 판단은 항상 DB가 하며, 여기서는 화면에 빠르게 안내하기 위한 사전 검사만 합니다.
 */
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 20;
export const NICKNAME_PATTERN = /^[가-힣A-Za-z0-9_.]+( [가-힣A-Za-z0-9_.]+)*$/;

const RESERVED = new Set([
  "admin", "administrator", "root", "system", "staff", "support", "official",
  "operator", "manager", "moderator", "host",
  "관리자", "운영자", "운영팀", "고객센터", "공식", "매니저", "호스트",
]);

/** 저장 형태: 유니코드 NFKC 정규화 + 앞뒤 공백 제거 + 연속 공백 1칸 */
export function cleanNickname(raw: string): string {
  return raw.normalize("NFKC").trim().replace(/\s+/g, " ");
}

/** 중복 검사 기준: 저장 형태를 소문자로, 공백 전부 제거 */
export function nicknameKey(raw: string): string {
  return cleanNickname(raw).replace(/\s+/g, "").toLowerCase();
}

export type NicknameProblem = "length" | "charset" | "reserved";

export function nicknameProblem(raw: string): NicknameProblem | null {
  const cleaned = cleanNickname(raw);
  const key = nicknameKey(raw);
  if (cleaned.length < NICKNAME_MIN || cleaned.length > NICKNAME_MAX || key.length < NICKNAME_MIN) {
    return "length";
  }
  if (!NICKNAME_PATTERN.test(cleaned)) return "charset";
  if (RESERVED.has(key)) return "reserved";
  return null;
}

export const NICKNAME_MESSAGES: Record<NicknameProblem, string> = {
  length: `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 입력해 주세요.`,
  charset: "닉네임은 한글, 영문, 숫자, 밑줄(_), 마침표(.)와 단어 사이 공백만 사용할 수 있습니다.",
  reserved: "사용할 수 없는 닉네임입니다.",
};
