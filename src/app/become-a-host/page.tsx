import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { Suspense } from "react";

import { brand } from "@/config/brand";
import { getAppSettings, percentLabel } from "@/lib/settings/queries";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Card, PageHero, Section, SectionTitle } from "@/components/layout/page-parts";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "호스트 안내",
  description: "입장료 없이, 프로그램이 판매될 때만. 호스트 정책과 앞으로의 계획을 안내합니다.",
};

/*
 * 호스트 정책 안내 (사업 계획 v1.1 기준).
 * - 확정된 정책(2026-11-17 대표 결정): 입장료 없음, 신청·결제는 플랫폼에서만, 판매 금액에서 수수료를 뺀 금액 정산,
 *   호스트 승인일부터 일정 기간 수수료 0%(대신 호스트 동의 시 최대 10% 참가자 쿠폰, 호스트 부담), 경력 심사
 * - 수수료율·0% 기간 숫자는 운영 설정(DB)에서 읽어 표시 — 관리자가 바꾸면 화면도 같이 바뀜
 * - 앞으로의 계획은 "준비 중"으로 표시
 */

/** 운영 설정(DB)의 수수료율·0% 기간을 읽는 부분만 따로 — 나머지 화면은 미리 만들어 둠 */
async function CommissionPrincipleText() {
  const st = await getAppSettings();
  return (
    <>
      참가비는 {brand.name}에서 결제되고, 수수료 {percentLabel(st.commission_rate_bp)}를 뺀 금액을 정산해 드립니다.
      {st.commission_free_months > 0 && <> 호스트 승인일부터 {st.commission_free_months}개월은 수수료 0%입니다.</>} 판매가 없으면 수수료도 없습니다.
    </>
  );
}

async function CommissionNote() {
  const st = await getAppSettings();
  const rate = percentLabel(st.commission_rate_bp);
  return (
    <p className="mt-4 rounded-xl bg-notice px-4 py-3 text-sm leading-relaxed text-notice-foreground" data-testid="commission-note">
      예) 참가비 30,000원 → 수수료 {rate} 제외 → 호스트 정산 {Math.round(30000 * (1 - st.commission_rate_bp / 10000)).toLocaleString("ko-KR")}원. 수수료율은 결제되는 순간의 비율로 고정되고, 프로그램이 끝나고 7일 뒤 정산이 확정됩니다.
      {st.commission_free_months > 0 && <> 수수료 0% 기간({st.commission_free_months}개월) 동안에는 호스트가 프로그램마다 동의하면 {brand.name} 참가자 할인 쿠폰(최대 10%, 호스트 부담)을 쓸 수 있습니다.</>}{" "}
      참가비는 반드시 {brand.name} 결제로만 받아요. 계좌 송금·현장 결제 안내는 할 수 없어요. 지금은 테스트 결제만 운영 중이며 실제 청구·지급은 없습니다.
    </p>
  );
}

const PRINCIPLES: { no: string; title: string; body: React.ReactNode }[] = [
  { no: "01", title: "입장료는 없습니다", body: "호스트가 되는 데 드는 비용은 없습니다. 돈을 낸다고 호스트가 되지도 않습니다. 심사로만 함께합니다." },
  {
    no: "02",
    title: "프로그램이 판매될 때만",
    body: (
      <Suspense fallback={<>참가비는 {brand.name}에서 결제되고, 수수료를 뺀 금액을 정산해 드립니다.</>}>
        <CommissionPrincipleText />
      </Suspense>
    ),
  },
];

const STEPS = [
  { no: "01", title: "지원", body: "활동 이름과 연락처, 그리고 간단한 질문 3개에 답해 주세요. 3분이면 돼요." },
  { no: "02", title: "대화와 심사", body: "운영팀이 답을 읽고 연락드려요. 질문 몇 가지를 더 나누며 강점을 함께 찾아요. 반려되면 사유를 알려 드리고, 보완해 다시 지원할 수 있습니다." },
  { no: "03", title: "공동 기획", body: "운영팀과 함께 당신만의 첫 프로그램을 기획하고 일정을 추가합니다. 제목, 인원, 진행 순서, '참가자가 얻는 것'을 함께 정해요." },
  { no: "04", title: "검수·공개", body: `운영팀 검수를 거쳐 공개됩니다. 신청·결제·취소·환불은 모두 ${brand.name}이 처리합니다.` },
  { no: "05", title: "정산", body: "프로그램이 끝나고 7일이 지나 분쟁이 없으면 정산 대상이 됩니다. 월 2회, 운영팀이 직접 확인해 지급합니다." },
];

const PROMISES = [
  `모든 신청과 결제는 ${brand.name} 프로그램 페이지에서 받습니다. 플랫폼 밖 거래는 받지 않습니다.`,
  "참가자의 연락처와 개인정보는 공개되지 않습니다. 상세 주소는 참가 확정 후 참가자에게만 안내됩니다.",
  "프로그램에 적은 '참가자가 얻는 것'은 참가자와의 약속입니다.",
  "수익을 나누는 관계에서 프로그램을 홍보할 때는 '광고' 또는 '유료 협찬' 표시를 해 주세요.",
  "호스트 사정으로 일정이 취소되면 참가자에게는 전액 환불됩니다.",
];

const WE_DO = [
  { name: "발견", body: "몇 가지 질문으로 당신의 강점, 경험, 말투 속에서 당신만 만들 수 있는 이야기를 함께 찾아요." },
  { name: "기획", body: "찾은 이야기를 사람들이 모이고 싶은 프로그램으로 함께 기획해요. 제목, 인원, 진행 순서까지요." },
  { name: "브랜딩", body: "소개글과 프로필, 첫 모임의 분위기까지 당신의 말투로 다듬어 사람들에게 보여 드려요." },
];

const ROADMAP: { phase: string; title: string; items: string[]; status: "now" | "next" | "later" }[] = [
  { phase: "Now", title: "첫 호스트와 함께", status: "now", items: ["호스트 지원·심사", "소개와 첫 프로그램 함께 다듬기", "프로그램 만들기·검수·공개", "신청·취소·환불 관리", "참가자 확인과 알림"] },
  { phase: "Next", title: "정식 오픈 준비", status: "next", items: ["실제 결제 연결(정산 계산은 준비됨)"] },
  { phase: "Later", title: "함께 넓혀 갈 것", status: "later", items: ["멤버십과 멤버 우선 좌석", `${brand.name} Originals`, "참가자에서 호스트로 성장하는 과정", "프로그램 기획 지원 서비스", "문화·예술 분야로 확장"] },
];

export default function ForHostsPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1" data-testid="for-hosts">
        <PageHero
          title={<>당신의 세계를,<br />사람들과 나누는 자리로.</>}
          description={<>전문가가 아니어도 괜찮아요. 입장료 없이 지원하고, 프로그램이 판매될 때만 함께 나눕니다. 소개와 첫 프로그램은 운영팀이 함께 다듬고, 모집과 결제, 운영은 {brand.name}이 맡습니다.</>}
        >
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/become-a-host/apply">
                호스트 지원하기
                <ArrowRight aria-hidden strokeWidth={1.8} />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-forest">
              <Link href="#policy">정책 먼저 보기</Link>
            </Button>
          </div>
        </PageHero>

        {/* 수익 원칙 */}
        <Section id="policy" className="scroll-mt-20" aria-labelledby="policy-title">
          <SectionTitle id="policy-title">함께 버는 구조</SectionTitle>
          <ol className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {PRINCIPLES.map((p, i) => (
              <li key={p.no}>
                <Card className="h-full">
                  <span className="flex size-8 items-center justify-center rounded-full bg-forest text-sm font-bold text-white">{i + 1}</span>
                  <h3 className="mt-4 text-lg font-bold">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                </Card>
              </li>
            ))}
          </ol>
          <Suspense fallback={<p className="mt-4 h-24 rounded-xl bg-notice" data-testid="commission-note" />}>
            <CommissionNote />
          </Suspense>
        </Section>

        {/* 라운디가 함께하는 일 */}
        <Section aria-labelledby="types-title">
          <SectionTitle id="types-title">라운디가 함께하는 일</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-3 sm:gap-4" data-testid="we-do">
            {WE_DO.map((t) => (
              <li key={t.name} className="rounded-2xl bg-linen/70 px-5 py-4">
                <span className="block font-display text-lg font-bold text-forest">{t.name}</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{t.body}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* 과정 */}
        <Section aria-labelledby="steps-title">
          <SectionTitle id="steps-title">지원부터 정산까지</SectionTitle>
          <ol className="grid gap-3 sm:grid-cols-5 sm:gap-4">
            {STEPS.map((s, i) => (
              <li key={s.no} className="flex gap-4 rounded-2xl border border-border/70 bg-card p-4 sm:flex-col sm:gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-forest/10 text-sm font-bold text-forest">{i + 1}</span>
                <span>
                  <span className="block font-bold">{s.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{s.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </Section>

        {/* 약속 */}
        <Section aria-labelledby="promises-title">
          <SectionTitle id="promises-title">함께 지키는 것</SectionTitle>
          <Card>
            <ul className="flex flex-col gap-3.5">
              {PROMISES.map((p) => (
                <li key={p} className="flex gap-3 text-[15px] leading-relaxed">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest">
                    <Check aria-hidden className="size-3.5" strokeWidth={2.2} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </Card>
        </Section>

        {/* 로드맵 */}
        <Section aria-labelledby="roadmap-title" data-testid="roadmap">
          <SectionTitle id="roadmap-title" description="아래 계획은 준비 중이며, 순서와 내용은 호스트·참가자와 함께 운영하며 바뀔 수 있습니다.">
            앞으로의 계획
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {ROADMAP.map((r) => (
              <div
                key={r.phase}
                className={r.status === "now" ? "rounded-2xl bg-forest p-5 text-cream" : "rounded-2xl border border-border/70 bg-card p-5"}
              >
                <p className={r.status === "now" ? "pill bg-white/15 text-cream" : "pill bg-linen text-muted-foreground"}>
                  {r.status === "now" ? "지금" : r.status === "next" ? "다음" : "나중에"}
                </p>
                <h3 className="mt-3 text-lg font-bold">{r.title}</h3>
                <ul className={`mt-3 flex flex-col gap-1.5 text-sm ${r.status === "now" ? "text-cream/85" : "text-muted-foreground"}`}>
                  {r.items.map((it) => (
                    <li key={it} className="flex gap-2">
                      <span aria-hidden>·</span>
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Section>
          <div className="flex flex-col items-start gap-5 rounded-3xl bg-linen/70 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <p className="max-w-xl font-display text-xl leading-snug font-bold break-keep text-forest sm:text-2xl">
              당신만의 이야기가 있다면, 먼저 들려주세요.
            </p>
            <Button asChild size="lg">
              <Link href="/become-a-host/apply">호스트 지원하기</Link>
            </Button>
          </div>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
