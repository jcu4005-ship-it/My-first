import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MessageCircle, Ticket } from "lucide-react";

import { PageHero, Section, SectionTitle } from "@/components/layout/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "고객센터", description: "자주 묻는 질문과 1:1 문의" };

/*
 * 자주 묻는 질문 — 지금 실제로 동작하는 내용만 적는다. 정해지지 않은 것(답변 시간 약속, 정식 결제 환불 기준)은 약속하지 않는다.
 */
const FAQ: { group: string; items: { q: string; a: React.ReactNode }[] }[] = [
  {
    group: "신청·결제",
    items: [
      { q: "신청하면 바로 확정되나요?", a: "무료 프로그램은 신청하는 순간 확정돼요. 유료 프로그램은 결제가 끝나면 확정돼요. 지금은 실제 청구가 없는 테스트 결제만 운영하고 있어요." },
      { q: "상세 주소는 언제 알 수 있나요?", a: <>참가가 확정되면 <Link href="/me/bookings" className="underline underline-offset-4">내 초대장</Link>에서 바로 볼 수 있어요. 확정 전에는 동네까지만 보여요.</> },
      { q: "할인 쿠폰은 어디에 쓰나요?", a: "호스트가 쿠폰 사용에 동의한 유료 프로그램의 신청 화면에서 쓸 수 있어요. 할인은 최대 10%예요." },
    ],
  },
  {
    group: "취소·환불",
    items: [
      { q: "신청을 취소하고 싶어요.", a: <>일정이 시작되기 전이라면 <Link href="/me/bookings" className="underline underline-offset-4">내 초대장</Link>에서 직접 취소할 수 있어요. 프로그램마다 적힌 &lsquo;취소 및 환불&rsquo; 안내도 함께 확인해 주세요.</> },
      { q: "호스트가 일정을 취소하면요?", a: "호스트 사정으로 취소되면 결제 금액은 전액 환불되고, 알림으로 알려 드려요." },
    ],
  },
  {
    group: "계정",
    items: [
      { q: "비밀번호를 잊어버렸어요.", a: <><Link href="/forgot-password" className="underline underline-offset-4">비밀번호 재설정</Link>에서 가입한 이메일로 재설정 링크를 받을 수 있어요.</> },
      { q: "탈퇴하면 내 정보는 어떻게 되나요?", a: <>마이페이지 맨 아래 &lsquo;회원 탈퇴하기&rsquo;에서 탈퇴할 수 있어요. 지우는 정보와 법에 따라 보관하는 정보는 <Link href="/privacy" className="underline underline-offset-4">개인정보 처리방침</Link>에 적혀 있어요.</> },
    ],
  },
  {
    group: "호스트",
    items: [
      { q: "호스트가 되고 싶어요.", a: <><Link href="/become-a-host" className="underline underline-offset-4">호스트 안내</Link>를 읽고 지원서를 보내 주세요. 운영팀이 경력과 기획안을 직접 확인한 뒤 결과를 알려 드려요.</> },
    ],
  },
  {
    group: "신고·안전",
    items: [
      { q: "불편하거나 위험한 일이 있었어요.", a: "1:1 문의에서 '신고·안전'을 골라 알려 주세요. 신고 내용은 운영팀만 볼 수 있고, 신고한 사람은 호스트에게 알려지지 않아요." },
    ],
  },
];

export default function HelpPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1" data-testid="help">
        <PageHero title="고객센터" description={`${brand.name} 이용 중 궁금한 점을 찾아보고, 해결되지 않으면 1:1로 물어보세요.`}>
          <div className="mt-6 grid max-w-xl grid-cols-2 gap-2">
            <Link href="/help/contact" className="flex items-center gap-3 rounded-2xl bg-forest px-4 py-4 text-white hover:bg-forest/90" data-testid="help-contact">
              <MessageCircle aria-hidden className="size-5" strokeWidth={1.8} />
              <span className="text-sm font-bold">1:1 문의하기</span>
            </Link>
            <Link href="/me/support" className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-4 hover:border-forest/40">
              <Ticket aria-hidden className="size-5 text-forest" strokeWidth={1.8} />
              <span className="text-sm font-bold">내 문의 내역</span>
            </Link>
          </div>
        </PageHero>

        <Section className="max-w-3xl" aria-labelledby="faq-title">
          <SectionTitle id="faq-title">자주 묻는 질문</SectionTitle>
          <div className="flex flex-col gap-6">
            {FAQ.map((g) => (
              <div key={g.group}>
                <h3 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">{g.group}</h3>
                <div className="divide-y divide-dashed divide-[#ddd3c2] rounded-[20px] bg-card px-4 shadow-[0_2px_0_rgb(80_55_25/0.08),0_14px_24px_-14px_rgb(80_55_25/0.4)]">
                  {g.items.map((it) => (
                    <details key={it.q} className="group py-1" data-testid="faq-item">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 text-[15px] font-medium">
                        {it.q}
                        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                      </summary>
                      <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{it.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 px-1 text-sm text-muted-foreground">
            찾는 답이 없나요? <Link href="/help/contact" className="font-semibold text-forest underline underline-offset-4">1:1 문의</Link>를 남겨 주시면 운영팀이 확인한 뒤 답변하고, 답변이 오면 알림으로 알려 드려요.
          </p>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
