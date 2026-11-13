import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description: "어떤 개인정보를 왜 모으고, 누가 볼 수 있으며, 언제 지우는지 안내합니다.",
};

/**
 * 개인정보 처리방침 (초안)
 * - 지금 시스템이 실제로 하는 일만 적는다. 정해지지 않은 것(위탁 업체 확정, 서버 위치, 결제사)은 "정식 오픈 전 확정"으로 표시
 * - 출시 전 법률 검토를 거쳐 확정 (가입 화면 안내와 같은 문구)
 */
const COLLECT = [
  { item: "이메일, 비밀번호(암호화 저장), 닉네임", when: "회원가입", why: "회원 식별, 로그인, 공지·알림", keep: "탈퇴 시 즉시 삭제·익명화" },
  { item: "약관·개인정보 동의 기록 (동의 버전, 시각)", when: "회원가입", why: "동의 사실 증명", keep: "법령상 보관 의무 기간 (정식 오픈 전 확정)" },
  { item: "휴대폰 번호, 출생 연도 (선택)", when: "마이페이지에서 직접 입력할 때", why: "본인 확인, 연락", keep: "탈퇴 시 즉시 삭제" },
  { item: "호스트 지원서: 이름, 휴대폰 번호, 경력·기획안 등", when: "호스트 지원", why: "호스트 심사와 결과 안내", keep: "반려·1년 미제출 지원서는 1년 뒤 정리, 탈퇴 시 즉시 삭제" },
  { item: "프로필 사진, 콘텐츠 대표 사진", when: "호스트가 직접 올릴 때", why: "호스트 페이지·저널 공개", keep: "교체하면 예전 사진 즉시 삭제. 탈퇴하면 공개 화면에서 바로 내리고, 저장된 파일은 운영팀이 정리" },
  { item: "1:1 문의 내용 (분야, 제목, 내용, 연결한 신청)", when: "고객센터에 문의할 때", why: "문의 답변, 분쟁 처리", keep: "소비자 불만·분쟁 처리 기록 보관 기간 (전자상거래법상 3년, 정식 오픈 전 확정)" },
  { item: "신청·결제 기록 (금액, 상태, 주문번호)", when: "프로그램 신청", why: "신청 관리, 환불, 분쟁 대응", keep: "전자상거래 관련 법령상 보관 기간 (정식 오픈 전 확정)" },
];

const WHO = [
  { who: "누구나 (로그인 없이)", sees: "닉네임, 호스트 공개 프로필, 공개된 프로그램·글" },
  { who: "호스트", sees: "내 프로그램 신청자의 닉네임과 인원만. 신청자의 이메일·휴대폰은 볼 수 없어요" },
  { who: "확정된 참가자", sees: "참가가 확정된 일정의 상세 주소 (확정 전에는 동네까지만)" },
  { who: "운영팀 (관리자)", sees: "2단계 인증을 마친 관리자만. 이메일·휴대폰은 가려서 보이고, 원문은 사유를 적어야 볼 수 있으며 열람 기록이 남아요" },
];

const SAFEGUARDS = [
  "모든 데이터는 데이터베이스에서 다시 한 번 권한을 확인해요 (화면에서 막는 것과 별도로, 이중 확인).",
  "지원서의 휴대폰 번호는 표에서 직접 읽을 수 없고, 본인 확인 함수와 관리자 열람 함수로만 볼 수 있어요.",
  "관리자의 개인정보 원문 열람, 회원 목록 조회, 역할·상태 변경은 모두 감사 기록에 남고, 이 기록은 아무도 수정하거나 지울 수 없어요.",
  "올리는 사진은 촬영 위치(GPS)와 기기 정보를 지운 뒤 저장해요.",
  "비밀번호는 암호화되어 저장되고, 운영팀도 볼 수 없어요.",
  "결제는 결제대행사를 통해서만 처리하며, 카드 번호는 저장하지 않아요. (현재는 테스트 결제만 운영)",
];

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-8 sm:py-16" data-testid="privacy-policy">
        <p className="eyebrow text-muted-foreground">Privacy</p>
        <h1 className="mt-3 font-display text-3xl font-medium sm:text-4xl">개인정보 처리방침</h1>
        <p className="mt-4 bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="privacy-draft-note">
          초안입니다. 정식 오픈 전에 법률 검토를 거쳐 확정하고, 바뀌는 내용은 시행일과 함께 공지합니다.
        </p>
        <p className="mt-6 leading-relaxed">
          {brand.name}은(는) 서비스에 꼭 필요한 정보만 모으고, 볼 수 있는 사람을 최소한으로 줄이며, 필요가 끝나면 지웁니다.
        </p>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-medium">1. 모으는 정보와 이유, 보관 기간</h2>
          <div className="mt-5 overflow-x-auto border">
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
          <p className="mt-3 text-sm text-muted-foreground">선택 항목(휴대폰, 출생 연도, 이벤트 수신)은 동의하지 않아도 서비스를 이용할 수 있어요.</p>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-medium">2. 누가 볼 수 있나</h2>
          <ul className="mt-5 flex flex-col divide-y border-y">
            {WHO.map((r) => (
              <li key={r.who} className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr]">
                <span className="font-medium">{r.who}</span>
                <span className="text-sm leading-relaxed">{r.sees}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-medium">3. 보호 장치</h2>
          <ul className="mt-5 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
            {SAFEGUARDS.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-medium">4. 처리를 맡기는 곳 (위탁)</h2>
          <p className="mt-4 text-sm leading-relaxed">
            서비스 운영을 위해 클라우드 데이터베이스(Supabase)와 웹 호스팅(Vercel)을 이용합니다. 결제대행사, 서버 위치(국외 이전 여부)와
            각 업체의 세부 내용은 정식 오픈 전에 확정해 이 페이지에 적습니다.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-medium">5. 내 권리</h2>
          <ul className="mt-5 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
            <li><Link href="/me" className="underline underline-offset-4">마이페이지</Link>에서 내 정보를 보고 고칠 수 있어요.</li>
            <li><Link href="/me/withdraw" className="underline underline-offset-4">회원 탈퇴</Link>를 하면 이메일은 익명화되고, 휴대폰·출생 연도·지원서 개인정보·팔로우가 지워지며, 내가 쓴 글은 비공개로 내려가요.</li>
            <li>동의를 거부할 권리가 있어요. 필수 항목에 동의하지 않으면 가입할 수 없지만, 선택 항목은 거부해도 이용에 지장이 없어요.</li>
            <li>열람·정정·삭제·처리 정지 요청과 문의 창구(개인정보 보호책임자)는 정식 오픈 전에 확정해 적습니다.</li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
