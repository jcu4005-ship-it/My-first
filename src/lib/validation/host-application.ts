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
  displayName: t(30, "활동 이름"),
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
  passion: t(1000, "시간 가는 줄 모르고 하는 일"),
  oftenAsked: t(1000, "주변에서 자주 묻거나 부탁하는 것"),
  programProposal: t(3000, "만들고 싶은 모임"),
  valueToParticipants: t(1000, "참가자에게 줄 가치"),
  preferredFormat: t(500, "희망 운영 방식"),
  consent: z.enum(["on", ""]).default(""),
  /** 호스트는 만 19세 이상 (2026-11-27 대표 결정). 임시 저장은 허용, 제출할 때 필수. DB에는 저장하지 않음 */
  age19: z.enum(["on", ""]).default(""),
});

/** 제출: 필수 항목까지 확인 (DB 함수도 같은 규칙으로 다시 확인) */
export const applicationSubmitSchema = applicationDraftSchema.superRefine((v, ctx) => {
  const need = (ok: boolean, path: string, message: string) => { if (!ok) ctx.addIssue({ code: "custom", path: [path], message }); };
  need(v.displayName.length >= 2, "displayName", "활동 이름을 2자 이상 입력해 주세요.");
  need(v.contactPhone !== "", "contactPhone", "연락받을 휴대폰 번호를 입력해 주세요.");
  need(v.passion.length >= 10, "passion", "시간 가는 줄 모르고 하는 일을 10자 이상 적어 주세요.");
  need(v.oftenAsked.length >= 10, "oftenAsked", "주변 사람들이 자주 묻거나 부탁하는 것을 10자 이상 적어 주세요.");
  need(v.programProposal.length >= 20, "programProposal", "만들고 싶은 모임을 20자 이상 적어 주세요.");
  need(v.age19 === "on", "age19", "호스트는 만 19세 이상만 지원할 수 있어요.");
  need(v.consent === "on", "consent", "개인정보·제출 자료 이용에 동의해 주세요.");
});

export const APPLICATION_KEYS = [
  "displayName", "contactPhone", "pillar", "fields", "headline", "bio", "career", "credentials", "portfolioUrl",
  "teachingExperience", "instagram", "passion", "oftenAsked", "programProposal", "valueToParticipants", "preferredFormat", "age19", "consent",
] as const;
