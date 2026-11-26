import { BUSINESS_INFO, businessInfoRows, missingBusinessInfo } from "@/config/business";
import { cn } from "@/lib/utils";

/**
 * 사업자 정보 표 (바닥글·약관·결제 화면 공통).
 * 값은 src/config/business.ts 에서만 읽습니다. 비어 있는 항목은 "입력 필요"로 표시해 빠뜨리지 않게 합니다.
 */
export function BusinessInfoBlock({ compact = false, className, testId = "business-info" }: { compact?: boolean; className?: string; testId?: string }) {
  const rows = businessInfoRows(BUSINESS_INFO);
  const missing = missingBusinessInfo(BUSINESS_INFO);
  return (
    <div className={className} data-testid={testId} data-complete={missing.length === 0 ? "true" : "false"}>
      <dl className={cn("grid gap-x-6 gap-y-1.5 text-[13px] leading-relaxed", compact ? "sm:grid-cols-2" : "sm:grid-cols-[9rem_1fr] sm:gap-y-2 sm:text-sm")}>
        {rows.map((r) => (
          <div key={r.key} className={cn(compact ? "flex flex-wrap gap-x-2" : "contents")}>
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className={cn(!r.value && "text-muted-foreground/70 italic")} data-placeholder={r.value ? undefined : "true"}>
              {r.value ?? `[${r.placeholder}]`}
            </dd>
          </div>
        ))}
      </dl>
      {missing.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground" data-testid={`${testId}-pending`}>
          대괄호 항목은 사업자등록 후 입력하는 자리예요. 정식 오픈 전에 모두 채웁니다.
        </p>
      )}
    </div>
  );
}
