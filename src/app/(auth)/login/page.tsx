import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage() {
  return (
    <section>
      <h1 className="font-display text-3xl font-bold">로그인</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        처음이신가요?{" "}
        <Link href="/signup" className="underline underline-offset-4">
          회원가입
        </Link>
      </p>
      <div className="mt-8">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
      <p className="mt-6 text-sm">
        <Link href="/forgot-password" className="text-muted-foreground underline underline-offset-4">
          비밀번호를 잊으셨나요?
        </Link>
      </p>
    </section>
  );
}
