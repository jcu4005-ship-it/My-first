/** 서버 처리 결과 (화면 폼과 주고받는 형태) */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** 오류 시 다시 채워 줄 입력값 (비밀번호는 절대 담지 않음) */
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

// 눈에 보이지 않는 제어문자(널 문자 등 — DB가 저장을 거부해 "처리하지 못했습니다"만 뜨게 만듦)와
// 글자 방향을 뒤집는 문자(관리자 화면에서 글이 거꾸로 보이게 하는 속임수)를 제거. 줄바꿈·탭은 유지
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;

export function formValue(formData: FormData, key: string): string {
  const v = formData.get(key);
  if (typeof v !== "string") return "";
  return /password/i.test(key) ? v : v.replace(INVISIBLE, "");
}
