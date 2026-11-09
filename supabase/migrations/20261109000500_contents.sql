-- ============================================================================
-- 호스트 생태계 5단계: 콘텐츠(저널) — 아티클·인터뷰·포트폴리오
--  - 작성: 승인된 호스트와 관리자만 (처음에는 일반 회원 작성 없음)
--  - 호스트 글: 작성 중 → 검토 요청 → (관리자) 공개 / 반려. 공개 뒤 고치면 다시 검토
--  - 관리자 글: 바로 공개 가능. 공개·반려·내리기는 모두 감사 기록
--  - 본문은 일반 텍스트만 (HTML·마크다운 해석 없음)
--  - 대표 이미지 저장소 content-covers: 누구나 보기, 본인 폴더에만 올리기
--  - 공개 조건: 공개 상태 + (호스트 글이면) 호스트가 승인 상태
--  - 탈퇴: 작성자·호스트가 탈퇴하면 콘텐츠를 내림(archived)
-- ============================================================================

create type public.content_type as enum ('article', 'interview', 'portfolio');
create type public.content_status as enum ('draft', 'submitted', 'published', 'rejected', 'archived');

create table public.contents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$'),
  type public.content_type not null,
  status public.content_status not null default 'draft',
  title text not null check (char_length(title) between 2 and 80),
  summary text not null default '' check (char_length(summary) <= 200),
  body text not null default '' check (char_length(body) <= 20000),
  cover_path text check (cover_path is null or cover_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$'),
  author_id uuid not null references public.profiles (id) on delete restrict,
  host_id uuid references public.host_profiles (user_id) on delete set null,
  related_meetup_id uuid references public.meetups (id) on delete set null,
  review_note text,
  is_sample boolean not null default false,
  submitted_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contents_published_idx on public.contents (published_at desc) where status = 'published';
create index contents_host_idx on public.contents (host_id);
create index contents_author_idx on public.contents (author_id);
create trigger contents_set_updated_at before update on public.contents
  for each row execute function private.set_updated_at();

alter table public.contents enable row level security;
revoke all on public.contents from anon, authenticated;
-- 비로그인: 공개 열만 (검토 메모·요청 시각 제외). 로그인 회원: 표 단위 조회(행 범위는 RLS)
grant select (id, slug, type, status, title, summary, body, cover_path, author_id, host_id, related_meetup_id, is_sample, published_at, created_at, updated_at)
  on public.contents to anon;
grant select on public.contents to authenticated;

create policy contents_select_published on public.contents
  for select to anon, authenticated
  using (
    status = 'published'
    and (host_id is null or exists (select 1 from public.host_profiles h where h.user_id = contents.host_id and h.status = 'approved'))
  );
create policy contents_select_own on public.contents
  for select to authenticated
  using (author_id = (select auth.uid()));
create policy contents_select_admin on public.contents
  for select to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- 작성·수정 (작성 중 저장)
-- ---------------------------------------------------------------------------
create function public.save_content(
  p_id uuid, p_type public.content_type, p_title text, p_summary text, p_body text,
  p_cover_path text, p_host_id uuid, p_related_meetup_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_admin boolean := private.is_admin();
  v_host_id uuid := p_host_id;
  c record;
  v_id uuid;
  v_slug text;
begin
  if v_user is null or not private.is_active_member() or not (v_admin or private.is_approved_host()) then
    raise exception '승인된 호스트나 관리자만 콘텐츠를 쓸 수 있습니다' using errcode = '42501';
  end if;
  if not v_admin then
    v_host_id := v_user; -- 호스트는 자기 이름으로만
  elsif v_host_id is not null and not exists (select 1 from public.host_profiles where user_id = v_host_id and status = 'approved') then
    raise exception '승인된 호스트만 연결할 수 있습니다' using errcode = '22023';
  end if;
  if char_length(coalesce(trim(p_title), '')) < 2 then
    raise exception '제목을 2자 이상 입력하세요' using errcode = '22023';
  end if;
  if p_cover_path is not null and split_part(p_cover_path, '/', 1) <> v_user::text then
    raise exception '본인 폴더의 사진만 사용할 수 있습니다' using errcode = '42501';
  end if;
  if p_related_meetup_id is not null and not exists (
    select 1 from public.meetups m where m.id = p_related_meetup_id and m.status = 'published'
      and (v_host_id is null or m.host_id = v_host_id)
  ) then
    raise exception '연결할 수 없는 프로그램입니다' using errcode = '22023';
  end if;

  if p_id is null then
    loop
      v_slug := 'j-' || substr(md5(gen_random_uuid()::text), 1, 8);
      exit when not exists (select 1 from public.contents where slug = v_slug);
    end loop;
    insert into public.contents (slug, type, title, summary, body, cover_path, author_id, host_id, related_meetup_id)
    values (v_slug, p_type, trim(p_title), coalesce(trim(p_summary), ''), coalesce(p_body, ''), p_cover_path, v_user, v_host_id, p_related_meetup_id)
    returning id into v_id;
    return v_id;
  end if;

  select * into c from public.contents where id = p_id for update;
  if not found or c.author_id <> v_user then
    raise exception '콘텐츠를 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if c.status = 'submitted' then
    raise exception '검토 중에는 고칠 수 없습니다' using errcode = '22023';
  end if;
  update public.contents set
    type = p_type, title = trim(p_title), summary = coalesce(trim(p_summary), ''), body = coalesce(p_body, ''),
    cover_path = p_cover_path, host_id = v_host_id, related_meetup_id = p_related_meetup_id,
    -- 호스트가 공개·반려·내려진 글을 고치면 다시 작성 중으로 (공개 화면에서 내려감). 관리자 글은 상태 유지
    status = case when v_admin and c.status = 'published' then c.status else 'draft' end
  where id = p_id;
  if c.status = 'published' and not v_admin then
    insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after)
    values (v_user, 'member', 'content.edit_published', 'content', p_id, jsonb_build_object('status', c.status), jsonb_build_object('status', 'draft'));
  end if;
  return p_id;
end;
$$;
revoke all on function public.save_content(uuid, public.content_type, text, text, text, text, uuid, uuid) from public, anon;
grant execute on function public.save_content(uuid, public.content_type, text, text, text, text, uuid, uuid) to authenticated;

-- 필수 항목 (공개·검토 요청 전에 확인)
create function private.check_content_ready(c public.contents)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if char_length(c.title) < 5 then
    raise exception '제목을 5자 이상 입력하세요' using errcode = '22023';
  end if;
  if char_length(c.summary) < 10 then
    raise exception '요약을 10자 이상 입력하세요' using errcode = '22023';
  end if;
  if char_length(c.body) < 100 then
    raise exception '본문을 100자 이상 입력하세요' using errcode = '22023';
  end if;
end;
$$;
revoke all on function private.check_content_ready(public.contents) from public, anon, authenticated;

-- 호스트: 검토 요청
create function public.submit_content(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contents;
begin
  if auth.uid() is null or not private.is_active_member() then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  select * into c from public.contents where id = p_id for update;
  if not found or c.author_id <> auth.uid() then
    raise exception '콘텐츠를 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if c.status not in ('draft', 'rejected', 'archived') then
    raise exception '작성 중인 콘텐츠만 검토를 요청할 수 있습니다' using errcode = '22023';
  end if;
  perform private.check_content_ready(c);
  update public.contents set status = 'submitted', submitted_at = now(), review_note = null where id = p_id;
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after)
  values (auth.uid(), 'member', 'content.submit', 'content', p_id, jsonb_build_object('status', c.status), jsonb_build_object('status', 'submitted'));
end;
$$;
revoke all on function public.submit_content(uuid) from public, anon;
grant execute on function public.submit_content(uuid) to authenticated;

-- 관리자: 공개 / 반려 / 내리기
create function public.admin_review_content(p_id uuid, p_action text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contents;
  v_next public.content_status;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  select * into c from public.contents where id = p_id for update;
  if not found then
    raise exception '콘텐츠를 찾을 수 없습니다' using errcode = 'P0002';
  end if;

  if p_action = 'publish' then
    -- 호스트 글은 검토 요청된 것만, 관리자 본인 글은 작성 중에서도 바로 공개
    if not (c.status = 'submitted' or (c.author_id = auth.uid() and c.status in ('draft', 'rejected', 'archived'))) then
      raise exception '검토 요청된 콘텐츠만 공개할 수 있습니다' using errcode = '22023';
    end if;
    if c.host_id is not null and not exists (select 1 from public.host_profiles where user_id = c.host_id and status = 'approved') then
      raise exception '승인된 호스트의 콘텐츠만 공개할 수 있습니다' using errcode = '22023';
    end if;
    perform private.check_content_ready(c);
    v_next := 'published';
  elsif p_action in ('reject', 'unpublish') then
    if p_action = 'reject' and c.status <> 'submitted' then
      raise exception '검토 요청된 콘텐츠만 반려할 수 있습니다' using errcode = '22023';
    end if;
    if p_action = 'unpublish' and c.status <> 'published' then
      raise exception '공개된 콘텐츠만 내릴 수 있습니다' using errcode = '22023';
    end if;
    if char_length(coalesce(v_note, '')) < 5 then
      raise exception '사유를 5자 이상 입력하세요' using errcode = '22023';
    end if;
    v_next := case when p_action = 'reject' then 'rejected'::public.content_status else 'archived'::public.content_status end;
  else
    raise exception '알 수 없는 처리입니다' using errcode = '22023';
  end if;

  update public.contents set
    status = v_next,
    review_note = case when v_next = 'published' then null else v_note end,
    published_at = case when v_next = 'published' then coalesce(published_at, now()) else published_at end
  where id = p_id;

  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after, reason)
  values (auth.uid(), 'admin', 'content.' || p_action, 'content', p_id,
          jsonb_build_object('status', c.status), jsonb_build_object('status', v_next), v_note);

  if c.author_id <> auth.uid() then
    perform private.notify(
      c.author_id,
      'content.' || p_action,
      case v_next when 'published' then '콘텐츠가 공개되었어요' when 'rejected' then '콘텐츠 검토 결과: 보완이 필요해요' else '콘텐츠가 비공개로 전환되었어요' end,
      case when v_next = 'published' then c.title else coalesce(v_note, '') end,
      case when v_next = 'published' then '/journal/' || c.slug else '/host/contents/' || c.id end
    );
  end if;
end;
$$;
revoke all on function public.admin_review_content(uuid, text, text) from public, anon;
grant execute on function public.admin_review_content(uuid, text, text) to authenticated;

-- 작성자 본인: 작성 중·반려·내려진 글 지우기 (공개·검토 중인 글은 불가)
create function public.delete_my_content(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  delete from public.contents
   where id = p_id and author_id = auth.uid() and status in ('draft', 'rejected', 'archived');
  if not found then
    raise exception '지울 수 없는 콘텐츠입니다' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.delete_my_content(uuid) from public, anon;
grant execute on function public.delete_my_content(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 탈퇴 정리: 지원서(3단계) + 팔로우(4단계) + 콘텐츠 내리기
-- ---------------------------------------------------------------------------
create or replace function private.on_member_withdrawn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'withdrawn' and old.status is distinct from 'withdrawn' then
    update public.host_applications set
      display_name = '', contact_phone = '', headline = '', bio = '', career = '', credentials = '',
      portfolio_url = null, teaching_experience = '', instagram_handle = null, program_proposal = '',
      value_to_participants = '', preferred_format = '', fields = '{}',
      status = case when status in ('draft', 'submitted', 'reviewing', 'revision_requested') then 'rejected'::public.application_status else status end,
      review_note = case when status in ('draft', 'submitted', 'reviewing', 'revision_requested') then '회원 탈퇴' else review_note end
    where applicant_id = new.id;
    delete from public.host_follows where follower_id = new.id or host_id = new.id;
    update public.contents set status = 'archived', review_note = '회원 탈퇴', cover_path = null
     where (author_id = new.id or host_id = new.id) and status <> 'archived';
  end if;
  return new;
end;
$$;
revoke all on function private.on_member_withdrawn() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 대표 이미지 저장소
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-covers', 'content-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy content_covers_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'content-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy content_covers_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'content-covers' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'content-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy content_covers_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'content-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy content_covers_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'content-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
