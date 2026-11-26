import { z } from "zod";

import { CREATOR_FIELDS } from "@/lib/creators/constants";

const text = (min: number, max: number, requiredMsg: string) =>
  z.string().trim().min(min, requiredMsg).max(max, `${max}자 이내로 적어 주세요.`);

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => /^01[016789]\d{7,8}$/.test(v), "휴대폰 번호 형식을 확인해 주세요. (예: 010-1234-5678)");

const optionalUrl = z
  .string()
  .trim()
  .max(300, "링크는 300자 이내로 입력해 주세요.")
  .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "https:// 로 시작하는 링크를 입력해 주세요.");

/** 크리에이터 지원: 필수 5개(+연락처·동의), 선택 2개. 짧게 받는 것이 목적이라 최소 길이는 5자 */
export const creatorApplicationSchema = z.object({
  name: text(2, 30, "이름 또는 활동명을 2자 이상 입력해 주세요."),
  field: z.enum(CREATOR_FIELDS.map((f) => f.value) as [string, ...string[]], "관심 분야를 선택해 주세요."),
  strength: text(5, 1000, "잘하거나 자신 있는 것을 5자 이상 적어 주세요."),
  experience: text(5, 1000, "관련 경험을 5자 이상 적어 주세요."),
  motivation: text(5, 1000, "함께하고 싶은 이유를 5자 이상 적어 주세요."),
  phone,
  link: optionalUrl,
  wish: z.string().trim().max(1000, "1000자 이내로 적어 주세요."),
  consent: z.literal("on", "개인정보 수집·이용에 동의해 주세요."),
});

export const CREATOR_APPLICATION_KEYS = ["name", "field", "strength", "experience", "motivation", "phone", "link", "wish", "consent"] as const;
