import { z } from "zod";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const optionalId = z.string().trim().refine((v) => v === "" || UUID.test(v), "잘못된 값입니다.");

/** 콘텐츠 저장 (작성 중). 검토 요청·공개 때는 DB가 길이를 다시 확인 */
export const contentDraftSchema = z.object({
  contentId: optionalId,
  type: z.enum(["article", "interview", "portfolio"], { error: "종류를 선택해 주세요." }),
  title: z.string().trim().min(2, "제목을 2자 이상 입력해 주세요.").max(80, "제목은 80자 이하로 입력해 주세요."),
  summary: z.string().trim().max(200, "요약은 200자 이하로 입력해 주세요."),
  body: z.string().max(20000, "본문은 20,000자 이하로 입력해 주세요."),
  coverPath: z.string().trim().max(120),
  hostId: optionalId,
  relatedMeetupId: optionalId,
});

/** 검토 요청·공개 전 필수 항목 */
export const contentReadySchema = contentDraftSchema.superRefine((v, ctx) => {
  if (v.title.length < 5) ctx.addIssue({ code: "custom", path: ["title"], message: "제목을 5자 이상 입력해 주세요." });
  if (v.summary.length < 10) ctx.addIssue({ code: "custom", path: ["summary"], message: "요약을 10자 이상 입력해 주세요." });
  if (v.body.trim().length < 100) ctx.addIssue({ code: "custom", path: ["body"], message: "본문을 100자 이상 입력해 주세요." });
});

export const CONTENT_KEYS = ["contentId", "type", "title", "summary", "body", "coverPath", "hostId", "relatedMeetupId"] as const;
