import "server-only";

import { listCategories } from "@/lib/meetups/queries";

/** 분야 이름 (못 읽으면 빈 값) */
export async function categoryNameOf(slug: string): Promise<string | null> {
  const list = await listCategories().catch(() => []);
  return list.find((c) => c.slug === slug)?.name ?? null;
}
