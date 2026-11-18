/** 약관·정책 문서 공통 틀 (잡지식 섹션) */
export function LegalSection({ no, title, children }: { no: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="flex items-baseline gap-3 border-t-2 border-foreground pt-3 text-[19px] font-extrabold tracking-[-0.02em]">
        <span className="text-[13px] font-extrabold text-ember tabular-nums">{String(no).padStart(2, "0")}</span>
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-2.5 text-[15px] leading-relaxed text-foreground/85">{children}</div>
    </section>
  );
}

export function DraftNote({ testId }: { testId: string }) {
  return (
    <p className="mt-4 rounded-xl bg-notice px-4 py-3 text-sm leading-relaxed text-notice-foreground" data-testid={testId}>
      <b>초안 · 법률 검토 전</b>이에요. 정식 오픈 전에 전문가 검토를 거쳐 확정하고, 바뀌면 시행일 7일 전에 미리 알려 드려요. 지금은 테스트 결제만 운영 중이며 실제 청구는 없어요.
    </p>
  );
}
