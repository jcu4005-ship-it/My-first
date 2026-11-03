import type { Metadata } from "next";
import Link from "next/link";

import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "회원가입" };

export default function SignUpPage() {
  return (
    <section>
      <h1 className="font-display text-3xl font-bold">회원가입</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="underline underline-offset-4">
          로그인
        </Link>
      </p>
      <div className="mt-8">
        <SignUpForm />
      </div>
    </section>
  );
}
