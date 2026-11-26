import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { requireMember } from "@/lib/auth/guards";

import { WithdrawForm } from "./withdraw-form";

export const metadata: Metadata = { title: "회원 탈퇴" };
export const instant = false;

export default async function WithdrawPage() {
  await requireMember("/me/withdraw");
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <h1 className="font-display text-3xl font-bold">회원 탈퇴</h1>
        <section className="mt-6 flex flex-col gap-3 rounded-2xl border p-5 text-sm leading-relaxed">
          <p className="font-semibold">탈퇴하면 이렇게 처리돼요</p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>이메일·연락처·출생연도·소개 등 개인정보를 삭제하고, 닉네임은 &lsquo;탈퇴회원&rsquo;으로 바뀝니다.</li>
            <li>예정된 프로그램 신청은 모두 취소되고, 결제한 신청은 전액 환불됩니다. (현재는 테스트 결제)</li>
            <li>호스트라면 내 프로그램이 모두 비공개되고 호스트 프로필이 삭제됩니다. 참가자가 있는 일정은 먼저 취소해 주세요.</li>
            <li>로그인할 수 없게 되며, 같은 이메일로 다시 가입할 수 있어요.</li>
            <li>거래(신청·결제) 기록과 약관 동의 이력은 관련 법령에 따른 보관을 위해 개인을 알 수 없는 형태로 남습니다. 보관 기간은 출시 전 확정됩니다.</li>
          </ul>
        </section>
        <div className="mt-6">
          <WithdrawForm />
        </div>
      </main>
    </>
  );
}
