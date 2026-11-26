import { LEGAL_DOCUMENTS, type LegalDocumentKey } from "@/config/legal";

/** 약관·정책 문서 공통 틀 (잡지식 섹션) */
export function LegalSection({ no, title, children, id }: { no: number; title: string; children: React.ReactNode; id?: string }) {
  return (
    <section className="mt-10 scroll-mt-20" id={id}>
      <h2 className="flex items-baseline gap-3 border-t-2 border-foreground pt-3 text-[19px] font-bold tracking-[-0.01em]">
        <span className="text-[13px] font-bold text-brand tabular-nums">{String(no).padStart(2, "0")}</span>
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-2.5 text-[15px] leading-relaxed break-keep text-foreground/85">{children}</div>
    </section>
  );
}

/** 문서 맨 위 안내: 초안 · 법률 검토 전 */
export function DraftNote({ testId }: { testId: string }) {
  return (
    <p className="mt-4 bg-notice px-4 py-3 text-sm leading-relaxed text-notice-foreground" data-testid={testId}>
      <b>초안 · 법률 검토 전</b>이에요. 정식 오픈 전에 전문가 검토를 거쳐 확정하고, 바뀌면 시행일 전에 미리 알려 드려요. 지금은 테스트 결제만 운영 중이며 실제 청구는 없어요.
    </p>
  );
}

/**
 * 법률 검토가 필요한 문구 옆에 붙이는 표시.
 * 문서가 확정(isDraft=false)되면 자동으로 사라집니다. 어떤 점을 확인해야 하는지 reason 에 적습니다.
 */
export function ReviewNote({ doc, children }: { doc: LegalDocumentKey; children: React.ReactNode }) {
  if (!LEGAL_DOCUMENTS[doc].isDraft) return null;
  return (
    <p className="border-l-2 border-[#9a3a14] bg-[#f6e7d9]/60 px-3 py-2 text-[13px] leading-relaxed text-[#7a2e10]" data-testid="review-note">
      <b>법률 검토 필요</b> · {children}
    </p>
  );
}

const formatDay = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${y}년 ${Number(m)}월 ${Number(day)}일`;
};

/** 버전 · 개정일 · 시행일 · 개정 이력 (확정 전 날짜는 임의로 적지 않고 "확정 후 표시") */
export function LegalMeta({ doc }: { doc: LegalDocumentKey }) {
  const d = LEGAL_DOCUMENTS[doc];
  const history: readonly { version: string; revisedAt: string; effectiveAt: string; summary: string }[] = d.history;
  return (
    <div className="mt-5 text-sm" data-testid="legal-meta">
      <dl className="grid grid-cols-[5.5rem_1fr] gap-x-4 gap-y-1.5 sm:grid-cols-[5.5rem_1fr_5.5rem_1fr]">
        <dt className="text-muted-foreground">개정일</dt>
        <dd data-testid="legal-revised">{d.revisedAt ? formatDay(d.revisedAt) : <span className="text-muted-foreground">확정 후 표시</span>}</dd>
        <dt className="text-muted-foreground">시행일</dt>
        <dd data-testid="legal-effective">{d.effectiveAt ? formatDay(d.effectiveAt) : <span className="text-muted-foreground">확정 후 표시</span>}</dd>
        <dt className="text-muted-foreground">버전</dt>
        <dd className="font-mono text-[13px]">{d.version}</dd>
      </dl>
      {history.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[13px] font-semibold">이전 버전 보기 ({history.length})</summary>
          <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-muted-foreground" data-testid="legal-history">
            {history.map((h) => (
              <li key={h.version}>
                {h.version} · 개정 {formatDay(h.revisedAt)} · 시행 {formatDay(h.effectiveAt)} — {h.summary}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
