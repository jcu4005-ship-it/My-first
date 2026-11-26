import type { Metadata } from "next";
import Link from "next/link";

import { BusinessInfoBlock } from "@/components/legal/business-info";
import { DraftNote, LegalMeta, LegalSection, ReviewNote } from "@/components/layout/legal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { brand } from "@/config/brand";
import { TERMS_CHANGE_NOTICE_DAYS } from "@/config/legal";

export const metadata: Metadata = {
  title: "이용약관",
  description: `${brand.name} 서비스 이용약관 (초안)`,
};

/**
 * 이용약관 (초안) — 지금 서비스가 실제로 하는 일만 적음. 정식 오픈 전 법률 검토로 확정.
 *  - 플랫폼의 법적 지위·책임 범위·결제/정산 구조는 단정하지 않고 <ReviewNote>로 확인 항목을 표시 (초안인 동안만 보임)
 *  - 사업자 정보는 src/config/business.ts 에서 읽음 (직접 입력 전에는 "입력 필요"로 표시)
 *  - 개정일·시행일·버전·이력은 src/config/legal.ts 에서 관리
 */
export default function TermsPage() {
  const n = brand.name;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-8 sm:py-16" data-testid="terms">
        <p className="cap text-[12px] font-semibold text-brand">Terms of Service</p>
        <h1 className="font-display mt-3 text-[32px] font-light sm:text-[40px]">이용약관</h1>
        <LegalMeta doc="terms" />
        <DraftNote testId="terms-draft-note" />

        <LegalSection no={1} title="목적">
          <p>이 약관은 {n}(이하 &quot;플랫폼&quot;)이 제공하는, 크리에이터와 참가자를 4~10명 규모의 오프라인 프로그램으로 연결하는 서비스의 이용 조건과 절차를 정해요.</p>
        </LegalSection>

        <LegalSection no={2} title="용어">
          <p><b>회원</b>: 이 약관에 동의하고 가입한 사람. <b>크리에이터(호스트)</b>: 운영팀 확인을 거쳐 프로그램을 여는 회원. <b>참가자</b>: 프로그램에 신청하는 회원. <b>프로그램</b>: 크리에이터가 열고 운영팀이 검수해 공개한 오프라인 모임·클래스.</p>
        </LegalSection>

        <LegalSection no={3} title="서비스의 성격과 플랫폼의 역할">
          <p>플랫폼은 크리에이터와 참가자를 연결하고, 프로그램 소개·신청·결제 안내·환불 처리·고객센터를 제공해요. 프로그램의 내용과 진행은 크리에이터가 책임지고, 플랫폼은 공개 전 검수와 문제 발생 시 조정을 해요.</p>
          <ReviewNote doc="terms">플랫폼의 법적 지위(통신판매중개 해당 여부 등)와 책임 범위는 아직 확정하지 않았어요. 실제 운영 방식과 결제·정산 구조를 확인한 뒤 전문가 검토로 표현을 확정합니다.</ReviewNote>
        </LegalSection>

        <LegalSection no={4} title="약관의 효력과 개정" id="amend">
          <p>이 약관은 서비스 화면에 게시해 알리고, 회원이 동의하면 효력이 생겨요. 각 약관 문서에는 <b>개정일, 시행일, 버전</b>을 적고, 이전 버전은 문서 위쪽에서 볼 수 있어요.</p>
          <p>약관을 바꿀 때는 시행일 {TERMS_CHANGE_NOTICE_DAYS}일 전부터 사이트에 알리고, 회원에게 중요한 내용이 달라지면 알림으로도 알려 드려요. 시행일 이후에도 서비스를 계속 이용하면 바뀐 약관에 동의한 것으로 봐요. 동의하지 않으면 탈퇴할 수 있어요.</p>
          <ReviewNote doc="terms">회원에게 불리한 변경의 공지 기간(더 길게 알려야 하는지), 계속 이용 시 동의 간주 조항의 유효 범위, 재동의 절차는 법률 검토로 확정합니다.</ReviewNote>
        </LegalSection>

        <LegalSection no={5} title="회원가입과 탈퇴">
          <p>만 14세 이상이면 가입할 수 있어요. 가입할 때 이용약관과 개인정보 수집·이용에 동의해야 해요. 이벤트·혜택 정보 수신은 선택이에요. 회원은 언제든 마이페이지에서 탈퇴할 수 있고, 탈퇴하면 예정된 신청은 취소되며 환불은 <Link href="/refund" className="underline underline-offset-4">취소·환불 정책</Link>을 따라요.</p>
          <p>다른 사람의 정보를 쓰거나, 아래 금지 행위를 하면 이용을 제한할 수 있어요.</p>
          <ReviewNote doc="terms">만 14세 미만 가입을 막는 방식(현재는 &quot;만 14세 이상입니다&quot; 체크)이 충분한지 확인이 필요해요.</ReviewNote>
        </LegalSection>

        <LegalSection no={6} title="신청과 결제">
          <p>신청은 프로그램 페이지에서, 결제는 {n} 결제로만 해요. 무료 프로그램은 신청 즉시, 유료 프로그램은 결제가 끝나면 확정돼요. 확정된 참가자에게만 상세 주소를 안내해요.</p>
          <p>크리에이터가 플랫폼 밖 결제(계좌 송금·현장 결제 등)를 요청하는 것은 금지예요. 플랫폼 밖에서 오간 돈은 플랫폼이 보호하기 어려워요.</p>
          <p>결제 직전 화면에서 그 프로그램의 취소·환불 기준을 날짜와 함께 다시 보여 드려요.</p>
          <ReviewNote doc="terms">결제대행사(PG) 계약과 정산(지급대행 여부) 구조가 정해지면 결제 주체, 결제 정보 처리, 구매 안전 서비스에 관한 문구를 확정합니다. 지금은 테스트 결제만 운영 중이라 실제 청구가 없어요.</ReviewNote>
        </LegalSection>

        <LegalSection no={7} title="취소와 환불">
          <p>취소·환불은 <Link href="/refund" className="underline underline-offset-4">취소·환불 정책</Link>을 따르고, <b>참가자가 취소할 때</b>와 <b>크리에이터 사정으로 취소될 때</b>를 구분해요.</p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li><b>참가자 취소</b>: 프로그램 날짜(한국 시간)까지 남은 기간에 따라 환불 비율이 달라져요.</li>
            <li><b>크리에이터 사정으로 취소</b>: 날짜와 관계없이 전액 환불돼요.</li>
          </ul>
        </LegalSection>

        <LegalSection no={8} title="크리에이터의 약속과 정산">
          <p>크리에이터는 프로그램 페이지에 적은 내용(일정·장소·&quot;참가자가 얻는 것&quot;)을 지키고, 참가자의 안전과 개인정보를 보호해요.</p>
          <p>플랫폼은 참가비에서 수수료를 뺀 금액을 크리에이터에게 정산해요. 수수료율·0% 기간·정산 일정은 크리에이터 안내 페이지와 크리에이터 계약에 따르며, 결제 시점의 수수료율이 적용돼요.</p>
          <ReviewNote doc="terms">정산 대금의 보관·지급 구조(PG 지급대행 이용 여부)와 크리에이터에게 지급할 때의 세금 처리는 PG 계약과 세무 확인 후 확정합니다.</ReviewNote>
        </LegalSection>

        <LegalSection no={9} title="후기와 게시물">
          <p>후기는 실제로 참가한 회원만 쓸 수 있어요. 욕설·개인정보·광고·사실이 아닌 내용은 운영팀이 가릴 수 있고, 그 기록은 남아요.</p>
        </LegalSection>

        <LegalSection no={10} title="금지 행위">
          <p>다른 회원의 개인정보 수집·유출, 플랫폼 밖 결제 유도, 허위 정보로 프로그램 개설·신청, 다른 참가자에 대한 괴롭힘·차별, 서비스 운영 방해를 금지해요.</p>
        </LegalSection>

        <LegalSection no={11} title="책임의 범위">
          <p>오프라인 프로그램 진행 중 회원 사이에 생긴 손해에 대한 책임의 범위는 아래 검토 후 확정해요. 분쟁이 생기면 고객센터를 통해 해결을 돕고, 필요하면 해당 회원의 이용을 제한해요.</p>
          <ReviewNote doc="terms">플랫폼의 면책·책임 제한 문구는 법적 지위에 따라 달라져요. 현재 초안은 책임을 단정하지 않았고, 확정 전까지 임의로 면책을 적지 않았어요.</ReviewNote>
        </LegalSection>

        <LegalSection no={12} title="분쟁 해결">
          <p>분쟁은 먼저 <Link href="/help/contact" className="underline underline-offset-4">고객센터</Link>에서 협의해요. 해결되지 않으면 관련 법령에 따라요.</p>
          <ReviewNote doc="terms">관할 법원, 소비자 분쟁 해결 기준과 분쟁 조정 기관 안내 문구는 법률 검토로 확정합니다.</ReviewNote>
        </LegalSection>

        <LegalSection no={13} title="사업자 정보">
          <BusinessInfoBlock />
          <p className="mt-1 text-[13px] text-muted-foreground">
            개인정보 처리 내용은 <Link href="/privacy" className="underline underline-offset-4">개인정보 처리방침</Link>에서 확인할 수 있어요.
          </p>
        </LegalSection>
      </main>
      <SiteFooter />
    </>
  );
}
