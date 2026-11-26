import type { Metadata } from "next";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "새 비밀번호 설정" };

/** 재설정 메일의 링크로 들어온 사용자만 접근 (비로그인은 proxy·서버 처리에서 차단) */
export default function ResetPasswordPage() {
  return (
    <section>
      <h1 className="font-display text-3xl font-bold">새 비밀번호 설정</h1>
      <div className="mt-8">
        <ResetPasswordForm />
      </div>
    </section>
  );
}
