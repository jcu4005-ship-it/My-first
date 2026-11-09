import { z } from "zod";

const t = (max: number, label: string) => z.string().trim().max(max, `${label}은(는) ${max}자 이내로 입력해 주세요.`);
const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s/g, ""))
  .refine((v) => v === "" || /^01[016789]-?\d{3,4}-?\d{4}$/.test(v), "휴대폰 번호 형식을 확인해 주세요. (예: 010-1234-5678)");
const url = z
  .string()
  .trim()
  .max(300, "링크는 300자 이내로 입력해 주세요.")
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), "https:// 로 시작하는 링크를 입력해 주세요.");
const insta = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@/, ""))
  .refine((v) => v === "" || /^[A-Za-z0-9._]{1,30}$/.test(v), "인스타그램 아이디 형식을 확인해 주세요.");

/** 임시 저장: 길이·형식만 확인 (빈 칸 허용) */
export const applicationDraftSchema = z.object({
  displayName: t(30, "호스트 이름"),
  contactPhone: phone,
  pillar: z.enum(["knowledge", "creators", "experts", ""]).default(""),
  fields: z.string().transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8)),
  headline: t(60, "한 줄 소개"),
  bio: t(2000, "자기소개"),
  career: t(1000, "경력"),
  credentials: t(500, "자격·수상"),
  portfolioUrl: url,
  teachingExperience: t(500, "가르친 경험"),
  instagram: insta,
  programProposal: t(3000, "프로그램 기획안"),
  valueToParticipants: t(1000, "참가자에게 줄 가치"),
  preferredFormat: t(500, "희망 운영 방식"),
  consent: z.enum(["on", ""]).default(""),
});

/** 제출: 필수 항목까지 확인 (DB 함수도 같은 규칙으로 다시 확인) */
export const applicationSubmitSchema = applicationDraftSchema.superRefine((v, ctx) => {
  const need = (ok: boolean, path: string, message: string) => { if (!ok) ctx.addIssue({ code: "custom", path: [path], message }); };
  need(v.displayName.length >= 2, "displayName", "호스트 이름을 2자 이상 입력해 주세요.");
  need(v.contactPhone !== "", "contactPhone", "연락받을 휴대폰 번호를 입력해 주세요.");
  need(v.pillar !== "", "pillar", "지원 분류를 선택해 주세요.");
  need(v.headline.length >= 5, "headline", "한 줄 소개를 5자 이상 입력해 주세요.");
  need(v.bio.length >= 20, "bio", "자기소개를 20자 이상 입력해 주세요.");
  need(v.career.length >= 20, "career", "가르칠 분야의 경력을 20자 이상 적어 주세요.");
  need(v.programProposal.length >= 30, "programProposal", "프로그램 기획안을 30자 이상 적어 주세요.");
  need(v.valueToParticipants.length >= 10, "valueToParticipants", "참가자에게 줄 가치를 10자 이상 적어 주세요.");
  need(v.consent === "on", "consent", "개인정보·제출 자료 이용에 동의해 주세요.");
});

export const APPLICATION_KEYS = [
  "displayName", "contactPhone", "pillar", "fields", "headline", "bio", "career", "credentials", "portfolioUrl",
  "teachingExperience", "instagram", "programProposal", "valueToParticipants", "preferredFormat", "consent",
] as const;
