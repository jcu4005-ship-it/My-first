import type { Metadata } from "next";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "비밀번호 재설정" };

export default function ForgotPasswordPage() {
  return (
    <section>
      <h1 className="font-display text-3xl font-bold">비밀번호 재설정</h1>
      <p className="mt-2 text-sm text-muted-foreground">가입한 이메일로 재설정 링크를 보내 드립니다.</p>
      <div className="mt-8">
        <ForgotPasswordForm />
      </div>
    </section>
  );
}
