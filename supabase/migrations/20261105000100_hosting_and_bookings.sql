-- ============================================================================
-- 호스트 신청·승인, 모임 등록·수정·검수, 참가 신청·정원 관리
--  - 상태 변경(검수 요청·승인·공개·정지)과 신청·취소는 모두 DB 함수로만 (정원·중복을 DB가 보장)
--  - 결제 없음: 신청 즉시 확정(선착순). 결제 연동 시 금액 스냅샷(unit_price, total_price)을 그대로 사용
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 호스트 신청·심사 정보
-- ---------------------------------------------------------------------------
alter table public.host_profiles
  add column review_note text,
  add column applied_at timestamptz not null default now(),
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references public.profiles (id);

grant select (review_note, applied_at, reviewed_at, updated_at) on public.host_profiles to authenticated;
grant update (display_name, headline, bio, expertise, instagram_handle) on public.host_profiles to authenticated;

create policy host_profiles_update_own on public.host_profiles
  for update to authenticated
  using (user_id = (select auth.uid()) and status in ('applied', 'approved') and (select private.is_active_member()))
  with check (user_id = (select auth.uid()));

create function private.is_approved_host()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('host')
     and exists (select 1 from public.host_profiles where user_id = auth.uid() and status = 'approved')
$$;
grant execute on function private.is_approved_host() to anon, authenticated;

-- 호스트 신청 (반려된 경우 다시 신청 가능)
create function public.apply_host(
  p_display_name text,
  p_headline text,
  p_bio text,
  p_expertise text[],
  p_instagram text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_status public.host_status;
begin
  if v_user is null or not private.is_active_member() then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  select status into v_status from public.host_profiles where user_id = v_user for update;
  if found then
    if v_status in ('applied', 'approved') then
      raise exception '이미 신청했거나 승인된 호스트입니다' using errcode = '22023';
    elsif v_status = 'suspended' then
      raise exception '이용이 제한된 호스트 계정입니다. 운영팀에 문의해 주세요' using errcode = '42501';
    end if;
    update public.host_profiles
       set display_name = btrim(p_display_name), headline = btrim(coalesce(p_headline, '')),
           bio = btrim(coalesce(p_bio, '')), expertise = coalesce(p_expertise, '{}'),
           instagram_handle = nullif(btrim(coalesce(p_instagram, '')), ''),
           status = 'applied', review_note = null, applied_at = now(), reviewed_at = null, reviewed_by = null
     where user_id = v_user;
  else
    insert into public.host_profiles (user_id, display_name, headline, bio, expertise, instagram_handle, status)
    values (v_user, btrim(p_display_name), btrim(coalesce(p_headline, '')), btrim(coalesce(p_bio, '')),
            coalesce(p_expertise, '{}'), nullif(btrim(coalesce(p_instagram, '')), ''), 'applied');
  end if;
end;
$$;

-- 관리자: 호스트 승인·반려 (승인 시 host 역할 부여)
create function public.admin_review_host(p_user_id uuid, p_approve boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.host_status;
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  select status into v_status from public.host_profiles where user_id = p_user_id for update;
  if not found then
    raise exception '호스트 신청을 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if v_status <> 'applied' then
    raise exception '심사 대기 중인 신청이 아닙니다' using errcode = '22023';
  end if;
  if not p_approve and (p_note is null or char_length(btrim(p_note)) < 5) then
    raise exception '반려 사유를 5자 이상 입력하세요' using errcode = '22023';
  end if;

  update public.host_profiles
     set status = case when p_approve then 'approved'::public.host_status else 'rejected'::public.host_status end,
         review_note = nullif(btrim(coalesce(p_note, '')), ''),
         reviewed_at = now(), reviewed_by = auth.uid()
   where user_id = p_user_id;

  if p_approve then
    insert into public.user_roles (user_id, role, granted_by) values (p_user_id, 'host', auth.uid())
      on conflict (user_id, role) do nothing;
  end if;

  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after, reason)
  values (auth.uid(), 'admin', case when p_approve then 'host.approve' else 'host.reject' end, 'host', p_user_id,
          jsonb_build_object('status', v_status),
          jsonb_build_object('status', case when p_approve then 'approved' else 'rejected' end),
          nullif(btrim(coalesce(p_note, '')), ''));
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. 모임 등록·수정 (호스트), 상태 변경은 함수로만
-- ---------------------------------------------------------------------------
grant select (review_note, updated_at) on public.meetups to authenticated;
grant insert (host_id, category_slug, meetup_type, title, summary, description, price, max_quantity_per_booking,
              target_audience, requirements, what_to_bring, agenda, refund_policy_text, min_age)
  on public.meetups to authenticated;
grant update (category_slug, meetup_type, title, summary, description, price, max_quantity_per_booking,
              target_audience, requirements, what_to_bring, agenda, refund_policy_text, min_age)
  on public.meetups to authenticated;

create policy meetups_insert_host on public.meetups
  for insert to authenticated
  with check (host_id = (select auth.uid()) and (select private.is_approved_host()) and status = 'draft' and not is_sample);

create policy meetups_update_host on public.meetups
  for update to authenticated
  using (host_id = (select auth.uid()) and (select private.is_approved_host())
         and status in ('draft', 'pending_review', 'rejected', 'published'))
  with check (host_id = (select auth.uid()));

-- 확정 신청이 있는 모임은 참가비를 바꿀 수 없음
create function private.guard_meetup_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.price is distinct from old.price and exists (
    select 1 from public.bookings b join public.meetup_sessions s on s.id = b.session_id
    where s.meetup_id = old.id and b.status = 'confirmed'
  ) then
    raise exception '확정된 신청이 있어 참가비를 바꿀 수 없습니다' using errcode = '22023';
  end if;
  return new;
end;
$$;

-- 호스트: 검수 요청 / 요청 취소 / 모집 종료
create function public.host_set_meetup_status(p_meetup_id uuid, p_action text)
returns public.meetup_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  v_next public.meetup_status;
begin
  if not private.is_approved_host() then
    raise exception '승인된 호스트만 할 수 있습니다' using errcode = '42501';
  end if;
  select * into m from public.meetups where id = p_meetup_id and host_id = auth.uid() for update;
  if not found then
    raise exception '모임을 찾을 수 없습니다' using errcode = 'P0002';
  end if;

  if p_action = 'submit' and m.status in ('draft', 'rejected') then
    if m.meetup_type = 'alcohol' then
      raise exception '주류가 포함된 모임은 운영 검토가 끝난 뒤 열 수 있습니다' using errcode = '22023';
    end if;
    if not exists (select 1 from public.meetup_sessions where meetup_id = m.id and status = 'open' and starts_at > now()) then
      raise exception '앞으로 열릴 일정을 하나 이상 추가해 주세요' using errcode = '22023';
    end if;
    v_next := 'pending_review';
  elsif p_action = 'withdraw' and m.status = 'pending_review' then
    v_next := 'draft';
  elsif p_action = 'close' and m.status = 'published' then
    v_next := 'archived';
  else
    raise exception '지금 상태(%)에서는 할 수 없는 작업입니다', m.status using errcode = '22023';
  end if;

  update public.meetups set status = v_next where id = m.id;
  return v_next;
end;
$$;

-- 관리자: 공개·반려·정지·정지 해제
create function public.admin_review_meetup(p_meetup_id uuid, p_action text, p_note text)
returns public.meetup_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  v_next public.meetup_status;
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  select * into m from public.meetups where id = p_meetup_id for update;
  if not found then
    raise exception '모임을 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if p_action in ('reject', 'suspend') and (p_note is null or char_length(btrim(p_note)) < 5) then
    raise exception '사유를 5자 이상 입력하세요' using errcode = '22023';
  end if;

  if p_action = 'publish' and m.status = 'pending_review' then
    if not exists (select 1 from public.host_profiles where user_id = m.host_id and status = 'approved') then
      raise exception '승인된 호스트의 모임만 공개할 수 있습니다' using errcode = '22023';
    end if;
    v_next := 'published';
  elsif p_action = 'reject' and m.status = 'pending_review' then
    v_next := 'rejected';
  elsif p_action = 'suspend' and m.status = 'published' then
    v_next := 'suspended';
  elsif p_action = 'unsuspend' and m.status = 'suspended' then
    v_next := 'published';
  else
    raise exception '지금 상태(%)에서는 할 수 없는 작업입니다', m.status using errcode = '22023';
  end if;

  update public.meetups
     set status = v_next,
         review_note = case when v_next = 'published' then null else btrim(p_note) end,
         published_at = case when v_next = 'published' then coalesce(published_at, now()) else published_at end
   where id = m.id;

  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after, reason)
  values (auth.uid(), 'admin', 'meetup.' || p_action, 'meetup', m.id,
          jsonb_build_object('status', m.status), jsonb_build_object('status', v_next), nullif(btrim(coalesce(p_note, '')), ''));
  return v_next;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. 회차 등록·수정 (호스트)
-- ---------------------------------------------------------------------------
grant insert (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity)
  on public.meetup_sessions to authenticated;
grant update (starts_at, ends_at, area, venue_name, address_detail, capacity)
  on public.meetup_sessions to authenticated;

create function private.owns_editable_meetup(p_meetup_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_approved_host() and exists (
    select 1 from public.meetups
    where id = p_meetup_id and host_id = auth.uid() and status in ('draft', 'pending_review', 'rejected', 'published'))
$$;
grant execute on function private.owns_editable_meetup(uuid) to authenticated;

create policy meetup_sessions_insert_host on public.meetup_sessions
  for insert to authenticated
  with check ((select private.owns_editable_meetup(meetup_id)) and starts_at > now() and reserved_count = 0 and status = 'open');

create policy meetup_sessions_update_host on public.meetup_sessions
  for update to authenticated
  using ((select private.owns_editable_meetup(meetup_id)) and status in ('open', 'closed'))
  with check ((select private.owns_editable_meetup(meetup_id)));

-- 호스트: 모집 마감/재개/취소 (취소는 확정 신청이 없을 때만)
create function public.host_set_session_status(p_session_id uuid, p_action text)
returns public.session_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  v_next public.session_status;
begin
  select ms.* into s from public.meetup_sessions ms
   where ms.id = p_session_id and private.owns_editable_meetup(ms.meetup_id) for update;
  if not found then
    raise exception '일정을 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if p_action = 'close' and s.status = 'open' then
    v_next := 'closed';
  elsif p_action = 'open' and s.status = 'closed' and s.starts_at > now() then
    v_next := 'open';
  elsif p_action = 'cancel' and s.status in ('open', 'closed') then
    if exists (select 1 from public.bookings where session_id = s.id and status = 'confirmed') then
      raise exception '확정된 신청자가 있는 일정은 운영팀에 문의해 취소해 주세요' using errcode = '22023';
    end if;
    v_next := 'cancelled';
  else
    raise exception '지금 상태(%)에서는 할 수 없는 작업입니다', s.status using errcode = '22023';
  end if;
  update public.meetup_sessions set status = v_next where id = s.id;
  return v_next;
end;
$$;

-- 호스트용 회차 목록 (상세 주소 포함)
create function public.host_meetup_sessions(p_meetup_id uuid)
returns table (
  id uuid, starts_at timestamptz, ends_at timestamptz, area text, venue_name text, address_detail text,
  capacity smallint, reserved_count smallint, status public.session_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.starts_at, s.ends_at, s.area, s.venue_name, s.address_detail, s.capacity, s.reserved_count, s.status
  from public.meetup_sessions s
  join public.meetups m on m.id = s.meetup_id
  where s.meetup_id = p_meetup_id and m.host_id = auth.uid() and private.has_role('host')
  order by s.starts_at
$$;

-- ---------------------------------------------------------------------------
-- 4. 참가 신청
-- ---------------------------------------------------------------------------
create type public.booking_status as enum ('confirmed', 'cancelled_by_user', 'cancelled_by_host');

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.meetup_sessions (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  quantity smallint not null check (quantity between 1 and 4),
  unit_price integer not null check (unit_price >= 0),
  total_price integer not null,
  status public.booking_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint bookings_total check (total_price = unit_price * quantity)
);
-- 한 사람은 한 일정에 확정 신청 1건만
create unique index bookings_one_active_per_user on public.bookings (session_id, user_id) where status = 'confirmed';
create index bookings_user_idx on public.bookings (user_id, created_at desc);
create index bookings_session_idx on public.bookings (session_id);

create trigger bookings_set_updated_at before update on public.bookings
  for each row execute function private.set_updated_at();
create trigger meetups_guard_update before update on public.meetups
  for each row execute function private.guard_meetup_update();

alter table public.bookings enable row level security;
revoke all on public.bookings from public, anon, authenticated;
grant select (id, session_id, user_id, quantity, unit_price, total_price, status, created_at, cancelled_at)
  on public.bookings to authenticated;

create policy bookings_select_own_host_admin on public.bookings
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.meetup_sessions s join public.meetups m on m.id = s.meetup_id
               where s.id = session_id and m.host_id = (select auth.uid()))
    or (select private.is_admin())
  );

-- 신청: 일정 행을 잠근 뒤 남은 자리를 확인 → 동시에 신청해도 정원 초과 불가
create function public.book_session(p_session_id uuid, p_quantity integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  s record;
  m record;
  v_id uuid;
begin
  if v_user is null or not private.is_active_member() then
    raise exception '로그인이 필요합니다' using errcode = '42501', hint = 'login_required';
  end if;

  select * into s from public.meetup_sessions where id = p_session_id for update;
  if not found then
    raise exception '일정을 찾을 수 없습니다' using errcode = 'P0002', hint = 'not_found';
  end if;
  select mt.*, h.status as host_status into m
    from public.meetups mt join public.host_profiles h on h.user_id = mt.host_id
   where mt.id = s.meetup_id;

  if m.status <> 'published' or m.host_status <> 'approved' then
    raise exception '신청할 수 없는 모임입니다' using errcode = 'P0001', hint = 'not_open';
  end if;
  if m.is_sample then
    raise exception '샘플 모임은 신청할 수 없습니다' using errcode = 'P0001', hint = 'sample';
  end if;
  if m.host_id = v_user then
    raise exception '내가 연 모임에는 신청할 수 없습니다' using errcode = 'P0001', hint = 'own_meetup';
  end if;
  if s.status <> 'open' or s.starts_at <= now() then
    raise exception '모집이 마감된 일정입니다' using errcode = 'P0001', hint = 'closed';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > m.max_quantity_per_booking then
    raise exception '한 번에 1~%명까지 신청할 수 있습니다', m.max_quantity_per_booking
      using errcode = 'P0001', hint = 'quantity';
  end if;
  if exists (select 1 from public.bookings where session_id = s.id and user_id = v_user and status = 'confirmed') then
    raise exception '이미 신청한 일정입니다' using errcode = 'P0001', hint = 'duplicate';
  end if;
  if s.reserved_count + p_quantity > s.capacity then
    raise exception '남은 자리가 부족합니다 (남은 자리 %명)', s.capacity - s.reserved_count
      using errcode = 'P0001', hint = 'full';
  end if;

  insert into public.bookings (session_id, user_id, quantity, unit_price, total_price)
  values (s.id, v_user, p_quantity, m.price, m.price * p_quantity)
  returning id into v_id;
  update public.meetup_sessions set reserved_count = reserved_count + p_quantity where id = s.id;
  return v_id;
end;
$$;

-- 참가자 취소 (모임 시작 전까지)
create function public.cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b record;
  s record;
begin
  select * into b from public.bookings where id = p_booking_id and user_id = auth.uid();
  if not found then
    raise exception '신청 내역을 찾을 수 없습니다' using errcode = 'P0002', hint = 'not_found';
  end if;
  select * into s from public.meetup_sessions where id = b.session_id for update;
  select * into b from public.bookings where id = p_booking_id for update;
  if b.status <> 'confirmed' then
    raise exception '이미 취소된 신청입니다' using errcode = 'P0001', hint = 'already_cancelled';
  end if;
  if s.starts_at <= now() then
    raise exception '시작된 모임은 취소할 수 없습니다' using errcode = 'P0001', hint = 'started';
  end if;
  update public.bookings set status = 'cancelled_by_user', cancelled_at = now() where id = b.id;
  update public.meetup_sessions set reserved_count = reserved_count - b.quantity where id = s.id;
end;
$$;

-- 내 신청 내역 (확정 신청에만 상세 주소 공개)
create function public.my_bookings()
returns table (
  booking_id uuid, status public.booking_status, quantity smallint, total_price integer,
  created_at timestamptz, cancelled_at timestamptz,
  session_id uuid, starts_at timestamptz, ends_at timestamptz, area text, venue_name text, address_detail text,
  meetup_id uuid, title text, category_slug text, is_sample boolean, host_id uuid, host_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.status, b.quantity, b.total_price, b.created_at, b.cancelled_at,
         s.id, s.starts_at, s.ends_at, s.area, s.venue_name,
         case when b.status = 'confirmed' then s.address_detail end,
         m.id, m.title, m.category_slug, m.is_sample, h.user_id, h.display_name
  from public.bookings b
  join public.meetup_sessions s on s.id = b.session_id
  join public.meetups m on m.id = s.meetup_id
  join public.host_profiles h on h.user_id = m.host_id
  where b.user_id = auth.uid()
  order by s.starts_at desc
$$;

-- 호스트: 내 모임 참가자 (닉네임만, 연락처 없음)
create function public.host_meetup_participants(p_meetup_id uuid)
returns table (
  booking_id uuid, session_id uuid, nickname text, quantity smallint, status public.booking_status, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.session_id, p.nickname, b.quantity, b.status, b.created_at
  from public.bookings b
  join public.meetup_sessions s on s.id = b.session_id
  join public.meetups m on m.id = s.meetup_id
  join public.profiles p on p.id = b.user_id
  where s.meetup_id = p_meetup_id and m.host_id = auth.uid() and private.has_role('host')
  order by s.starts_at, b.created_at
$$;

-- ---------------------------------------------------------------------------
-- 5. 함수 실행 권한
-- ---------------------------------------------------------------------------
revoke all on function public.apply_host(text, text, text, text[], text) from public, anon;
revoke all on function public.admin_review_host(uuid, boolean, text) from public, anon;
revoke all on function public.host_set_meetup_status(uuid, text) from public, anon;
revoke all on function public.admin_review_meetup(uuid, text, text) from public, anon;
revoke all on function public.host_set_session_status(uuid, text) from public, anon;
revoke all on function public.host_meetup_sessions(uuid) from public, anon;
revoke all on function public.book_session(uuid, integer) from public, anon;
revoke all on function public.cancel_booking(uuid) from public, anon;
revoke all on function public.my_bookings() from public, anon;
revoke all on function public.host_meetup_participants(uuid) from public, anon;
revoke all on function private.guard_meetup_update() from public, anon, authenticated;

grant execute on function public.apply_host(text, text, text, text[], text) to authenticated;
grant execute on function public.admin_review_host(uuid, boolean, text) to authenticated;
grant execute on function public.host_set_meetup_status(uuid, text) to authenticated;
grant execute on function public.admin_review_meetup(uuid, text, text) to authenticated;
grant execute on function public.host_set_session_status(uuid, text) to authenticated;
grant execute on function public.host_meetup_sessions(uuid) to authenticated;
grant execute on function public.book_session(uuid, integer) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.my_bookings() to authenticated;
grant execute on function public.host_meetup_participants(uuid) to authenticated;
