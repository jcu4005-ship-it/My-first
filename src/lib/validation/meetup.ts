import { z } from "zod";

const text = (max: number, label: string) =>
  z.string().trim().max(max, `${label}은(는) ${max}자 이내로 입력해 주세요.`);

export const MEETUP_TYPES = [
  { value: "class", label: "실습형 (실내)" },
  { value: "outdoor", label: "현장형 (출사·야외 수업)" },
  { value: "general", label: "강의·토크형" },
] as const;

export const CLASS_LEVELS = [
  { value: "beginner", label: "입문" },
  { value: "intermediate", label: "중급" },
  { value: "advanced", label: "고급" },
  { value: "all", label: "누구나" },
] as const;
export type ClassLevel = (typeof CLASS_LEVELS)[number]["value"];
export const CLASS_LEVEL_LABEL: Record<ClassLevel, string> = Object.fromEntries(
  CLASS_LEVELS.map((l) => [l.value, l.label]),
) as Record<ClassLevel, string>;

export const hostApplicationSchema = z.object({
  displayName: z.string().trim().min(2, "호스트 이름은 2자 이상이에요.").max(30, "호스트 이름은 30자 이내로 입력해 주세요."),
  headline: text(60, "한 줄 소개").min(5, "한 줄 소개를 5자 이상 입력해 주세요."),
  bio: text(2000, "소개").min(20, "어떤 프로그램을 열고 싶은지 20자 이상 소개해 주세요."),
  career: text(1000, "경력").min(20, "가르칠 분야의 경력을 20자 이상 적어 주세요."),
  credentials: text(500, "자격·수상"),
  portfolioUrl: z
    .string()
    .trim()
    .max(300, "링크는 300자 이내로 입력해 주세요.")
    .refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), "https:// 로 시작하는 링크를 입력해 주세요."),
  teachingExperience: text(500, "수업 경험"),
  expertise: z
    .string()
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8)),
  instagram: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@/, ""))
    .refine((v) => v === "" || /^[A-Za-z0-9._]{1,30}$/.test(v), "인스타그램 아이디 형식을 확인해 주세요."),
});

/** 승인된 호스트의 공개 프로필 수정 (지원서 항목 + 직업·작업 철학·사진) */
export const hostProfileSchema = hostApplicationSchema.extend({
  occupation: text(60, "직업·전문 분야").min(2, "직업이나 전문 분야를 한 줄로 적어 주세요."),
  philosophy: text(1000, "작업 철학"),
  avatarPath: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,80}$/.test(v), "사진 정보가 올바르지 않아요. 다시 올려 주세요."),
});

/** "14:00 인사와 소개" 형식의 줄을 진행 순서로 변환 */
export function parseAgenda(raw: string): { time: string; title: string }[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((line) => {
      const m = line.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
      return m ? { time: m[1], title: m[2].slice(0, 80) } : { time: "", title: line.slice(0, 80) };
    });
}

export function agendaToText(agenda: { time: string; title: string }[]): string {
  return agenda.map((a) => [a.time, a.title].filter(Boolean).join(" ")).join("\n");
}

export const meetupFormSchema = z.object({
  title: z.string().trim().min(5, "제목은 5자 이상이에요.").max(60, "제목은 60자 이내로 입력해 주세요."),
  categorySlug: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/, "카테고리를 선택해 주세요."),
  meetupType: z.enum(["general", "class", "outdoor"], "수업 방식을 선택해 주세요."),
  level: z.enum(["all", "beginner", "intermediate", "advanced"], "난이도를 선택해 주세요."),
  learningOutcomes: text(500, "수업 후 할 수 있는 것").min(10, "수업이 끝나면 무엇을 할 수 있게 되는지 10자 이상 적어 주세요."),
  materialsNote: text(300, "재료·도구 안내"),
  priceRationale: text(500, "가격 근거"),
  summary: z.string().trim().min(10, "한 줄 요약은 10자 이상이에요.").max(120, "한 줄 요약은 120자 이내로 입력해 주세요."),
  description: z.string().trim().min(20, "소개는 20자 이상 입력해 주세요.").max(5000, "소개는 5000자 이내로 입력해 주세요."),
  price: z
    .string()
    .transform((v) => v.replace(/[,\s원]/g, ""))
    .refine((v) => /^\d+$/.test(v), "참가비를 숫자로 입력해 주세요. 무료라면 0")
    .transform(Number)
    .refine((v) => v >= 0 && v <= 1_000_000, "참가비는 0원~1,000,000원 사이로 입력해 주세요."),
  maxQuantity: z.coerce.number().int().min(1).max(4, "1회 신청 인원은 최대 4명이에요."),
  targetAudience: text(500, "추천 대상"),
  requirements: text(500, "참여 조건"),
  whatToBring: text(500, "준비물"),
  agenda: z.string().max(3000).transform(parseAgenda),
  refundPolicyText: text(1000, "취소·환불 안내"),
});
export type MeetupFormInput = z.infer<typeof meetupFormSchema>;

const KST_OFFSET = "+09:00";

export const sessionFormSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 선택해 주세요."),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "시작 시간을 선택해 주세요."),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "끝나는 시간을 선택해 주세요."),
    area: z.string().trim().min(2, "동네를 입력해 주세요. (예: 성수동)").max(30),
    venueName: z.string().trim().min(2, "장소 이름을 입력해 주세요.").max(60),
    addressDetail: z.string().trim().max(200, "상세 주소는 200자 이내로 입력해 주세요."),
    capacity: z.coerce.number().int("정원을 숫자로 입력해 주세요.").min(1, "정원은 1명 이상이에요.").max(200, "정원은 200명 이하로 입력해 주세요."),
  })
  .transform((v) => ({
    ...v,
    startsAt: new Date(`${v.date}T${v.startTime}:00${KST_OFFSET}`).toISOString(),
    endsAt: new Date(`${v.date}T${v.endTime}:00${KST_OFFSET}`).toISOString(),
  }))
  .superRefine((v, ctx) => {
    if (new Date(v.endsAt) <= new Date(v.startsAt)) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "끝나는 시간은 시작 시간보다 늦어야 해요." });
    }
    if (new Date(v.startsAt).getTime() <= Date.now()) {
      ctx.addIssue({ code: "custom", path: ["date"], message: "앞으로의 날짜와 시간을 선택해 주세요." });
    }
  });
