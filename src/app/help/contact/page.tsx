import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { requireMember } from "@/lib/auth/guards";
import { listMyBookings } from "@/lib/bookings/queries";
import { formatShortDateTime } from "@/lib/format";
import { isSupportCategory } from "@/lib/support/types";

import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "1:1 문의" };
export const instant = false;

export default async function ContactPage({ searchParams }: PageProps<"/help/contact">) {
  await requireMember("/help/contact");
  const sp = (await searchParams) as { category?: string };
  const bookings = (await listMyBookings())
    .slice(0, 20)
    .map((b) => ({ id: b.booking_id, label: `${formatShortDateTime(b.starts_at)} · ${b.title}` }));
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8 sm:px-6">
        <Link href="/help" className="text-sm text-muted-foreground hover:text-foreground">← 고객센터</Link>
        <h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl">1:1 문의</h1>
        <p className="mt-2 text-sm text-muted-foreground">운영팀이 확인한 뒤 답변하고, 답변이 오면 알림으로 알려 드려요.</p>
        <div className="mt-6 rounded-[20px] bg-card p-5 shadow-[0_2px_0_rgb(35_51_42/0.08),0_14px_24px_-14px_rgb(35_51_42/0.4)] sm:p-6">
          <ContactForm bookings={bookings} defaultCategory={isSupportCategory(sp.category) ? sp.category : undefined} />
        </div>
      </main>
    </>
  );
}
