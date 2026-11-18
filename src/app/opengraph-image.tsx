import { ogCard, OG_SIZE } from "@/lib/og/card";

export const alt = "당신만의 세계가 누군가에게는 새로운 세계가 됩니다.";
export const size = OG_SIZE;
export const contentType = "image/png";

/** 사이트 기본 공유 카드 */
export default async function Image() {
  return ogCard({
    kicker: "4~10명의 작은 자리",
    title: "당신만의 세계가 누군가에게는 새로운 세계가 됩니다.",
    byline: "자기만의 작업과 관점을 가진 크리에이터를 만나요",
    photo: "/images/home/hero.jpg",
    photoPosition: "50% 50%",
  });
}
