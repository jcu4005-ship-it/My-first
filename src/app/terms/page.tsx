import type { Metadata } from "next";
import Link from "next/link";

import { DraftNote, LegalSection } from "@/components/layout/legal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "이용약관",
  description: `${brand.name} 서비스 이용약관 (초안)`,
};

/**
 * 이용약관 (초안) — 지금 서비스가 실제로 하는 일만 적음. 정식 오픈 전 법률 검토로 확정.
 * 사업자 정보(상호·대표·사업자번호·통신판매업 신고번호·주소·연락처)는 사업자 등록 후 채움.
 */
export default function TermsPage() {
  const n = brand.name;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-8 sm:py-16" data-testid="terms">
        <p className="text-[11px] font-extrabold tracking-[0.26em] text-ember">TERMS OF SERVICE</p>
        <h1 className="mt-2 text-[32px] font-extrabold tracking-[-0.04em] sm:text-[40px]">이용약관</h1>
        <DraftNote testId="terms-draft-note" />

        <LegalSection no={1} title="목적">
          <p>이 약관은 {n}(이하 &quot;플랫폼&quot;)이 제공하는, 크리에이터와 참가자를 4~10명 규모의 오프라인 프로그램으로 연결하는 서비스의 이용 조건과 절차를 정해요.</p>
        </LegalSection>

        <LegalSection no={2} title="용어">
          <p><b>회원</b>: 이 약관에 동의하고 가입한 사람. <b>크리에이터(호스트)</b>: 운영팀 심사를 거쳐 프로그램을 여는 회원. <b>참가자</b>: 프로그램에 신청하는 회원. <b>프로그램</b>: 크리에이터가 열고 운영팀이 검수해 공개한 오프라인 모임·클래스.</p>
        </LegalSection>

        <LegalSection no={3} title="플랫폼의 역할">
          <p>플랫폼은 크리에이터와 참가자를 연결하고, 신청·결제·정산·고객센터를 제공하는 <b>중개자</b>예요. 프로그램의 내용과 진행은 크리에이터가 책임지고, 플랫폼은 공개 전 검수와 문제 발생 시 조정을 해요.</p>
        </LegalSection>

        <LegalSection no={4} title="회원가입과 탈퇴">
          <p>만 14세 이상이면 가입할 수 있어요. 회원은 언제든 마이페이지에서 탈퇴할 수 있고, 탈퇴하면 예정된 신청은 취소되며 환불은 <Link href="/refund" className="underline underline-offset-4">취소·환불 정책</Link>을 따라요.</p>
          <p>다른 사람의 정보를 쓰거나, 아래 금지 행위를 하면 이용을 제한할 수 있어요.</p>
        </LegalSection>

        <LegalSection no={5} title="신청과 결제">
          <p>신청은 프로그램 페이지에서, 결제는 {n} 결제로만 해요. 무료 프로그램은 신청 즉시, 유료 프로그램은 결제가 끝나면 확정돼요. 확정된 참가자에게만 상세 주소를 안내해요.</p>
          <p>크리에이터가 플랫폼 밖 결제(계좌 송금·현장 결제 등)를 요청하는 것은 금지예요. 플랫폼 밖에서 오간 돈은 플랫폼이 보호하기 어려워요.</p>
        </LegalSection>

        <LegalSection no={6} title="취소와 환불">
          <p>취소·환불은 <Link href="/refund" className="underline underline-offset-4">취소·환불 정책</Link>을 따라요. 크리에이터 사정으로 취소되면 전액 환불돼요.</p>
        </LegalSection>

        <LegalSection no={7} title="크리에이터의 약속과 정산">
          <p>크리에이터는 프로그램 페이지에 적은 내용(일정·장소·&quot;참가자가 얻는 것&quot;)을 지키고, 참가자의 안전과 개인정보를 보호해요.</p>
          <p>플랫폼은 참가비에서 수수료를 뺀 금액을 크리에이터에게 정산해요. 수수료율·0% 기간·정산 일정은 크리에이터 안내 페이지와 크리에이터 계약에 따르며, 결제 시점의 수수료율이 적용돼요.</p>
        </LegalSection>

        <LegalSection no={8} title="후기와 게시물">
          <p>후기는 실제로 참가한 회원만 쓸 수 있어요. 욕설·개인정보·광고·사실이 아닌 내용은 운영팀이 가릴 수 있고, 그 기록은 남아요.</p>
        </LegalSection>

        <LegalSection no={9} title="금지 행위">
          <p>다른 회원의 개인정보 수집·유출, 플랫폼 밖 결제 유도, 허위 정보로 프로그램 개설·신청, 다른 참가자에 대한 괴롭힘·차별, 서비스 운영 방해를 금지해요.</p>
        </LegalSection>

        <LegalSection no={10} title="책임의 범위">
          <p>플랫폼은 고의나 중대한 과실이 없는 한, 오프라인 프로그램 진행 중 회원 사이에 생긴 손해에 대해 책임을 지지 않아요. 다만 분쟁이 생기면 고객센터를 통해 해결을 돕고, 필요하면 해당 회원의 이용을 제한해요.</p>
        </LegalSection>

        <LegalSection no={11} title="분쟁 해결">
          <p>분쟁은 먼저 <Link href="/help/contact" className="underline underline-offset-4">고객센터</Link>에서 협의해요. 해결되지 않으면 관련 법령과 대한민국 법원의 관할에 따라요.</p>
        </LegalSection>

        <LegalSection no={12} title="사업자 정보">
          <p data-testid="business-info-pending">상호·대표자·사업자등록번호·통신판매업 신고번호·주소·연락처는 사업자 등록 후 이 자리와 사이트 아래쪽에 표시해요.</p>
        </LegalSection>
      </main>
      <SiteFooter />
    </>
  );
}
