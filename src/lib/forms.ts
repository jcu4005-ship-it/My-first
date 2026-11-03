/** 서버 처리 결과 (화면 폼과 주고받는 형태) */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** 오류 시 다시 채워 줄 입력값 (비밀번호는 절대 담지 않음) */
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

export function formValue(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}
