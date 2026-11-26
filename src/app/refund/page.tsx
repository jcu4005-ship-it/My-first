import type { Metadata } from "next";
import Link from "next/link";

import { DraftNote, LegalMeta, LegalSection, ReviewNote } from "@/components/layout/legal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { brand } from "@/config/brand";
import { REFUND_RULES } from "@/lib/payments/refund-policy";

export const metadata: Metadata = {
  title: "취소·환불 정책",
  description: "프로그램 취소와 환불 기준을 안내합니다.",
};

/** 플랫폼 공통 환불 기준 (대표 결정 2026-11-18). 숫자는 REFUND_RULES·DB 계산과 같은 규칙 */
export default function RefundPolicyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-8 sm:py-16" data-testid="refund-policy">
        <p className="cap text-[12px] font-semibold text-brand">Refund Policy</p>
        <h1 className="font-display mt-3 text-[32px] font-light sm:text-[40px]">취소·환불 정책</h1>
        <LegalMeta doc="refund" />
        <DraftNote testId="refund-draft-note" />
        <p className="mt-6 leading-relaxed">
          {brand.name}의 모든 프로그램은 같은 기준으로 환불돼요. 4~10명의 작은 자리라 직전 취소는 크리에이터와 다른 참가자에게 영향이 커서, 날짜에 따라 환불 비율이 달라요.
        </p>

        <LegalSection no={1} title="참가자가 취소할 때">
          <div className="overflow-hidden rounded-[4px] border border-border" data-testid="refund-table">
            <table className="w-full text-left text-[15px]">
              <thead className="bg-card text-[12px] text-muted-foreground">
                <tr><th className="px-4 py-2.5 font-semibold">취소 시점 (프로그램 날짜 기준, 한국 시간)</th><th className="px-4 py-2.5 text-right font-semibold">환불</th></tr>
              </thead>
              <tbody>
                {REFUND_RULES.map((r) => (
                  <tr key={r.when} className="border-t border-border">
                    <td className="px-4 py-3">{r.when}</td>
                    <td className="px-4 py-3 text-right font-extrabold tabular-nums">{r.percent === 0 ? "환불 없음" : `${r.percent}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>예) 11월 20일 오후 3시 프로그램 → 11월 17일까지 취소 100% · 11월 18~19일 50% · 11월 20일 당일 환불 없음</p>
          <p>당일에도 취소는 할 수 있어요. 취소하면 자리가 대기 중인 분께 돌아가요.</p>
          <p>취소는 마이페이지 → 내 예약에서 직접 할 수 있고, 취소 전에 환불 금액을 먼저 보여 드려요.</p>
          <ReviewNote doc="refund">참가자가 취소할 때의 환불 비율(3일 전까지 100% · 2~1일 전 50% · 당일 0%)이 청약철회, 소비자분쟁해결기준 등 관련 법령·기준과 충돌하지 않는지 확인합니다. 숫자는 대표 결정(2026-11-18)이고 시스템 계산과 같아요.</ReviewNote>
        </LegalSection>

        <LegalSection no={2} title="크리에이터 사정으로 취소될 때">
          <p>크리에이터가 일정을 취소하면 날짜와 관계없이 <b>전액 환불</b>돼요. 취소 사유와 함께 알림으로 알려 드려요. 참가자가 따로 취소 신청을 하지 않아도 돼요.</p>
          <p>참가자의 취소와 크리에이터의 취소는 환불 기준이 달라요. 참가자가 취소하면 위 표의 비율이, 크리에이터 사정으로 취소되면 항상 전액이 적용돼요.</p>
        </LegalSection>

        <LegalSection no={3} title="환불 방법과 기간">
          <p>결제한 수단(카드 등)으로 환불돼요. 카드사에 따라 실제 반영까지 영업일 기준 3~7일 걸릴 수 있어요.</p>
          <p>무료 프로그램은 언제든 취소할 수 있어요.</p>
          <ReviewNote doc="refund">결제수단별 환불 소요 기간(위 3~7일은 임시 안내), 부분 환불 시 결제대행 수수료의 처리, 환불 지연 시 안내는 결제대행사(PG) 계약과 정산 구조를 확인한 뒤 확정합니다. 지금은 테스트 결제만 운영 중이라 실제 환불은 일어나지 않아요.</ReviewNote>
        </LegalSection>

        <LegalSection no={4} title="결제는 플랫폼 안에서만">
          <p>
            참가비는 {brand.name} 결제로만 받아요. 크리에이터가 계좌 송금이나 현장 결제를 요청하면 따르지 마시고{" "}
            <Link href="/help/contact" className="underline underline-offset-4">고객센터</Link>로 알려 주세요. 플랫폼 밖에서 낸 돈은 환불을 도와드리기 어려워요.
          </p>
        </LegalSection>

        <LegalSection no={5} title="문의">
          <p>
            환불이 기준과 다르게 처리됐거나 불가피한 사정(질병·사고 등)이 있다면 <Link href="/help/contact" className="underline underline-offset-4">1:1 문의</Link>로 알려 주세요. 운영팀이 크리에이터와 함께 확인해요.
          </p>
        </LegalSection>
      </main>
      <SiteFooter />
    </>
  );
}
