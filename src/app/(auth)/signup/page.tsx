import type { Metadata } from "next";
import Link from "next/link";

import { getAppSettings } from "@/lib/settings/queries";

import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "회원가입" };
// 초대제 여부를 매번 DB에서 읽음
export const instant = false;

export default async function SignUpPage() {
  const settings = await getAppSettings();
  return (
    <section>
      <h1 className="font-display text-3xl font-bold">회원가입</h1>
      {settings.invite_only && (
        <p className="mt-3 inline-flex rounded-full bg-forest px-3 py-1 text-xs font-semibold text-white" data-testid="beta-badge">
          비공개 베타 · 초대받은 분만 가입할 수 있어요
        </p>
      )}
      <p className="mt-2 text-sm text-muted-foreground">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="underline underline-offset-4">
          로그인
        </Link>
      </p>
      <div className="mt-8">
        <SignUpForm inviteOnly={settings.invite_only} />
      </div>
    </section>
  );
}
