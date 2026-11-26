import type { Metadata } from "next";
import Link from "next/link";

import { LogoWordmarkChair } from "@/components/brand/logo";
import { ComingSoonFooter, ComingSoonHeader } from "@/components/coming-soon/parts";
import { Button } from "@/components/ui/button";
import { BUSINESS_INFO } from "@/config/business";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "곧 문을 엽니다",
  description: "한 사람의 세계를 만나는 자리. 지금은 첫 크리에이터를 만나고 있어요.",
  robots: { index: false, follow: false }, // 정식 오픈 전에는 검색에 올리지 않음
};

const DOES = [
  { name: "발견", body: "몇 가지 질문으로 한 사람의 강점과 이야기를 찾아요." },
  { name: "기획", body: "찾은 이야기를 4~10명이 둘러앉는 프로그램으로 함께 기획해요." },
  { name: "연결", body: "신청, 결제, 환불은 정식 오픈 후 라운디 안에서 이뤄져요." },
];

/**
 * 임시 공개 페이지. 운영 DB가 없어도 열리도록 DB를 읽지 않는다. (임시 공개 모드에서는 "/" 요청이 이 화면으로 연결됨)
 * 크리에이터 지원 버튼은 지원 접수가 열려 있을 때(DB 연결)만 보이고, 아니면 문의 이메일을 안내한다.
 */
export default function ComingSoonPage() {
  const applyOpen = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const email = BUSINESS_INFO.csEmail;
  return (
    <>
      <ComingSoonHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-10 sm:px-6" data-testid="coming-soon">
        <div className="flex items-baseline justify-between text-[12px] text-muted-foreground">
          <span className="cap">Issue 01 — Opening soon</span>
          <span className="cap">Seoul</span>
        </div>
        <LogoWordmarkChair className="mt-4 w-full text-brand" testId="wordmark-chair" />
        <hr className="mt-4 border-foreground" />

        <section className="mt-14 max-w-3xl">
          <h1 className="font-display text-[34px] leading-[1.25] font-light break-keep sm:text-[52px]">
            한 사람의 <span className="font-normal text-brand">세계를</span>
            <br />
            만나는 자리, <span className="it-serif text-brand">곧 문을 엽니다.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
            {brand.name}는 자기만의 이야기를 가진 사람과 4~10명이 둘러앉는 오프라인 프로그램을 만들어요. 지금은 처음 함께할 크리에이터를 만나고 있어요.
          </p>
          <p className="mt-4 bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="coming-soon-notice">
            프로그램 신청과 결제는 아직 열리지 않았어요. 정식 오픈 후에 시작돼요.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3" data-testid="coming-soon-cta">
            {applyOpen ? (
              <Button asChild size="lg">
                <Link href="/apply">크리에이터 지원하기</Link>
              </Button>
            ) : email ? (
              <Button asChild size="lg">
                <a href={`mailto:${email}`}>크리에이터 문의하기</a>
              </Button>
            ) : null}
            <Link href="/terms" className="text-[15px] font-semibold underline underline-offset-4">이용약관 보기</Link>
          </div>
          {!applyOpen && email && <p className="mt-3 text-sm text-muted-foreground">크리에이터 지원은 이메일로 문의해 주세요. {email}</p>}
        </section>

        <section className="mt-20" aria-labelledby="does-title">
          <p className="cap-kr text-[13px] font-semibold text-brand">— {brand.name}가 하는 일</p>
          <h2 id="does-title" className="sr-only">{brand.name}가 하는 일</h2>
          <ul className="mt-4 grid gap-6 border-t border-foreground pt-6 md:grid-cols-3 md:gap-8" data-testid="coming-soon-does">
            {DOES.map((d) => (
              <li key={d.name}>
                <b className="font-display text-[22px] font-medium">{d.name}</b>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{d.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <ComingSoonFooter />
    </>
  );
}
