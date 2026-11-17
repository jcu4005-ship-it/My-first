-- 참가 후기 · 출석 체크 · 참가자 공지 · 관리자 현황 숫자
-- 모든 쓰기는 SECURITY DEFINER 함수로만 (표에 직접 쓰기 권한 없음). 관리자 작업은 2단계 인증 + 감사 기록.

------------------------------------------------------------------------------
-- 1. 출석 체크: null = 아직 확인 안 함, true = 참석, false = 불참
------------------------------------------------------------------------------
alter table public.bookings add column attended boolean;
alter table public.bookings add column attendance_marked_at timestamptz;

create function public.host_mark_attendance(p_booking_id uuid, p_attended boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if not private.has_role('host') then
    raise exception 'forbidden: 호스트만 출석을 체크할 수 있습니다' using errcode = '42501';
  end if;
  select b.id, b.status, s.starts_at, m.host_id
    into r
    from public.bookings b
    join public.meetup_sessions s on s.id = b.session_id
    join public.meetups m on m.id = s.meetup_id
   where b.id = p_booking_id
   for update of b;
  if not found or r.host_id is distinct from auth.uid() then
    raise exception '신청을 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if r.status <> 'confirmed' then
    raise exception '확정된 신청만 출석을 체크할 수 있습니다' using errcode = '22023';
  end if;
  if r.starts_at > now() then
    raise exception '프로그램이 시작된 뒤에 출석을 체크할 수 있습니다' using errcode = '22023';
  end if;
  update public.bookings set attended = p_attended, attendance_marked_at = now() where id = p_booking_id;
end;
$$;
revoke all on function public.host_mark_attendance(uuid, boolean) from public, anon;
grant execute on function public.host_mark_attendance(uuid, boolean) to authenticated;

-- 호스트 참가자 목록에 출석 정보 추가 (반환 형태가 바뀌므로 다시 만듦)
drop function public.host_meetup_participants(uuid);
create function public.host_meetup_participants(p_meetup_id uuid)
returns table (
  booking_id uuid, session_id uuid, nickname text, quantity smallint, status public.booking_status, created_at timestamptz,
  attended boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.session_id, p.nickname, b.quantity, b.status, b.created_at, b.attended
  from public.bookings b
  join public.meetup_sessions s on s.id = b.session_id
  join public.meetups m on m.id = s.meetup_id
  join public.profiles p on p.id = b.user_id
  where s.meetup_id = p_meetup_id and m.host_id = auth.uid() and private.has_role('host')
  order by s.starts_at, b.created_at
$$;
revoke all on function public.host_meetup_participants(uuid) from public, anon;
grant execute on function public.host_meetup_participants(uuid) to authenticated;

------------------------------------------------------------------------------
-- 2. 참가 후기
--    - 확정 신청 1건당 1개, 프로그램이 끝난 뒤(시작 시각 이후) 30일 안에만
--    - 호스트가 '불참'으로 체크한 신청은 쓸 수 없음
--    - 호스트는 답글 1개(수정 가능), 관리자는 숨김/다시 보이기(사유·감사 기록)
------------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete restrict,
  meetup_id uuid not null references public.meetups (id) on delete restrict,
  host_id uuid not null references public.profiles (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 10 and 1000),
  host_reply text check (host_reply is null or char_length(host_reply) between 2 and 500),
  host_replied_at timestamptz,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reviews_meetup_idx on public.reviews (meetup_id, created_at desc);
create index reviews_host_idx on public.reviews (host_id, created_at desc);
create trigger reviews_set_updated_at before update on public.reviews
  for each row execute function private.set_updated_at();
alter table public.reviews enable row level security;
revoke all on public.reviews from public, anon, authenticated;
-- 정책 없음 = 표 직접 접근 불가. 아래 함수로만 읽고 씀.

create function public.write_review(p_booking_id uuid, p_rating integer, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if not private.is_active_member() then
    raise exception 'forbidden: 로그인이 필요합니다' using errcode = '42501';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception '별점은 1~5 사이로 골라 주세요' using errcode = '22023';
  end if;
  if char_length(v_body) < 10 or char_length(v_body) > 1000 then
    raise exception '후기는 10자 이상 1000자 이내로 적어 주세요' using errcode = '22023';
  end if;
  select b.id, b.user_id, b.status, b.attended, s.starts_at, m.id as meetup_id, m.host_id, m.title, m.is_sample
    into r
    from public.bookings b
    join public.meetup_sessions s on s.id = b.session_id
    join public.meetups m on m.id = s.meetup_id
   where b.id = p_booking_id;
  if not found or r.user_id is distinct from auth.uid() then
    raise exception '신청을 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if r.status <> 'confirmed' or r.is_sample then
    raise exception '참가한 프로그램에만 후기를 쓸 수 있어요' using errcode = '22023';
  end if;
  if r.attended is false then
    raise exception '불참으로 기록된 프로그램에는 후기를 쓸 수 없어요' using errcode = '22023';
  end if;
  if r.starts_at > now() then
    raise exception '프로그램이 끝난 뒤에 후기를 쓸 수 있어요' using errcode = '22023';
  end if;
  if r.starts_at < now() - interval '30 days' then
    raise exception '후기는 프로그램 후 30일 안에만 쓸 수 있어요' using errcode = '22023';
  end if;
  if exists (select 1 from public.reviews where booking_id = p_booking_id) then
    raise exception '이미 후기를 남겼어요' using errcode = '23505';
  end if;
  insert into public.reviews (booking_id, meetup_id, host_id, user_id, rating, body)
  values (p_booking_id, r.meetup_id, r.host_id, auth.uid(), p_rating, v_body)
  returning id into v_id;
  perform private.notify(r.host_id, 'review.new', '새 후기가 도착했어요', left(r.title, 60), '/host/reviews');
  return v_id;
end;
$$;
revoke all on function public.write_review(uuid, integer, text) from public, anon;
grant execute on function public.write_review(uuid, integer, text) to authenticated;

-- 내가 후기를 쓸 수 있거나 이미 쓴 신청
create function public.my_reviewable_bookings()
returns table (booking_id uuid, meetup_id uuid, title text, host_name text, starts_at timestamptz, review_id uuid, rating smallint, can_write boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, m.id, m.title, h.display_name, s.starts_at, rv.id, rv.rating,
         (rv.id is null and b.attended is distinct from false and s.starts_at <= now() and s.starts_at >= now() - interval '30 days')
  from public.bookings b
  join public.meetup_sessions s on s.id = b.session_id
  join public.meetups m on m.id = s.meetup_id
  join public.host_profiles h on h.user_id = m.host_id
  left join public.reviews rv on rv.booking_id = b.id
  where b.user_id = auth.uid() and b.status = 'confirmed' and not m.is_sample and s.starts_at <= now()
  order by s.starts_at desc
  limit 50
$$;
revoke all on function public.my_reviewable_bookings() from public, anon;
grant execute on function public.my_reviewable_bookings() to authenticated;

-- 공개 후기 (숨긴 후기 제외). 작성자는 닉네임만.
create function public.public_reviews(p_meetup_id uuid default null, p_host_id uuid default null, p_limit integer default 20)
returns table (id uuid, meetup_id uuid, meetup_title text, nickname text, rating smallint, body text, host_reply text, host_replied_at timestamptz, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select rv.id, rv.meetup_id, m.title, p.nickname, rv.rating, rv.body, rv.host_reply, rv.host_replied_at, rv.created_at
  from public.reviews rv
  join public.meetups m on m.id = rv.meetup_id
  join public.profiles p on p.id = rv.user_id
  where not rv.is_hidden
    and (p_meetup_id is not null or p_host_id is not null)
    and (p_meetup_id is null or rv.meetup_id = p_meetup_id)
    and (p_host_id is null or rv.host_id = p_host_id)
  order by rv.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;
grant execute on function public.public_reviews(uuid, uuid, integer) to anon, authenticated;

create function public.review_summary(p_meetup_id uuid default null, p_host_id uuid default null)
returns table (review_count integer, avg_rating numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int, round(avg(rating)::numeric, 1)
  from public.reviews
  where not is_hidden
    and (p_meetup_id is not null or p_host_id is not null)
    and (p_meetup_id is null or meetup_id = p_meetup_id)
    and (p_host_id is null or host_id = p_host_id)
$$;
grant execute on function public.review_summary(uuid, uuid) to anon, authenticated;

-- 호스트: 내 프로그램에 달린 후기 (숨김 여부 포함)
create function public.host_my_reviews()
returns table (id uuid, meetup_id uuid, meetup_title text, nickname text, rating smallint, body text, host_reply text, is_hidden boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select rv.id, rv.meetup_id, m.title, p.nickname, rv.rating, rv.body, rv.host_reply, rv.is_hidden, rv.created_at
  from public.reviews rv
  join public.meetups m on m.id = rv.meetup_id
  join public.profiles p on p.id = rv.user_id
  where rv.host_id = auth.uid() and private.has_role('host')
  order by rv.created_at desc
  limit 200
$$;
revoke all on function public.host_my_reviews() from public, anon;
grant execute on function public.host_my_reviews() to authenticated;

create function public.host_reply_review(p_review_id uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reply text := btrim(coalesce(p_reply, ''));
  r record;
begin
  if not private.has_role('host') then
    raise exception 'forbidden: 호스트만 답글을 쓸 수 있습니다' using errcode = '42501';
  end if;
  if char_length(v_reply) < 2 or char_length(v_reply) > 500 then
    raise exception '답글은 2자 이상 500자 이내로 적어 주세요' using errcode = '22023';
  end if;
  select id, host_id, user_id, meetup_id into r from public.reviews where id = p_review_id for update;
  if not found or r.host_id is distinct from auth.uid() then
    raise exception '후기를 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  update public.reviews set host_reply = v_reply, host_replied_at = now() where id = p_review_id;
  perform private.notify(r.user_id, 'review.reply', '호스트가 후기에 답글을 남겼어요', left(v_reply, 80), '/meetups/' || r.meetup_id);
end;
$$;
revoke all on function public.host_reply_review(uuid, text) from public, anon;
grant execute on function public.host_reply_review(uuid, text) to authenticated;

-- 관리자: 전체 후기 / 숨김 처리
create function public.admin_reviews(p_hidden_only boolean default false)
returns table (id uuid, meetup_id uuid, meetup_title text, host_name text, nickname text, rating smallint, body text, host_reply text, is_hidden boolean, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  return query
    select rv.id, rv.meetup_id, m.title, h.display_name, p.nickname, rv.rating, rv.body, rv.host_reply, rv.is_hidden, rv.created_at
    from public.reviews rv
    join public.meetups m on m.id = rv.meetup_id
    join public.host_profiles h on h.user_id = rv.host_id
    join public.profiles p on p.id = rv.user_id
    where (not coalesce(p_hidden_only, false) or rv.is_hidden)
    order by rv.created_at desc
    limit 300;
end;
$$;
revoke all on function public.admin_reviews(boolean) from public, anon;
grant execute on function public.admin_reviews(boolean) to authenticated;

create function public.admin_set_review_hidden(p_review_id uuid, p_hidden boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  r record;
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  if char_length(coalesce(v_reason, '')) < 5 then
    raise exception '사유를 5자 이상 입력하세요' using errcode = '22023';
  end if;
  select id, is_hidden into r from public.reviews where id = p_review_id for update;
  if not found then
    raise exception '후기를 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if r.is_hidden = p_hidden then
    raise exception '이미 그 상태예요' using errcode = '22023';
  end if;
  update public.reviews set is_hidden = p_hidden where id = p_review_id;
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after, reason)
  values (auth.uid(), 'admin', case when p_hidden then 'review.hide' else 'review.unhide' end, 'review', p_review_id,
          jsonb_build_object('is_hidden', r.is_hidden), jsonb_build_object('is_hidden', p_hidden), v_reason);
end;
$$;
revoke all on function public.admin_set_review_hidden(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_review_hidden(uuid, boolean, text) to authenticated;

------------------------------------------------------------------------------
-- 3. 호스트 → 참가자 공지 (일정 단위, 확정 신청자에게 알림)
------------------------------------------------------------------------------
create table public.session_notices (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.meetup_sessions (id) on delete restrict,
  host_id uuid not null references public.profiles (id) on delete restrict,
  body text not null check (char_length(body) between 5 and 300),
  recipients integer not null,
  created_at timestamptz not null default now()
);
create index session_notices_session_idx on public.session_notices (session_id, created_at desc);
alter table public.session_notices enable row level security;
revoke all on public.session_notices from public, anon, authenticated;

create function public.host_send_session_notice(p_session_id uuid, p_body text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  r record;
  v_count integer := 0;
  b record;
begin
  if not private.has_role('host') then
    raise exception 'forbidden: 호스트만 공지를 보낼 수 있습니다' using errcode = '42501';
  end if;
  if char_length(v_body) < 5 or char_length(v_body) > 300 then
    raise exception '공지는 5자 이상 300자 이내로 적어 주세요' using errcode = '22023';
  end if;
  select s.id, s.status, s.starts_at, m.id as meetup_id, m.host_id, m.title
    into r
    from public.meetup_sessions s join public.meetups m on m.id = s.meetup_id
   where s.id = p_session_id;
  if not found or r.host_id is distinct from auth.uid() then
    raise exception '일정을 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if r.status = 'cancelled' then
    raise exception '취소된 일정에는 공지를 보낼 수 없습니다' using errcode = '22023';
  end if;
  if (select count(*) from public.session_notices where session_id = p_session_id) >= 10 then
    raise exception '한 일정에 공지는 10번까지 보낼 수 있어요' using errcode = '22023';
  end if;
  for b in select distinct user_id from public.bookings where session_id = p_session_id and status = 'confirmed' loop
    perform private.notify(b.user_id, 'session.notice', '[' || left(r.title, 30) || '] 호스트 공지', v_body, '/me/bookings');
    v_count := v_count + 1;
  end loop;
  if v_count = 0 then
    raise exception '아직 확정된 참가자가 없어요' using errcode = '22023';
  end if;
  insert into public.session_notices (session_id, host_id, body, recipients) values (p_session_id, auth.uid(), v_body, v_count);
  return v_count;
end;
$$;
revoke all on function public.host_send_session_notice(uuid, text) from public, anon;
grant execute on function public.host_send_session_notice(uuid, text) to authenticated;

create function public.host_session_notices(p_meetup_id uuid)
returns table (id uuid, session_id uuid, body text, recipients integer, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.session_id, n.body, n.recipients, n.created_at
  from public.session_notices n
  join public.meetup_sessions s on s.id = n.session_id
  join public.meetups m on m.id = s.meetup_id
  where m.id = p_meetup_id and m.host_id = auth.uid() and private.has_role('host')
  order by n.created_at desc
$$;
revoke all on function public.host_session_notices(uuid) from public, anon;
grant execute on function public.host_session_notices(uuid) to authenticated;

------------------------------------------------------------------------------
-- 4. 호스트 활동 요약 / 관리자 현황 숫자 / 관리자 신청 목록
------------------------------------------------------------------------------
create function public.host_my_stats()
returns table (programs_published integer, upcoming_sessions integer, total_participants integer, attended_participants integer,
               review_count integer, avg_rating numeric, followers integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.meetups where host_id = auth.uid() and status = 'published'),
    (select count(*)::int from public.meetup_sessions s join public.meetups m on m.id = s.meetup_id
      where m.host_id = auth.uid() and s.status in ('open', 'closed') and s.starts_at > now()),
    (select coalesce(sum(b.quantity), 0)::int from public.bookings b join public.meetup_sessions s on s.id = b.session_id
      join public.meetups m on m.id = s.meetup_id where m.host_id = auth.uid() and b.status = 'confirmed' and s.starts_at <= now()),
    (select coalesce(sum(b.quantity), 0)::int from public.bookings b join public.meetup_sessions s on s.id = b.session_id
      join public.meetups m on m.id = s.meetup_id where m.host_id = auth.uid() and b.status = 'confirmed' and b.attended),
    (select count(*)::int from public.reviews where host_id = auth.uid() and not is_hidden),
    (select round(avg(rating)::numeric, 1) from public.reviews where host_id = auth.uid() and not is_hidden),
    (select count(*)::int from public.host_follows where host_id = auth.uid())
  where private.has_role('host')
$$;
revoke all on function public.host_my_stats() from public, anon;
grant execute on function public.host_my_stats() to authenticated;

create function public.admin_overview()
returns table (members_total integer, members_new_7d integer, bookings_7d integer, bookings_upcoming integer,
               hosts_approved integer, reviews_7d integer, avg_rating numeric, reviews_hidden integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  return query select
    (select count(*)::int from public.profiles where status = 'active'),
    (select count(*)::int from public.profiles where status = 'active' and created_at >= now() - interval '7 days'),
    (select count(*)::int from public.bookings where status = 'confirmed' and created_at >= now() - interval '7 days'),
    (select count(*)::int from public.bookings b join public.meetup_sessions s on s.id = b.session_id
      where b.status = 'confirmed' and s.starts_at > now()),
    (select count(*)::int from public.host_profiles where status = 'approved' and not is_test and not is_sample),
    (select count(*)::int from public.reviews where created_at >= now() - interval '7 days'),
    (select round(avg(rating)::numeric, 1) from public.reviews where not is_hidden),
    (select count(*)::int from public.reviews where is_hidden);
end;
$$;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- 관리자: 최근 신청 목록 (개인정보는 닉네임만)
create function public.admin_recent_bookings(p_status text default null)
returns table (booking_id uuid, created_at timestamptz, status public.booking_status, quantity smallint, total_price integer,
               nickname text, meetup_id uuid, title text, host_name text, starts_at timestamptz, attended boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  return query
    select b.id, b.created_at, b.status, b.quantity, b.total_price, p.nickname, m.id, m.title, h.display_name, s.starts_at, b.attended
    from public.bookings b
    join public.meetup_sessions s on s.id = b.session_id
    join public.meetups m on m.id = s.meetup_id
    join public.host_profiles h on h.user_id = m.host_id
    join public.profiles p on p.id = b.user_id
    where p_status is null or b.status::text = p_status
    order by b.created_at desc
    limit 200;
end;
$$;
revoke all on function public.admin_recent_bookings(text) from public, anon;
grant execute on function public.admin_recent_bookings(text) to authenticated;
