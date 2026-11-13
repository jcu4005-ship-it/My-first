import { formatShortDateTime } from "@/lib/format";
import type { SupportMessage } from "@/lib/support/queries";
import { cn } from "@/lib/utils";

/** 문의 대화: 회원 말은 흰 카드, 운영팀 답변은 딥 그린 */
export function SupportThread({ messages, viewer }: { messages: SupportMessage[]; viewer: "member" | "staff" }) {
  return (
    <ol className="flex flex-col gap-3" data-testid="support-thread">
      {messages.map((m) => {
        const mine = viewer === "member" ? !m.from_staff : m.from_staff;
        return (
          <li key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")} data-testid="support-message" data-from={m.from_staff ? "staff" : "member"}>
            <span className="mb-1 px-1 text-[11px] text-muted-foreground">
              {m.from_staff ? "운영팀" : viewer === "member" ? "나" : "회원"} · {formatShortDateTime(m.created_at)}
            </span>
            <p
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line",
                m.from_staff ? "bg-forest text-white" : "bg-card shadow-[0_8px_18px_-14px_rgb(80_55_25/0.5)]",
              )}
            >
              {m.body}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
