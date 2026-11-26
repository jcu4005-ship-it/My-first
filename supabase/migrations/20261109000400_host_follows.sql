-- ============================================================================
-- 호스트 생태계 4단계: 호스트 팔로우
--  - host_follows: 회원이 승인된 호스트를 팔로우. 본인만 자기 목록을 볼 수 있음
--  - 팔로우/취소는 함수로만 (활성 회원, 승인된 호스트, 자기 자신 불가)
--  - 팔로워 수는 공개 함수로만 (누가 팔로우했는지는 공개하지 않음)
--  - 회원 탈퇴 시 그 회원의 팔로우와 그 회원(호스트)을 향한 팔로우 삭제
-- ============================================================================

create table public.host_follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  host_id uuid not null references public.host_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, host_id),
  check (follower_id <> host_id)
);
create index host_follows_host_idx on public.host_follows (host_id);

alter table public.host_follows enable row level security;
revoke all on public.host_follows from anon, authenticated;
grant select on public.host_follows to authenticated;
create policy host_follows_select_own on public.host_follows
  for select to authenticated
  using (follower_id = (select auth.uid()));

-- 팔로우 (이미 팔로우 중이면 그대로)
create function public.follow_host(p_host_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not private.is_active_member() then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if p_host_id = v_user then
    raise exception '자기 자신은 팔로우할 수 없습니다' using errcode = '22023';
  end if;
  if not exists (select 1 from public.host_profiles where user_id = p_host_id and status = 'approved') then
    raise exception '팔로우할 수 없는 호스트입니다' using errcode = 'P0002';
  end if;
  insert into public.host_follows (follower_id, host_id) values (v_user, p_host_id)
  on conflict do nothing;
end;
$$;
revoke all on function public.follow_host(uuid) from public, anon;
grant execute on function public.follow_host(uuid) to authenticated;

-- 팔로우 취소 (호스트 상태와 상관없이 언제나 가능)
create function public.unfollow_host(p_host_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  delete from public.host_follows where follower_id = auth.uid() and host_id = p_host_id;
end;
$$;
revoke all on function public.unfollow_host(uuid) from public, anon;
grant execute on function public.unfollow_host(uuid) to authenticated;

-- 공개 팔로워 수 (승인된 호스트만, 그 외에는 0)
create function public.host_follower_count(p_host_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.host_follows f
  join public.host_profiles h on h.user_id = f.host_id and h.status = 'approved'
  join public.profiles p on p.id = f.follower_id and p.status = 'active'
  where f.host_id = p_host_id;
$$;
revoke all on function public.host_follower_count(uuid) from public;
grant execute on function public.host_follower_count(uuid) to anon, authenticated;

-- 탈퇴 정리: 지원서 개인정보(3단계) + 팔로우
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
  end if;
  return new;
end;
$$;
revoke all on function private.on_member_withdrawn() from public, anon, authenticated;
