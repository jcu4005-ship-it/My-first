import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "인증 링크 오류" };

export default function AuthErrorPage() {
  return (
    <section>
      <h1 className="font-display text-3xl font-bold">링크를 확인할 수 없습니다</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        링크가 만료되었거나 이미 사용되었을 수 있습니다. 다시 요청해 주세요.
      </p>
      <div className="mt-8 flex gap-4 text-sm">
        <Link href="/login" className="underline underline-offset-4">로그인</Link>
        <Link href="/forgot-password" className="underline underline-offset-4">비밀번호 재설정</Link>
      </div>
    </section>
  );
}
