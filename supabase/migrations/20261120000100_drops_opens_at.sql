-- 드롭: 일정마다 "열림 시각"을 선택 (2026-11-20 대표 결정 "추천대로")
--  - 열림 시각이 비어 있으면 지금처럼 바로 신청 가능 (기존 일정은 모두 그대로)
--  - 열림 시각 전에는 신청 불가(DB도 막음), "열리면 알림 받기" 신청 가능
--  - 열리기 1시간 전(알림 신청자) · 열린 순간(알림 신청자 + 팔로워)에 사이트 안 알림. 일정당 각 한 번
--  - 호스트는 함수로만 정함 (표 쓰기 권한을 늘리지 않음 — 01번 보안 원칙)
--  - 신청 함수는 원래 내용 그대로 + 열림 시각 확인 한 가지만 추가

alter table public.meetup_sessions
  add column opens_at timestamptz,
  add column open_reminded_at timestamptz,
  add column open_notified_at timestamptz,
  add constraint meetup_sessions_opens_before_start check (opens_at is null or opens_at < starts_at);
grant select (opens_at) on public.meetup_sessions to anon, authenticated;

------------------------------------------------------------------------------
-- 1. 신청 함수: 열림 시각 확인 추가 (나머지는 20261110000100 그대로)
------------------------------------------------------------------------------
create or replace function public.book_session(p_session_id uuid, p_quantity integer, p_coupon_code text default null)
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
  v_gross integer;
  v_total integer;
  v_coupon uuid;
  v_discount integer := 0;
begin
  if v_user is null or not private.is_active_member() then
    raise exception '로그인이 필요합니다' using errcode = '42501', hint = 'login_required';
  end if;

  select * into s from public.meetup_sessions where id = p_session_id for update;
  if not found then
    raise exception '일정을 찾을 수 없습니다' using errcode = 'P0002', hint = 'not_found';
  end if;
  perform private.expire_holds(s.id);
  select * into s from public.meetup_sessions where id = p_session_id;

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
  -- 열림 시각(드롭)이 아직 안 됐으면 신청 불가. 열림 시각이 없는 일정은 지금처럼 바로 신청
  if s.opens_at is not null and s.opens_at > now() then
    raise exception '아직 열리지 않은 일정입니다 (% 에 열려요)', to_char(s.opens_at at time zone 'Asia/Seoul', 'MM/DD HH24:MI')
      using errcode = 'P0001', hint = 'not_yet_open';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > m.max_quantity_per_booking then
    raise exception '한 번에 1~%명까지 신청할 수 있습니다', m.max_quantity_per_booking
      using errcode = 'P0001', hint = 'quantity';
  end if;

  -- 같은 일정에 결제 대기 중인 내 신청이 있으면 그대로 이어서 결제 (쿠폰은 처음 신청 때 정해짐)
  select id into v_id from public.bookings
   where session_id = s.id and user_id = v_user and status = 'pending_payment';
  if found then
    return v_id;
  end if;
  if exists (select 1 from public.bookings where session_id = s.id and user_id = v_user and status = 'confirmed') then
    raise exception '이미 신청한 일정입니다' using errcode = 'P0001', hint = 'duplicate';
  end if;
  if s.reserved_count + p_quantity > s.capacity then
    raise exception '남은 자리가 부족합니다 (남은 자리 %명)', s.capacity - s.reserved_count
      using errcode = 'P0001', hint = 'full';
  end if;

  v_gross := m.price * p_quantity;
  if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
    select cd.o_coupon_id, cd.o_discount into v_coupon, v_discount
      from private.coupon_discount(p_coupon_code, v_user, m.id, v_gross) cd;
  end if;
  v_total := v_gross - v_discount;

  if v_total = 0 then
    insert into public.bookings (session_id, user_id, quantity, unit_price, total_price, status)
    values (s.id, v_user, p_quantity, m.price, 0, 'confirmed') returning id into v_id;
    update public.meetup_sessions set reserved_count = reserved_count + p_quantity where id = s.id;
    perform private.notify(v_user, 'booking.confirmed', '참가 신청이 확정되었어요', m.title, '/me/bookings');
    perform private.notify(m.host_id, 'host.new_booking', '새 참가 신청이 있어요', m.title, '/host/meetups/' || m.id);
  else
    insert into public.bookings (session_id, user_id, quantity, unit_price, total_price, status, hold_expires_at, coupon_id, discount_amount)
    values (s.id, v_user, p_quantity, m.price, v_total, 'pending_payment', now() + interval '10 minutes', v_coupon, v_discount)
    returning id into v_id;
    update public.meetup_sessions set reserved_count = reserved_count + p_quantity where id = s.id;
    insert into public.payments (booking_id, order_id, amount)
    values (v_id, 'G' || replace(gen_random_uuid()::text, '-', ''), v_total);
    insert into public.payment_events (payment_id, kind, amount, detail)
      select id, 'created', v_total,
             case when v_coupon is null then '{}'::jsonb else jsonb_build_object('coupon_id', v_coupon, 'discount', v_discount) end
        from public.payments where booking_id = v_id;
  end if;
  return v_id;
end;
$$;

------------------------------------------------------------------------------
-- 2. 호스트: 열림 시각 정하기·지우기
------------------------------------------------------------------------------
create function public.host_set_session_opens_at(p_session_id uuid, p_opens_at timestamptz)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
begin
  select ms.* into s from public.meetup_sessions ms
   where ms.id = p_session_id and private.owns_editable_meetup(ms.meetup_id) for update;
  if not found then
    raise exception '일정을 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if s.status <> 'open' or s.starts_at <= now() then
    raise exception '지난 일정이거나 모집 중이 아닌 일정이에요' using errcode = '22023';
  end if;
  if p_opens_at is not null then
    if p_opens_at <= now() then
      raise exception '열림 시각은 지금보다 뒤여야 해요' using errcode = '22023';
    end if;
    if p_opens_at >= s.starts_at then
      raise exception '열림 시각은 프로그램 시작보다 앞이어야 해요' using errcode = '22023';
    end if;
    if s.reserved_count > 0 then
      raise exception '이미 신청한 사람이 있는 일정은 열림 시각을 정할 수 없어요' using errcode = '22023';
    end if;
  end if;
  update public.meetup_sessions
     set opens_at = p_opens_at, open_reminded_at = null, open_notified_at = null
   where id = s.id;
  return p_opens_at;
end;
$$;
revoke all on function public.host_set_session_opens_at(uuid, timestamptz) from public, anon;
grant execute on function public.host_set_session_opens_at(uuid, timestamptz) to authenticated;

------------------------------------------------------------------------------
-- 3. 열리면 알림 받기 (참가자) — 표 직접 접근 없음, 함수로만
------------------------------------------------------------------------------
create table public.session_open_alerts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null references public.meetup_sessions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, session_id)
);
create index session_open_alerts_session_idx on public.session_open_alerts (session_id);
alter table public.session_open_alerts enable row level security;
revoke all on public.session_open_alerts from public, anon, authenticated;

create function public.set_open_alert(p_session_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active_member() then
    raise exception 'forbidden: 로그인이 필요합니다' using errcode = '42501';
  end if;
  if p_on then
    if not exists (
      select 1 from public.meetup_sessions s join public.meetups m on m.id = s.meetup_id
       where s.id = p_session_id and s.status = 'open' and s.opens_at is not null and s.opens_at > now()
         and m.status = 'published' and not m.is_sample) then
      raise exception '아직 열리지 않은 일정만 알림을 받을 수 있어요' using errcode = '22023';
    end if;
    insert into public.session_open_alerts (user_id, session_id) values (auth.uid(), p_session_id) on conflict do nothing;
  else
    delete from public.session_open_alerts where user_id = auth.uid() and session_id = p_session_id;
  end if;
end;
$$;
revoke all on function public.set_open_alert(uuid, boolean) from public, anon;
grant execute on function public.set_open_alert(uuid, boolean) to authenticated;

-- 내가 알림을 건, 아직 열리지 않은 일정
create function public.my_open_alerts()
returns table (session_id uuid, meetup_id uuid, title text, starts_at timestamptz, opens_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, m.id, m.title, s.starts_at, s.opens_at
    from public.session_open_alerts a
    join public.meetup_sessions s on s.id = a.session_id
    join public.meetups m on m.id = s.meetup_id
   where a.user_id = auth.uid() and s.opens_at is not null and s.opens_at > now()
     and s.status = 'open' and m.status = 'published'
   order by s.opens_at
   limit 50
$$;
revoke all on function public.my_open_alerts() from public, anon;
grant execute on function public.my_open_alerts() to authenticated;

------------------------------------------------------------------------------
-- 4. 알림 보내기 (DB 예약 작업, 매분)
--   열리기 1시간 전: 알림 신청자 / 열린 순간: 알림 신청자 + 팔로워 (활동 중인 회원만, 일정당 한 번)
------------------------------------------------------------------------------
create function private.send_open_alerts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  u record;
  v_count integer := 0;
begin
  -- 열리기 1시간 전
  for r in
    select s.id, s.opens_at, m.id as meetup_id, m.title
      from public.meetup_sessions s
      join public.meetups m on m.id = s.meetup_id
     where s.opens_at is not null and s.open_reminded_at is null and s.status = 'open'
       and m.status = 'published' and not m.is_sample
       and s.opens_at > now() and s.opens_at <= now() + interval '1 hour'
     for update of s skip locked
  loop
    for u in
      select a.user_id from public.session_open_alerts a
        join public.profiles p on p.id = a.user_id and p.status = 'active'
       where a.session_id = r.id
    loop
      perform private.notify(u.user_id, 'drop.soon', '곧 열리는 원이 있어요',
        left(r.title, 40) || ' · ' || to_char(r.opens_at at time zone 'Asia/Seoul', 'HH24:MI') || '에 열려요',
        '/meetups/' || r.meetup_id);
      v_count := v_count + 1;
    end loop;
    update public.meetup_sessions set open_reminded_at = now() where id = r.id;
  end loop;

  -- 열린 순간 (너무 오래 지난 건 보내지 않고 표시만)
  for r in
    select s.id, s.opens_at, s.starts_at, m.id as meetup_id, m.title, m.host_id
      from public.meetup_sessions s
      join public.meetups m on m.id = s.meetup_id
     where s.opens_at is not null and s.open_notified_at is null and s.status = 'open'
       and m.status = 'published' and not m.is_sample
       and s.opens_at <= now() and s.starts_at > now()
     for update of s skip locked
  loop
    if r.opens_at > now() - interval '1 day' then
      for u in
        select x.user_id from (
          select a.user_id from public.session_open_alerts a where a.session_id = r.id
          union
          select f.follower_id from public.host_follows f where f.host_id = r.host_id
        ) x
        join public.profiles p on p.id = x.user_id and p.status = 'active'
        where x.user_id <> r.host_id
      loop
        perform private.notify(u.user_id, 'drop.opened', '원이 열렸어요',
          left(r.title, 40) || ' · 지금 신청할 수 있어요',
          '/meetups/' || r.meetup_id);
        v_count := v_count + 1;
      end loop;
    end if;
    update public.meetup_sessions set open_notified_at = now() where id = r.id;
  end loop;
  return v_count;
end;
$$;
revoke all on function private.send_open_alerts() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'roundi-open-alerts') then
    perform cron.unschedule('roundi-open-alerts');
  end if;
  perform cron.schedule('roundi-open-alerts', '* * * * *', 'select private.send_open_alerts()');
end $$;
