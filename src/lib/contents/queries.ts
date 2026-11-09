import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { ContentStatus, ContentType } from "./types";

export type ContentCard = {
  id: string;
  slug: string;
  type: ContentType;
  title: string;
  summary: string;
  cover_path: string | null;
  published_at: string | null;
  is_sample: boolean;
  host: { user_id: string; slug: string | null; display_name: string; avatar_path: string | null } | null;
};

export type ContentDetail = ContentCard & {
  body: string;
  related: { id: string; title: string; summary: string; status: string } | null;
};

export type MyContent = {
  id: string;
  slug: string;
  type: ContentType;
  status: ContentStatus;
  title: string;
  summary: string;
  body: string;
  cover_path: string | null;
  host_id: string | null;
  author_id: string;
  related_meetup_id: string | null;
  review_note: string | null;
  submitted_at: string | null;
  published_at: string | null;
  updated_at: string;
  is_sample: boolean;
};

const CARD_SELECT = "id, slug, type, title, summary, cover_path, published_at, is_sample, host:host_profiles(user_id, slug, display_name, avatar_path)";
const MINE_SELECT =
  "id, slug, type, status, title, summary, body, cover_path, host_id, author_id, related_meetup_id, review_note, submitted_at, published_at, updated_at, is_sample";

/** 공개된 콘텐츠 목록 (RLS: 공개 + 호스트 승인 상태만) */
export async function listPublishedContents(opts: { type?: ContentType; hostId?: string; limit?: number } = {}): Promise<ContentCard[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase.from("contents").select(CARD_SELECT).eq("status", "published").order("published_at", { ascending: false });
  if (opts.type) q = q.eq("type", opts.type);
  if (opts.hostId) q = q.eq("host_id", opts.hostId);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q.returns<ContentCard[]>();
  if (error) throw new Error(`콘텐츠 목록 조회 실패: ${error.message}`);
  return data ?? [];
}

export async function getPublishedContent(slug: string): Promise<ContentDetail | null> {
  if (!/^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$/.test(slug)) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("contents")
    .select(`${CARD_SELECT}, body, related:meetups(id, title, summary, status)`)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle()
    .overrideTypes<ContentDetail, { merge: false }>();
  if (error) throw new Error(`콘텐츠 조회 실패: ${error.message}`);
  if (!data) return null;
  // 연결된 프로그램은 공개 상태일 때만 보여 줌
  return { ...data, related: data.related && data.related.status === "published" ? data.related : null };
}

/** 내가 쓴 콘텐츠 (RLS: 본인 글) */
export async function listMyContents(userId: string): Promise<MyContent[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("contents")
    .select(MINE_SELECT)
    .eq("author_id", userId)
    .order("updated_at", { ascending: false })
    .returns<MyContent[]>();
  if (error) throw new Error(`내 콘텐츠 조회 실패: ${error.message}`);
  return data ?? [];
}

export async function getMyContent(id: string, userId: string): Promise<MyContent | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("contents").select(MINE_SELECT).eq("id", id).eq("author_id", userId).maybeSingle<MyContent>();
  return data ?? null;
}

export type AdminContentRow = MyContent & {
  host: { display_name: string; slug: string | null } | null;
  author: { nickname: string } | null;
};

/** 관리자: 상태별 목록 (RLS: 관리자는 전체) */
export async function listContentsForAdmin(status: ContentStatus | "mine", adminId: string): Promise<AdminContentRow[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("contents")
    .select(`${MINE_SELECT}, host:host_profiles(display_name, slug), author:profiles!contents_author_id_fkey(nickname)`)
    .order("updated_at", { ascending: false })
    .limit(100);
  q = status === "mine" ? q.eq("author_id", adminId).in("status", ["draft", "rejected", "archived"]) : q.eq("status", status);
  const { data, error } = await q.returns<AdminContentRow[]>();
  if (error) throw new Error(`콘텐츠 목록 조회 실패: ${error.message}`);
  return data ?? [];
}

export async function getContentForAdmin(id: string): Promise<AdminContentRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("contents")
    .select(`${MINE_SELECT}, host:host_profiles(display_name, slug), author:profiles!contents_author_id_fkey(nickname)`)
    .eq("id", id)
    .maybeSingle<AdminContentRow>();
  return data ?? null;
}

/** 콘텐츠에 연결할 수 있는 공개 프로그램 (호스트 글이면 그 호스트의 프로그램만) */
export async function listLinkableMeetups(hostId: string | null): Promise<{ id: string; title: string }[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase.from("meetups").select("id, title").eq("status", "published").order("created_at", { ascending: false }).limit(100);
  if (hostId) q = q.eq("host_id", hostId);
  const { data } = await q;
  return data ?? [];
}

export function contentDefaults(c: MyContent | null): Record<string, string> {
  return {
    contentId: c?.id ?? "",
    type: c?.type ?? "article",
    title: c?.title ?? "",
    summary: c?.summary ?? "",
    body: c?.body ?? "",
    coverPath: c?.cover_path ?? "",
    hostId: c?.host_id ?? "",
    relatedMeetupId: c?.related_meetup_id ?? "",
  };
}
