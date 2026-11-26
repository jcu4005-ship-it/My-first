import { categoryNameOf } from "@/lib/og/labels";
import { ogCard, OG_SIZE } from "@/lib/og/card";
import { formatDate, formatPrice, formatTime } from "@/lib/format";
import { creatorPhoto } from "@/lib/hosting/avatar";
import { getMeetup } from "@/lib/meetups/queries";

export const alt = "프로그램 소개";
export const size = OG_SIZE;
export const contentType = "image/png";

/** 프로그램 공유 카드: 대표 사진(없으면 크리에이터 사진) · 제목 · 크리에이터 · 다음 일정 · 참가비 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = /^[0-9a-f-]{36}$/.test(id) ? await getMeetup(id).catch(() => null) : null;
  if (!m) {
    return ogCard({ kicker: "프로그램", title: "작은 자리에서 만나는 크리에이터의 세계" });
  }
  const next = m.nextSession;
  const category = await categoryNameOf(m.category_slug);
  return ogCard({
    kicker: ["프로그램", category].filter(Boolean).join(" · "),
    title: m.title,
    byline: m.host ? `with ${m.host.display_name}${m.host.occupation ? ` · ${m.host.occupation}` : ""}` : null,
    meta: [next ? `${formatDate(next.starts_at)} ${formatTime(next.starts_at)}` : null, next?.area, m.price > 0 ? formatPrice(m.price) : "무료"]
      .filter(Boolean)
      .join(" · "),
    photo: m.cover_image_url ?? (m.host ? creatorPhoto(m.host) : null),
  });
}
