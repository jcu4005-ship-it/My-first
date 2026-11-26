import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind 프로그램 병합 (shadcn/ui 표준 유틸) */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
