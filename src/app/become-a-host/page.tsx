import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { brand } from "@/config/brand";
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
 * - 확정된 정책: 입장료 없음, 첫 1년 수수료 0(대신 호스트 동의 시 최대 10% 참가자 쿠폰, 호스트 부담), 이후 판매 시 수수료, 경력 심사, 신청·결제는 플랫폼에서
 * - 숫자(수수료율 등)는 정식 오픈 전 확정 → 화면에 확정된 것처럼 쓰지 않는다
 * - 앞으로의 계획은 "준비 중"으로 표시
 */

const PRINCIPLES = [
  { no: "01", title: "입장료는 없습니다", body: "호스트가 되는 데 드는 비용은 없습니다. 돈을 낸다고 호스트가 되지도 않습니다. 심사로만 함께합니다." },
  { no: "02", title: "프로그램이 판매될 때만", body: "정식 오픈 후 첫 1년은 수수료가 없습니다. 참가비는 호스트가 그대로 받습니다. 그 뒤에도 프로그램이 판매되었을 때만 수수료가 생깁니다." },
  { no: "03", title: "직접 데려온 손님은 덜", body: "호스트 전용 추천 링크로 들어온 신청과 다시 찾아온 단골의 재수강에는 더 낮은 수수료를 적용할 예정입니다." },
];

const STEPS = [
  { no: "01", title: "지원", body: "경력, 자격·수상, 포트폴리오, 가르쳐 본 경험을 보내 주세요." },
  { no: "02", title: "심사", body: "운영팀이 경력과 포트폴리오를 확인합니다. 반려되면 사유를 알려 드리고, 보완해 다시 지원할 수 있습니다." },
  { no: "03", title: "프로그램 만들기", body: "난이도와 '수업이 끝나면 할 수 있는 것'을 담아 프로그램을 만들고 일정을 추가합니다." },
  { no: "04", title: "검수·공개", body: `운영팀 검수를 거쳐 공개됩니다. 신청·결제·취소·환불은 모두 ${brand.name}이 처리합니다.` },
  { no: "05", title: "정산", body: "프로그램이 끝나고 7일이 지나 분쟁이 없으면 정산 대상이 됩니다. 월 2회, 운영팀이 직접 확인해 지급합니다." },
];

const PROMISES = [
  `모든 신청과 결제는 ${brand.name} 프로그램 페이지에서 받습니다. 플랫폼 밖 거래는 받지 않습니다.`,
  "참가자의 연락처와 개인정보는 공개되지 않습니다. 상세 주소는 참가 확정 후 참가자에게만 안내됩니다.",
  "프로그램에 적은 '수업이 끝나면 할 수 있는 것'은 참가자와의 약속입니다.",
  "수익을 나누는 관계에서 프로그램을 홍보할 때는 '광고' 또는 '유료 협찬' 표시를 해 주세요.",
  "호스트 사정으로 일정이 취소되면 참가자에게는 전액 환불됩니다.",
];

const HOST_TYPES = [
  { name: "Expert", body: "경력 심사를 통과한 현업 전문가" },
  { name: "Creator", body: "자신의 콘텐츠와 관점을 가진 크리에이터" },
  { name: "Community Host", body: `${brand.name}에서 배우고 성장해 가르치는 사람이 된 호스트 (준비 중)` },
];

const ROADMAP: { phase: string; title: string; items: string[]; status: "now" | "next" | "later" }[] = [
  { phase: "Now", title: "첫 호스트와 함께", status: "now", items: ["호스트 지원·심사", "프로그램 만들기·검수·공개", "신청·취소·환불 관리", "참가자 확인과 알림"] },
  { phase: "Next", title: "정식 오픈 준비", status: "next", items: ["실제 결제와 수수료 정산", "출석 체크와 참석자 후기", "호스트 전용 추천 링크", "호스트 유형 배지"] },
  { phase: "Later", title: "함께 넓혀 갈 것", status: "later", items: ["멤버십과 멤버 우선 좌석", `${brand.name} Originals`, "참가자에서 호스트로 성장하는 과정", "프로그램 기획 지원 서비스", "문화·예술 분야로 확장"] },
];

export default function ForHostsPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1" data-testid="for-hosts">
        <PageHero
          title={<>당신의 전문성을,<br />누군가의 성장으로.</>}
          description={<>입장료 없이 시작하고, 프로그램이 판매될 때만 함께 나눕니다. 모집과 결제, 운영은 {brand.name}이 맡습니다.</>}
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
          <ol className="grid gap-3 sm:grid-cols-3 sm:gap-4">
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
          <p className="mt-4 rounded-xl bg-notice px-4 py-3 text-sm leading-relaxed text-notice-foreground" data-testid="commission-note">
            수수료가 없는 첫 1년 동안, 호스트가 프로그램마다 동의하면 {brand.name} 참가자 할인 쿠폰(최대 10%, 호스트 부담)을 쓸 수 있습니다. 1년 이후의 수수료율과 정산 조건은 정식 오픈 전에 확정해 호스트 계약에 명시합니다. 지금은 테스트 결제만 운영 중이며 실제 청구는 없습니다.
          </p>
        </Section>

        {/* 호스트 유형 */}
        <Section aria-labelledby="types-title">
          <SectionTitle id="types-title">이런 분들이 가르칩니다</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {HOST_TYPES.map((t) => (
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
              가르칠 수 있는 무언가가 있다면, 그 이야기를 들려주세요.
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
