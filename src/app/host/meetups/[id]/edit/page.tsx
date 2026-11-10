import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { requireRole } from "@/lib/auth/guards";
import { getMyMeetup } from "@/lib/hosting/queries";
import { listCategories } from "@/lib/meetups/queries";
import { agendaToText } from "@/lib/validation/meetup";

import { MeetupForm } from "../../meetup-form";

export const metadata: Metadata = { title: "프로그램 수정" };
export const instant = false;

export default async function EditMeetupPage({ params }: PageProps<"/host/meetups/[id]/edit">) {
  const { id } = await params;
  const member = await requireRole("host", `/host/meetups/${id}/edit`);
  const [meetup, categories] = await Promise.all([getMyMeetup(member.id, id), listCategories()]);
  if (!meetup || ["archived", "suspended"].includes(meetup.status)) notFound();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="font-display text-3xl font-bold">프로그램 수정</h1>
        {meetup.status === "published" && (
          <p className="mt-3 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground">
            공개 중인 프로그램이에요. 저장하면 바로 반영됩니다. 신청자가 있으면 참가비는 바꿀 수 없어요.
          </p>
        )}
        <div className="mt-8">
          <MeetupForm
            meetupId={meetup.id}
            categories={categories}
            defaults={{
              title: meetup.title,
              categorySlug: meetup.category_slug,
              meetupType: meetup.meetup_type === "alcohol" ? "general" : meetup.meetup_type,
              summary: meetup.summary,
              description: meetup.description,
              price: String(meetup.price),
              maxQuantity: String(meetup.max_quantity_per_booking),
              agenda: agendaToText(Array.isArray(meetup.agenda) ? meetup.agenda : []),
              targetAudience: meetup.target_audience,
              whatToBring: meetup.what_to_bring,
              requirements: meetup.requirements,
              refundPolicyText: meetup.refund_policy_text,
              level: meetup.level,
              learningOutcomes: meetup.learning_outcomes,
              materialsNote: meetup.materials_note,
              priceRationale: meetup.price_rationale,
            }}
          />
        </div>
      </main>
    </>
  );
}
