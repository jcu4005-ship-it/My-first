import type { Metadata } from "next";
import Link from "next/link";

import { brand } from "@/config/brand";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
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
        <section className="section-dark">
          <div className="mx-auto w-full max-w-7xl px-4 pt-16 pb-14 sm:px-8 sm:pt-24 sm:pb-20">
            <p className="eyebrow text-muted-foreground">For Hosts</p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight font-medium break-keep sm:text-6xl">
              당신의 전문성을, 누군가의 성장으로.
            </h1>
            <p className="mt-6 max-w-xl leading-relaxed text-sand">
              입장료 없이 시작하고, 프로그램이 판매될 때만 함께 나눕니다. 모집과 결제, 운영은 {brand.name}이 맡습니다.
            </p>
            <div className="mt-10 grid grid-cols-1 gap-3 sm:flex">
              <Button asChild size="lg" variant="secondary">
                <Link href="/become-a-host/apply">호스트 지원하기</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#policy">정책 먼저 보기</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* 수익 원칙 */}
        <section id="policy" className="mx-auto w-full max-w-7xl scroll-mt-8 px-4 pt-20 sm:px-8 sm:pt-28" aria-labelledby="policy-title">
          <p className="eyebrow text-muted-foreground">Host Policy</p>
          <h2 id="policy-title" className="mt-3 font-display text-3xl font-medium sm:text-5xl">함께 버는 구조</h2>
          <ol className="mt-10 grid gap-px bg-border sm:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <li key={p.no} className="bg-background py-6 pr-6 sm:p-8 sm:first:pl-0">
                <span className="eyebrow text-terracotta-deep">{p.no}</span>
                <h3 className="mt-3 font-display text-xl font-medium">{p.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="commission-note">
            수수료가 없는 첫 1년 동안, 호스트가 프로그램마다 동의하면 {brand.name} 참가자 할인 쿠폰(최대 10%, 호스트 부담)을 쓸 수 있습니다. 1년 이후의 수수료율과 정산 조건은 정식 오픈 전에 확정해 호스트 계약에 명시합니다. 지금은 테스트 결제만 운영 중이며 실제 청구는 없습니다.
          </p>
        </section>

        {/* 호스트 유형 */}
        <section className="mx-auto w-full max-w-7xl px-4 pt-20 sm:px-8 sm:pt-28" aria-labelledby="types-title">
          <p className="eyebrow text-muted-foreground">Who hosts</p>
          <h2 id="types-title" className="mt-3 font-display text-3xl font-medium sm:text-5xl">이런 분들이 가르칩니다</h2>
          <ul className="mt-10 flex flex-col">
            {HOST_TYPES.map((t) => (
              <li key={t.name} className="grid grid-cols-1 gap-1 border-t py-5 sm:grid-cols-[14rem_1fr] sm:gap-6">
                <span className="font-display text-xl">{t.name}</span>
                <span className="text-sm leading-relaxed text-muted-foreground sm:pt-1">{t.body}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 과정 */}
        <section className="mt-20 bg-sand sm:mt-28" aria-labelledby="steps-title">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-8 sm:py-24">
            <p className="eyebrow text-muted-foreground">How it works</p>
            <h2 id="steps-title" className="mt-3 font-display text-3xl font-medium sm:text-5xl">지원부터 정산까지</h2>
            <ol className="mt-10 flex flex-col">
              {STEPS.map((s) => (
                <li key={s.no} className="grid grid-cols-[3rem_1fr] gap-2 border-t border-espresso/15 py-5">
                  <span className="eyebrow pt-1 text-muted-foreground">{s.no}</span>
                  <span>
                    <span className="block font-medium">{s.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 약속 */}
        <section className="mx-auto w-full max-w-7xl px-4 pt-20 sm:px-8 sm:pt-28" aria-labelledby="promises-title">
          <p className="eyebrow text-muted-foreground">Our Promises</p>
          <h2 id="promises-title" className="mt-3 font-display text-3xl font-medium sm:text-5xl">함께 지키는 것</h2>
          <ul className="mt-10 flex flex-col">
            {PROMISES.map((p) => (
              <li key={p} className="border-t py-5 leading-relaxed">
                {p}
              </li>
            ))}
          </ul>
        </section>

        {/* 로드맵 */}
        <section className="section-dark mt-20 sm:mt-28" aria-labelledby="roadmap-title" data-testid="roadmap">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-8 sm:py-24">
            <p className="eyebrow text-muted-foreground">Roadmap</p>
            <h2 id="roadmap-title" className="mt-3 font-display text-3xl font-medium sm:text-5xl">앞으로의 계획</h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
              아래 계획은 준비 중이며, 순서와 내용은 호스트·참가자와 함께 운영하며 바뀔 수 있습니다.
            </p>
            <div className="relative -mx-4 mt-10 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0">
              {ROADMAP.map((r) => (
                <div key={r.phase} className="w-[78vw] max-w-[20rem] shrink-0 snap-start border-t border-sand-light/30 pt-6 sm:w-auto sm:max-w-none">
                  <p className="eyebrow text-muted-foreground">
                    {r.phase}
                    {r.status === "now" && <span className="ml-2 text-sand-light">· 지금</span>}
                  </p>
                  <h3 className="mt-3 font-display text-2xl">{r.title}</h3>
                  <ul className="mt-5 flex flex-col gap-2 text-sm text-sand">
                    {r.items.map((it) => (
                      <li key={it} className="flex gap-2">
                        <span aria-hidden className="text-muted-foreground">—</span>
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 pt-20 sm:px-8 sm:pt-28">
          <div className="flex flex-col items-start gap-6 border-t border-espresso pt-10 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl font-display text-2xl leading-snug break-keep sm:text-3xl">가르칠 수 있는 무언가가 있다면, 그 이야기를 들려주세요.</p>
            <Button asChild size="lg">
              <Link href="/become-a-host/apply">호스트 지원하기</Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
