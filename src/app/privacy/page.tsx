import type { Metadata } from "next";
import Link from "next/link";

import { DraftNote, LegalMeta, LegalSection, ReviewNote } from "@/components/layout/legal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BUSINESS_INFO } from "@/config/business";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description: "어떤 개인정보를 왜 모으고, 누가 볼 수 있으며, 언제 지우는지 안내합니다.",
};

/**
 * 개인정보 처리방침 (초안)
 * - 지금 시스템이 실제로 하는 일(수집 항목·쓰는 외부 서비스)만 적는다. 정해지지 않은 것은 지어내지 않고 "확정 전"과 <ReviewNote>로 표시
 * - 수집 항목을 바꾸는 기능을 추가하면 이 표도 함께 고친다 (docs/LEGAL_POLICY_SYSTEM.md 점검표)
 * - 개정일·시행일·버전은 src/config/legal.ts, 보호책임자·연락처는 src/config/business.ts
 */
const COLLECT = [
  { item: "이메일, 비밀번호(암호화 저장), 닉네임", when: "회원가입", why: "회원 식별, 로그인, 공지·알림", keep: "탈퇴 시 즉시 삭제·익명화" },
  { item: "약관·개인정보 동의 기록 (동의 버전, 시각)", when: "회원가입", why: "동의 사실 증명", keep: "법령상 보관 의무 기간 (확정 전)" },
  { item: "휴대폰 번호, 출생 연도 (선택)", when: "마이페이지에서 직접 입력할 때", why: "본인 확인, 연락", keep: "탈퇴 시 즉시 삭제" },
  {
    item: "크리에이터 지원 접수: 이름·활동명, 관심 분야, 잘하는 것·관련 경험·지원 동기, 휴대폰 번호, SNS·포트폴리오 링크, 함께 해 보고 싶은 활동",
    when: "크리에이터 지원(로그인 없이 가능)",
    why: "지원 내용 확인, 전화 인터뷰 연락, 프로그램 기획 검토",
    keep: "보관 기간 확정 전 (삭제를 요청하면 지워요)",
  },
  { item: "전화 인터뷰 메모·녹취 기록 (운영팀이 작성·보관)", when: "인터뷰를 진행할 때", why: "그 사람의 강점과 프로그램 방향 정리", keep: "보관 기간 확정 전 (삭제를 요청하면 지워요)" },
  { item: "호스트 지원서: 이름, 휴대폰 번호, 질문 답변, 경력·링크 등", when: "정식 호스트 지원", why: "호스트 확인과 결과 안내", keep: "반려·1년 미제출 지원서는 1년 뒤 정리, 탈퇴 시 즉시 삭제" },
  { item: "프로필 사진, 콘텐츠 대표 사진", when: "호스트가 직접 올릴 때", why: "호스트 페이지·저널 공개", keep: "교체하면 예전 사진 즉시 삭제. 탈퇴하면 공개 화면에서 바로 내리고, 저장된 파일은 운영팀이 정리" },
  { item: "1:1 문의 내용 (분야, 제목, 내용, 연결한 신청)", when: "고객센터에 문의할 때", why: "문의 답변, 분쟁 처리", keep: "소비자 불만·분쟁 처리 기록 보관 기간 (확정 전)" },
  { item: "신청·결제 기록 (금액, 상태, 주문번호)", when: "프로그램 신청", why: "신청 관리, 환불, 분쟁 대응", keep: "전자상거래 관련 법령상 보관 기간 (확정 전)" },
  { item: "저장한 프로그램 (로그인한 경우)", when: "프로그램의 저장 버튼을 누를 때", why: "다른 기기에서도 저장 목록 보기", keep: "저장을 취소하거나 탈퇴할 때" },
  { item: "서비스 안 알림 기록", when: "신청 확정·취소·지원 결과 등 알림이 생길 때", why: "알림 제공", keep: "탈퇴 시 삭제" },
];

const AUTO = [
  { item: "로그인 유지 쿠키(세션)", why: "로그인 상태 유지 — 서비스 이용에 꼭 필요한 쿠키예요. 브라우저에서 지우면 로그아웃돼요." },
  { item: "저장한 프로그램, 최근 본 프로그램·글", why: "이 기기의 브라우저에 저장해요. 최근 본 것은 서버로 보내지 않고, 저장한 프로그램은 로그인한 경우 계정에도 저장돼요." },
  { item: "접속 기록 (IP 주소, 브라우저 정보 등)", why: "호스팅 서비스가 보안과 장애 대응을 위해 자동으로 기록할 수 있어요. 서비스가 따로 모아 쓰지는 않아요." },
];

const WHO = [
  { who: "누구나 (로그인 없이)", sees: "닉네임, 호스트 공개 프로필, 공개된 프로그램·글" },
  { who: "호스트", sees: "내 프로그램 신청자의 닉네임과 인원만. 신청자의 이메일·휴대폰은 볼 수 없어요" },
  { who: "확정된 참가자", sees: "참가가 확정된 일정의 상세 주소 (확정 전에는 동네까지만)" },
  { who: "운영팀 (관리자)", sees: "2단계 인증을 마친 관리자만. 이메일·휴대폰은 가려서 보이고, 원문은 사유를 적어야 볼 수 있으며 열람 기록이 남아요. 크리에이터 지원 내용과 인터뷰 메모는 관리자만 볼 수 있어요" },
];

const SAFEGUARDS = [
  "모든 데이터는 데이터베이스에서 다시 한 번 권한을 확인해요 (화면에서 막는 것과 별도로, 이중 확인).",
  "지원서의 휴대폰 번호는 표에서 직접 읽을 수 없고, 본인 확인 함수와 관리자 열람 함수로만 볼 수 있어요.",
  "관리자의 개인정보 원문 열람, 회원 목록 조회, 역할·상태 변경은 모두 감사 기록에 남고, 이 기록은 아무도 수정하거나 지울 수 없어요.",
  "올리는 사진은 촬영 위치(GPS)와 기기 정보를 지운 뒤 저장해요.",
  "비밀번호는 암호화되어 저장되고, 운영팀도 볼 수 없어요.",
  "결제는 결제대행사를 통해서만 처리하며, 카드 번호는 저장하지 않아요. (현재는 테스트 결제만 운영)",
];

const SERVICES = [
  { name: "Supabase Inc.", what: "데이터베이스, 로그인(인증), 사진 파일 저장, 인증 메일 발송", data: "계정·서비스 이용 데이터 전체", state: "이용 중" },
  { name: "Vercel Inc.", what: "웹사이트 호스팅", data: "접속 기록 등 호스팅에 필요한 정보", state: "이용 중" },
  { name: "결제대행사 (PG)", what: "참가비 결제·환불 처리", data: "결제 정보(카드 번호는 서비스가 저장하지 않음)", state: "미정 · 지금은 테스트 결제만" },
  { name: "자체 메일 발송 서비스", what: "인증·알림 메일 발송", data: "이메일 주소", state: "미정 · 지금은 Supabase 기본 발송" },
  { name: "카카오톡 (운영자 알림)", what: "새 지원이 접수되면 운영자에게 안내 문구와 링크만 전송", data: "개인정보는 보내지 않아요", state: "설정 시에만" },
  { name: "AI 분석 도구", what: "운영팀이 프로그램 기획을 검토할 때 지원 내용 분석", data: "지원 답변·인터뷰 메모 (연락처는 제외할 예정)", state: "서비스·방식 미정" },
];

export default function PrivacyPage() {
  const officer = BUSINESS_INFO.privacyOfficer;
  const csEmail = BUSINESS_INFO.csEmail;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-8 sm:py-16" data-testid="privacy-policy">
        <p className="cap text-[12px] font-semibold text-brand">Privacy</p>
        <h1 className="font-display mt-3 text-[32px] font-light sm:text-[40px]">개인정보 처리방침</h1>
        <LegalMeta doc="privacy" />
        <DraftNote testId="privacy-draft-note" />
        <p className="mt-6 leading-relaxed break-keep">
          {brand.name}은(는) 서비스에 꼭 필요한 정보만 모으고, 볼 수 있는 사람을 최소한으로 줄이며, 필요가 끝나면 지웁니다.
        </p>

        <LegalSection no={1} title="모으는 정보와 이유, 보관 기간">
          <div className="overflow-x-auto border" tabIndex={0} role="region" aria-label="수집하는 정보 표 (좌우로 스크롤)">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-muted/50">
                <tr><th className="p-3">항목</th><th className="p-3">언제</th><th className="p-3">왜</th><th className="p-3">언제 지우나</th></tr>
              </thead>
              <tbody>
                {COLLECT.map((r) => (
                  <tr key={r.item} className="border-t align-top">
                    <td className="p-3 font-medium">{r.item}</td>
                    <td className="p-3">{r.when}</td>
                    <td className="p-3">{r.why}</td>
                    <td className="p-3">{r.keep}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">선택 항목(휴대폰, 출생 연도, 이벤트 수신)은 동의하지 않아도 서비스를 이용할 수 있어요. 크리에이터 지원은 연락처 없이는 전화 인터뷰를 할 수 없어서 연락처가 필요해요.</p>
          <ReviewNote doc="privacy">항목별 보유 기간(전자상거래법상 거래·분쟁 기록, 지원서·인터뷰 기록의 보관 기간)과 파기 방법은 법률 검토로 확정합니다. 지원서·인터뷰 기록의 자동 파기는 아직 만들지 않았어요.</ReviewNote>
        </LegalSection>

        <LegalSection no={2} title="자동으로 생기는 정보와 기기 저장">
          <ul className="flex flex-col divide-y border-y">
            {AUTO.map((r) => (
              <li key={r.item} className="grid gap-1 py-3 sm:grid-cols-[13rem_1fr]">
                <span className="font-medium">{r.item}</span>
                <span className="text-sm leading-relaxed">{r.why}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">방문 통계·광고 분석 도구는 쓰지 않아요. 쓰게 되면 이 문서에 먼저 적어요.</p>
        </LegalSection>

        <LegalSection no={3} title="누가 볼 수 있나">
          <ul className="flex flex-col divide-y border-y">
            {WHO.map((r) => (
              <li key={r.who} className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr]">
                <span className="font-medium">{r.who}</span>
                <span className="text-sm leading-relaxed">{r.sees}</span>
              </li>
            ))}
          </ul>
        </LegalSection>

        <LegalSection no={4} title="보호 장치">
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
            {SAFEGUARDS.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </LegalSection>

        <LegalSection no={5} title="처리를 맡기는 곳과 쓰는 외부 서비스">
          <p>서비스 운영을 위해 아래 외부 서비스를 이용해요. 쓰는 서비스가 바뀌거나 늘면 이 표를 먼저 고쳐요.</p>
          <div className="overflow-x-auto border" tabIndex={0} role="region" aria-label="외부 서비스 표 (좌우로 스크롤)">
            <table className="w-full min-w-[640px] text-left text-sm" data-testid="privacy-services">
              <thead className="bg-muted/50">
                <tr><th className="p-3">서비스</th><th className="p-3">맡기는 일</th><th className="p-3">전달되는 정보</th><th className="p-3">상태</th></tr>
              </thead>
              <tbody>
                {SERVICES.map((r) => (
                  <tr key={r.name} className="border-t align-top">
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3">{r.what}</td>
                    <td className="p-3">{r.data}</td>
                    <td className="p-3">{r.state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ReviewNote doc="privacy">서버 위치(국외 이전 여부와 이전 국가·시기·방법), 각 업체의 정확한 법인명, 위탁과 제3자 제공의 구분, 결제대행사·메일 발송 업체·AI 도구가 정해지면 해당 고지 문구와 동의 방식을 확정합니다.</ReviewNote>
        </LegalSection>

        <LegalSection no={6} title="내 권리">
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
            <li><Link href="/me" className="underline underline-offset-4">마이페이지</Link>에서 내 정보를 보고 고칠 수 있어요.</li>
            <li><Link href="/me/withdraw" className="underline underline-offset-4">회원 탈퇴</Link>를 하면 이메일은 익명화되고, 휴대폰·출생 연도·지원서 개인정보·팔로우가 지워지며, 내가 쓴 글은 비공개로 내려가요.</li>
            <li>동의를 거부할 권리가 있어요. 필수 항목에 동의하지 않으면 가입할 수 없지만, 선택 항목은 거부해도 이용에 지장이 없어요.</li>
            <li>로그인하지 않고 크리에이터에 지원한 경우에는 <Link href="/help/contact" className="underline underline-offset-4">고객센터</Link>나 아래 연락처로 열람·정정·삭제를 요청할 수 있어요.</li>
            <li>만 14세 미만은 가입할 수 없어요.</li>
          </ul>
        </LegalSection>

        <LegalSection no={7} title="개인정보 보호책임자와 문의">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[9rem_1fr]" data-testid="privacy-officer">
            <dt className="text-muted-foreground">개인정보 보호책임자</dt>
            <dd className={officer ? undefined : "text-muted-foreground italic"}>{officer ?? "[보호책임자 이름·연락처 입력 필요]"}</dd>
            <dt className="text-muted-foreground">문의 이메일</dt>
            <dd className={csEmail ? undefined : "text-muted-foreground italic"}>{csEmail ?? "[고객센터 이메일 입력 필요]"}</dd>
          </dl>
          <ReviewNote doc="privacy">개인정보 보호책임자 지정 의무 해당 여부와 연락처 표시 방식은 사업자 정보 확정 후 확인합니다.</ReviewNote>
        </LegalSection>

        <LegalSection no={8} title="방침의 변경">
          <p>이 방침을 바꾸면 문서 위쪽에 <b>개정일과 시행일</b>을 적고, 시행일 전에 사이트에 먼저 알려요. 이전 버전은 문서 위쪽 &quot;이전 버전 보기&quot;에서 볼 수 있어요.</p>
        </LegalSection>
      </main>
      <SiteFooter />
    </>
  );
}
