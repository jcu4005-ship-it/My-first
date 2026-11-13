import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, LayoutDashboard, Mail, ShieldCheck, Sparkles, Ticket } from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";
import { BrandMark } from "@/components/brand/seat-table";
import { Photo } from "@/components/media/photo";
import { RecentlyViewedList } from "@/components/recently-viewed";
import { SiteHeader } from "@/components/site-header";
import { requireMember } from "@/lib/auth/guards";
import { listMyBookings } from "@/lib/bookings/queries";
import { formatPrice, formatShortDateTime, formatTime, isFuture, ticketDate } from "@/lib/format";
import { APPLICATION_STATUS_LABEL, getMyApplication } from "@/lib/hosting/applications";
import { hostAvatarUrl, hostHref } from "@/lib/hosting/avatar";
import { listMyFollowedHosts } from "@/lib/hosting/follows";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { PrivateForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "마이페이지" };

// 권한 확인이 끝나기 전에는 응답을 시작하지 않음 → 권한 없으면 HTTP 403
export const instant = false;

const ROLE_LABEL = { participant: "참가자", host: "호스트", admin: "관리자" } as const;
const sheet = "rounded-[20px] bg-card shadow-[0_2px_0_rgb(80_55_25/0.08),0_14px_24px_-14px_rgb(80_55_25/0.4)]";

function Heading({ children, href, linkLabel }: { children: React.ReactNode; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-2.5 flex items-end justify-between px-1">
      <h2 className="font-display text-[19px] font-bold">{children}</h2>
      {href && (
        <Link href={href} className="text-[13px] text-muted-foreground hover:text-foreground">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

async function MyPage({ member }: { member: Awaited<ReturnType<typeof requireMember>> }) {
  const supabase = await createSupabaseServerClient();
  const isHost = member.roles.includes("host");
  const [{ data: profile }, { data: priv }, followed, application, bookings, { count: unread }] = await Promise.all([
    supabase.from("profiles").select("nickname, bio, status, created_at").eq("id", member.id).single(),
    supabase.from("profile_private").select("phone, birth_year").eq("user_id", member.id).single(),
    listMyFollowedHosts(member.id),
    isHost ? Promise.resolve(null) : getMyApplication(member.id),
    listMyBookings(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", member.id).is("read_at", null),
  ]);
  const upcoming = bookings
    .filter((b) => (b.status === "confirmed" || b.status === "pending_payment") && isFuture(b.starts_at))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const joined = profile?.created_at ? new Date(profile.created_at) : null;

  const tiles = [
    { href: "/me/bookings", label: "내 초대장", sub: `${upcoming.length}장`, icon: Ticket },
    { href: "/me/notifications", label: "알림", sub: unread ? `새 알림 ${unread}` : "새 알림 없음", icon: Mail, dot: Boolean(unread) },
    isHost
      ? { href: "/host", label: "호스트 공간", sub: "프로그램 관리", icon: LayoutDashboard }
      : { href: "/become-a-host/apply", label: "호스트 되기", sub: application ? APPLICATION_STATUS_LABEL[application.status] : "지원서 쓰기", icon: Sparkles },
    ...(member.roles.includes("admin") ? [{ href: "/admin", label: "관리자", sub: "운영 화면", icon: ShieldCheck }] : []),
  ];

  return (
    <div className="flex flex-col gap-7">
      {/* 1. 내 카드 */}
      <section className={`flex items-center gap-3.5 p-4 sm:p-5 ${sheet}`}>
        <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full bg-forest font-display text-2xl text-cream">
          {profile?.nickname?.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-bold sm:text-2xl" data-testid="me-nickname">
            {profile?.nickname}
          </h1>
          <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
            {member.roles.map((r) => ROLE_LABEL[r]).join(" · ")}
            {joined && ` · 가입 ${joined.getFullYear()}.${joined.getMonth() + 1}`}
          </p>
        </div>
        <a href="#my-info" className="shrink-0 rounded-full border-[1.5px] border-[#d6cdbc] px-3 py-1.5 text-[12.5px] font-bold hover:border-forest/50">
          프로필 수정
        </a>
      </section>
      {member.status !== "active" && (
        <p className="-mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          이용이 제한된 계정입니다. 운영팀에 문의해 주세요.
        </p>
      )}

      {/* 2. 다가오는 초대장 */}
      <section data-testid="me-upcoming">
        <Heading href="/me/bookings" linkLabel="전체 보기">다가오는 초대장</Heading>
        {upcoming.length === 0 ? (
          <div className="rounded-[18px] border-[1.5px] border-dashed border-[#cfc6b5] bg-card/60 px-5 py-6 text-center text-sm text-muted-foreground">
            아직 받은 초대장이 없어요.
            <Link href="/meetups" className="mt-2 block font-semibold text-forest underline-offset-4 hover:underline">
              이번 주 테이블 둘러보기
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {upcoming.slice(0, 2).map((b) => {
              const d = ticketDate(b.starts_at);
              const confirmed = b.status === "confirmed";
              return (
                <li key={b.booking_id}>
                  <Link href={confirmed ? "/me/bookings" : `/checkout/${b.booking_id}`} className="ticket grid grid-cols-[78px_1fr] overflow-hidden">
                    <span className="flex flex-col items-center justify-center border-r-[1.5px] border-dashed border-[#cfc6b5] py-3.5 text-center">
                      <b className="font-display text-[28px] leading-none">{d.day}</b>
                      <span className="mt-1 text-[10.5px] tracking-[0.14em] text-muted-foreground">{d.wdEn}</span>
                      <span className="mt-1.5 text-xs font-bold">{d.time}</span>
                    </span>
                    <span className="min-w-0 px-3.5 py-3">
                      <span className={`pill ${confirmed ? "bg-forest text-white" : "bg-[#f6e7d9] text-clay"}`}>{confirmed ? "참가 확정" : "결제 대기"}</span>
                      <span className="mt-1.5 block truncate text-[14.5px] font-bold">{b.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {b.area} · {b.quantity}명
                        {!confirmed && ` · ${formatPrice(b.total_price)}${b.hold_expires_at ? ` · ${formatTime(b.hold_expires_at)}까지 결제` : ""}`}
                      </span>
                      {confirmed && b.address_detail && (
                        <span className="mt-2 block truncate rounded-lg bg-forest/5 px-2 py-1.5 text-xs text-forest">상세 주소 · {b.address_detail}</span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 3. 바로가기 */}
      <nav aria-label="바로가기" className={`grid gap-2 ${tiles.length > 3 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
        {tiles.map(({ href, label, sub, icon: Icon, ...rest }) => {
          const isApp = href === "/become-a-host/apply" && application;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col px-3 py-3.5 transition-transform hover:-translate-y-0.5 ${sheet}`}
              {...(isApp ? { "data-testid": "me-application", "data-status": application.status } : {})}
            >
              <Icon aria-hidden className="size-[22px] text-forest" strokeWidth={1.7} />
              <span className="mt-2 text-[13.5px] font-bold">
                {label}
                {"dot" in rest && rest.dot && <span aria-hidden className="ml-1 inline-block size-[7px] rounded-full bg-clay align-middle" />}
              </span>
              <span className="text-[11.5px] text-muted-foreground">{sub}</span>
            </Link>
          );
        })}
      </nav>

      {/* 4. 팔로우한 호스트 */}
      <section data-testid="me-following">
        <Heading>
          팔로우한 호스트 <span className="font-sans text-sm font-normal text-muted-foreground">{followed.length}명</span>
        </Heading>
        {followed.length === 0 ? (
          <div className="rounded-[18px] border-[1.5px] border-dashed border-[#cfc6b5] bg-card/60 px-5 py-6 text-sm text-muted-foreground">
            아직 팔로우한 호스트가 없어요. 마음에 드는 호스트를 팔로우하면 새 테이블을 여기서 바로 볼 수 있어요.
            <Link href="/hosts" className="mt-2 block font-semibold text-forest underline-offset-4 hover:underline">
              호스트 둘러보기
            </Link>
          </div>
        ) : (
          <ul className={`flex gap-2 overflow-x-auto p-3 no-scrollbar ${sheet}`}>
            {followed.map(({ host, next }) => {
              const avatar = hostAvatarUrl(host.avatar_path);
              return (
                <li key={host.user_id} className="flex w-[8.5rem] shrink-0 flex-col items-center px-1 text-center" data-testid="followed-host" data-name={host.display_name}>
                  <Link href={hostHref(host)} className="group flex flex-col items-center">
                    <span className="relative flex size-14 items-center justify-center rounded-full bg-forest font-display text-xl text-cream">
                      <span className="absolute inset-0 overflow-hidden rounded-full">
                        <Photo src={avatar} alt="" sizes="56px" fallback={<span aria-hidden className="absolute inset-0 flex items-center justify-center">{host.display_name.slice(0, 1)}</span>} />
                      </span>
                      {next && <span aria-hidden className="absolute -right-0.5 -bottom-0.5 size-4 rounded-full border-2 border-white bg-clay" />}
                    </span>
                    <span className="mt-1.5 line-clamp-1 text-xs font-semibold group-hover:underline">{host.display_name}</span>
                  </Link>
                  {next ? (
                    <Link href={`/meetups/${next.id}`} className="mt-0.5 text-[11px] leading-snug" data-testid="followed-next">
                      <span className="font-bold text-clay">모집 중</span>
                      <span className="block text-muted-foreground">{formatShortDateTime(next.nextSession.starts_at)}</span>
                    </Link>
                  ) : (
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">지금 모집 중인 프로그램이 없어요</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 5. 최근 본 것 (이 기기에만 저장) */}
      <RecentlyViewedList />

      {/* 6. 내 정보 (눌러서 펼치기) */}
      <section id="my-info" className="scroll-mt-20">
        <Heading>내 정보</Heading>
        <div className={`divide-y divide-dashed divide-[#ddd3c2] px-4 ${sheet}`}>
          <details className="group py-1">
            <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-medium">
              공개 프로필 (닉네임·소개)
              <ChevronRight aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
            </summary>
            <div className="pb-4">
              <ProfileForm nickname={profile?.nickname ?? ""} bio={profile?.bio ?? null} />
            </div>
          </details>
          <details className="group py-1">
            <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-medium">
              비공개 정보 (휴대폰·출생 연도)
              <ChevronRight aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
            </summary>
            <div className="pb-4">
              <p className="mb-3 text-xs text-muted-foreground">본인만 볼 수 있으며 호스트에게 공개되지 않습니다.</p>
              <PrivateForm phone={priv?.phone ?? null} birthYear={priv?.birth_year ?? null} />
            </div>
          </details>
        </div>
      </section>

      <div className="-mt-2 flex items-center justify-between px-1 text-[12.5px] text-muted-foreground">
        <form action={signOutAction}>
          <button type="submit" className="hover:text-foreground hover:underline">로그아웃</button>
        </form>
        <Link href="/me/withdraw" className="hover:text-foreground hover:underline">회원 탈퇴하기</Link>
      </div>
      <p aria-hidden className="flex justify-center opacity-40"><BrandMark /></p>
    </div>
  );
}

export default async function Page() {
  const member = await requireMember("/me");
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <MyPage member={member} />
      </main>
    </>
  );
}
