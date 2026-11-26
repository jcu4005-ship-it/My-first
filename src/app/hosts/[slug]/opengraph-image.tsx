import { pillarInfo } from "@/config/pillars";
import { ogCard, OG_SIZE } from "@/lib/og/card";
import { creatorPhoto } from "@/lib/hosting/avatar";
import { getHost } from "@/lib/meetups/queries";

export const alt = "크리에이터 소개";
export const size = OG_SIZE;
export const contentType = "image/png";

/** 크리에이터 공유 카드: 얼굴 · 이름 · 직업 · 작업 철학(있을 때만, 지어내지 않음) */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const h = /^[a-z0-9-]{1,80}$/i.test(slug) ? await getHost(slug).catch(() => null) : null;
  if (!h) {
    return ogCard({ kicker: "크리에이터", title: "자기만의 세계를 가진 사람들" });
  }
  const quote = h.philosophy?.trim();
  return ogCard({
    kicker: ["크리에이터", pillarInfo(h.primary_pillar)?.ko].filter(Boolean).join(" · "),
    title: h.display_name,
    byline: h.occupation || h.headline || null,
    meta: quote ? `“${quote.length > 46 ? `${quote.slice(0, 45)}…` : quote}”` : null,
    photo: creatorPhoto(h),
    photoPosition: "50% 15%",
  });
}
