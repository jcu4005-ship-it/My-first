-- ============================================================================
-- 테스트 결제·환불, 알림, 호스트 일정 취소, 회원 탈퇴
--  - 결제는 테스트 모드만 (DB 제약으로 live 차단)
--  - 결제 확정·환불 기록은 서버 비밀키(service_role)로만 호출 가능
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 알림
-- ---------------------------------------------------------------------------
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete restrict,
  kind text not null,
  title text not null,
  body text not null default '',
  link text check (link is null or link ~ '^/'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select (id, user_id, kind, title, body, link, read_at, created_at) on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function private.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, link) values (p_user, p_kind, p_title, coalesce(p_body, ''), p_link);
$$;
revoke all on function private.notify(uuid, text, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. 결제 (테스트 모드)
-- ---------------------------------------------------------------------------
create type public.payment_status as enum ('ready', 'paid', 'cancelled', 'refunded', 'failed');

alter table public.bookings add column hold_expires_at timestamptz;

drop index public.bookings_one_active_per_user;
create unique index bookings_one_active_per_user on public.bookings (session_id, user_id)
  where status in ('confirmed', 'pending_payment');

grant select (hold_expires_at) on public.bookings to authenticated;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete restrict,
  order_id text not null unique,
  provider text check (provider in ('mock', 'tosspayments')),
  mode text not null default 'test' check (mode = 'test'), -- 실결제(live)는 DB에서도 차단
  amount integer not null check (amount > 0),
  status public.payment_status not null default 'ready',
  payment_key text unique,
  approved_at timestamptz,
  refunded_amount integer not null default 0 check (refunded_amount >= 0),
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_refund_le_amount check (refunded_amount <= amount)
);
create trigger payments_set_updated_at before update on public.payments
  for each row execute function private.set_updated_at();

create table public.payment_events (
  id bigint generated always as identity primary key,
  payment_id uuid not null references public.payments (id) on delete restrict,
  kind text not null,               -- created, paid, refunded, cancelled, expired
  amount integer not null default 0,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create trigger payment_events_append_only before update or delete on public.payment_events
  for each row execute function private.block_mutation();

alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
revoke all on public.payments, public.payment_events from public, anon, authenticated;
grant select (id, booking_id, order_id, provider, mode, amount, status, approved_at, refunded_amount, refunded_at, created_at)
  on public.payments to authenticated;
grant select on public.payment_events to authenticated;

create policy payments_select_own_admin on public.payments
  for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = (select auth.uid()))
         or (select private.is_admin()));
create policy payment_events_select_admin on public.payment_events
  for select to authenticated using ((select private.is_admin()));

-- 만료된 결제 대기 신청 정리 (자리 반환)
create function private.expire_holds(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select id, quantity from public.bookings
    where session_id = p_session_id and status = 'pending_payment' and hold_expires_at <= now()
    for update
  loop
    update public.bookings set status = 'expired', cancelled_at = now() where id = r.id;
    update public.meetup_sessions set reserved_count = reserved_count - r.quantity where id = p_session_id;
    update public.payments set status = 'cancelled' where booking_id = r.id and status = 'ready';
    insert into public.payment_events (payment_id, kind)
      select id, 'expired' from public.payments where booking_id = r.id;
  end loop;
end;
$$;

-- 신청: 무료는 즉시 확정, 유료는 10분간 자리를 잡고 결제 대기
create or replace function public.book_session(p_session_id uuid, p_quantity integer)
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
  v_total integer;
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
  if p_quantity is null or p_quantity < 1 or p_quantity > m.max_quantity_per_booking then
    raise exception '한 번에 1~%명까지 신청할 수 있습니다', m.max_quantity_per_booking
      using errcode = 'P0001', hint = 'quantity';
  end if;

  -- 같은 일정에 결제 대기 중인 내 신청이 있으면 그대로 이어서 결제
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

  v_total := m.price * p_quantity;
  if v_total = 0 then
    insert into public.bookings (session_id, user_id, quantity, unit_price, total_price, status)
    values (s.id, v_user, p_quantity, m.price, 0, 'confirmed') returning id into v_id;
    update public.meetup_sessions set reserved_count = reserved_count + p_quantity where id = s.id;
    perform private.notify(v_user, 'booking.confirmed', '참가 신청이 확정되었어요', m.title, '/me/bookings');
    perform private.notify(m.host_id, 'host.new_booking', '새 참가 신청이 있어요', m.title, '/host/meetups/' || m.id);
  else
    insert into public.bookings (session_id, user_id, quantity, unit_price, total_price, status, hold_expires_at)
    values (s.id, v_user, p_quantity, m.price, v_total, 'pending_payment', now() + interval '10 minutes')
    returning id into v_id;
    update public.meetup_sessions set reserved_count = reserved_count + p_quantity where id = s.id;
    insert into public.payments (booking_id, order_id, amount)
    values (v_id, 'G' || replace(gen_random_uuid()::text, '-', ''), v_total);
    insert into public.payment_events (payment_id, kind, amount)
      select id, 'created', v_total from public.payments where booking_id = v_id;
  end if;
  return v_id;
end;
$$;

-- 결제 확정 (서버 비밀키 전용) — 금액은 DB 금액과 일치해야 함
-- 반환: 'confirmed' 또는 'expired'(결제 시간 초과 → 신청 만료·자리 반환, 서버는 PG 승인을 취소해야 함)
create function public.confirm_payment(p_booking_id uuid, p_provider text, p_payment_key text, p_amount integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  b record;
  p record;
  v_title text;
  v_host uuid;
  v_meetup uuid;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception '신청을 찾을 수 없습니다' using errcode = 'P0002', hint = 'not_found';
  end if;
  select * into p from public.payments where booking_id = b.id for update;
  if b.status = 'confirmed' and p.status = 'paid' and p.payment_key = p_payment_key then
    return 'confirmed'; -- 같은 결제의 중복 확정 요청은 무시 (멱등)
  end if;
  if b.status <> 'pending_payment' or p.status <> 'ready' then
    raise exception '결제할 수 없는 상태입니다' using errcode = 'P0001', hint = 'invalid_state';
  end if;
  if b.hold_expires_at <= now() then
    perform private.expire_holds(b.session_id);
    return 'expired';
  end if;
  if p_amount is distinct from p.amount then
    raise exception '결제 금액이 일치하지 않습니다' using errcode = 'P0001', hint = 'amount_mismatch';
  end if;

  update public.payments set status = 'paid', provider = p_provider, payment_key = p_payment_key, approved_at = now()
   where id = p.id;
  update public.bookings set status = 'confirmed', hold_expires_at = null where id = b.id;
  insert into public.payment_events (payment_id, kind, amount, detail)
  values (p.id, 'paid', p_amount, jsonb_build_object('provider', p_provider));

  select m.title, m.host_id, m.id into v_title, v_host, v_meetup
    from public.meetup_sessions s join public.meetups m on m.id = s.meetup_id where s.id = b.session_id;
  perform private.notify(b.user_id, 'booking.confirmed', '결제가 완료되어 참가가 확정되었어요', v_title, '/me/bookings');
  perform private.notify(v_host, 'host.new_booking', '새 참가 신청이 있어요', v_title, '/host/meetups/' || v_meetup);
  return 'confirmed';
end;
$$;

-- 환불 기록 + 신청 취소 (서버 비밀키 전용, PG 환불 성공 후 호출)
create function public.refund_booking(p_booking_id uuid, p_actor uuid, p_cancel_status public.booking_status, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  b record;
  s record;
  p record;
  v_title text;
  v_host uuid;
begin
  if p_cancel_status not in ('cancelled_by_user', 'cancelled_by_host') then
    raise exception '잘못된 취소 유형입니다' using errcode = '22023';
  end if;
  select * into b from public.bookings where id = p_booking_id;
  if not found then
    raise exception '신청을 찾을 수 없습니다' using errcode = 'P0002', hint = 'not_found';
  end if;
  select * into s from public.meetup_sessions where id = b.session_id for update;
  select * into b from public.bookings where id = p_booking_id for update;
  select m.title, m.host_id into v_title, v_host from public.meetups m where m.id = s.meetup_id;

  if p_cancel_status = 'cancelled_by_user' and (b.user_id <> p_actor or s.starts_at <= now()) then
    raise exception '취소할 수 없는 신청입니다' using errcode = '42501', hint = 'forbidden';
  end if;
  if p_cancel_status = 'cancelled_by_host' and v_host <> p_actor then
    raise exception '취소할 수 없는 신청입니다' using errcode = '42501', hint = 'forbidden';
  end if;
  if b.status <> 'confirmed' then
    raise exception '이미 취소된 신청입니다' using errcode = 'P0001', hint = 'already_cancelled';
  end if;
  select * into p from public.payments where booking_id = b.id and status = 'paid' for update;
  if not found then
    raise exception '환불할 결제가 없습니다' using errcode = 'P0001', hint = 'no_payment';
  end if;

  update public.payments set status = 'refunded', refunded_amount = amount, refunded_at = now() where id = p.id;
  insert into public.payment_events (payment_id, kind, amount, detail)
  values (p.id, 'refunded', p.amount, jsonb_build_object('reason', p_reason, 'by', p_cancel_status));
  update public.bookings set status = p_cancel_status, cancelled_at = now() where id = b.id;
  update public.meetup_sessions set reserved_count = reserved_count - b.quantity where id = s.id;

  if p_cancel_status = 'cancelled_by_user' then
    perform private.notify(b.user_id, 'booking.refunded', '신청이 취소되고 환불되었어요', v_title || ' · ' || p.amount || '원 (테스트 결제)', '/me/bookings');
    perform private.notify(v_host, 'host.booking_cancelled', '참가 신청이 취소되었어요', v_title, '/host/meetups/' || s.meetup_id);
  else
    perform private.notify(b.user_id, 'booking.cancelled_by_host', '호스트가 일정을 취소해 전액 환불되었어요',
      v_title || coalesce(' · 사유: ' || nullif(btrim(p_reason), ''), ''), '/me/bookings');
  end if;
  return p.amount;
end;
$$;

-- 참가자 취소 (무료·결제 대기). 결제 완료 신청은 서버의 환불 절차로
create or replace function public.cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b record;
  s record;
  v_title text;
  v_host uuid;
begin
  select * into b from public.bookings where id = p_booking_id and user_id = auth.uid();
  if not found then
    raise exception '신청 내역을 찾을 수 없습니다' using errcode = 'P0002', hint = 'not_found';
  end if;
  select * into s from public.meetup_sessions where id = b.session_id for update;
  select * into b from public.bookings where id = p_booking_id for update;
  if b.status not in ('confirmed', 'pending_payment') then
    raise exception '이미 취소된 신청입니다' using errcode = 'P0001', hint = 'already_cancelled';
  end if;
  if b.status = 'confirmed' and exists (select 1 from public.payments where booking_id = b.id and status = 'paid') then
    raise exception '결제한 신청은 환불 절차로 취소됩니다' using errcode = 'P0001', hint = 'refund_required';
  end if;
  if s.starts_at <= now() then
    raise exception '시작된 모임은 취소할 수 없습니다' using errcode = 'P0001', hint = 'started';
  end if;
  update public.bookings set status = 'cancelled_by_user', cancelled_at = now() where id = b.id;
  update public.meetup_sessions set reserved_count = reserved_count - b.quantity where id = s.id;
  update public.payments set status = 'cancelled' where booking_id = b.id and status = 'ready';
  if b.status = 'confirmed' then
    select m.title, m.host_id into v_title, v_host from public.meetups m where m.id = s.meetup_id;
    perform private.notify(v_host, 'host.booking_cancelled', '참가 신청이 취소되었어요', v_title, '/host/meetups/' || s.meetup_id);
  end if;
end;
$$;

-- 호스트: 신청자가 있는 일정 취소 (결제 완료 건은 서버가 먼저 환불해야 함)
create function public.host_cancel_session(p_session_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  r record;
  v_title text;
begin
  select ms.* into s from public.meetup_sessions ms
   where ms.id = p_session_id and private.owns_editable_meetup(ms.meetup_id) for update;
  if not found then
    raise exception '일정을 찾을 수 없습니다' using errcode = 'P0002', hint = 'not_found';
  end if;
  if s.status = 'cancelled' then
    return;
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception '참가자에게 보낼 취소 사유를 5자 이상 입력하세요' using errcode = '22023', hint = 'reason';
  end if;
  if exists (select 1 from public.bookings b join public.payments p on p.booking_id = b.id
             where b.session_id = s.id and b.status = 'confirmed' and p.status = 'paid') then
    raise exception '결제 완료된 신청의 환불이 먼저 필요합니다' using errcode = 'P0001', hint = 'refund_required';
  end if;
  select title into v_title from public.meetups where id = s.meetup_id;

  for r in select id, user_id, status from public.bookings
            where session_id = s.id and status in ('confirmed', 'pending_payment') for update loop
    update public.bookings set status = 'cancelled_by_host', cancelled_at = now() where id = r.id;
    update public.payments set status = 'cancelled' where booking_id = r.id and status = 'ready';
    if r.status = 'confirmed' then
      perform private.notify(r.user_id, 'booking.cancelled_by_host', '호스트가 일정을 취소했어요',
        v_title || ' · 사유: ' || btrim(p_reason), '/me/bookings');
    end if;
  end loop;
  update public.meetup_sessions set status = 'cancelled', reserved_count = 0 where id = s.id;
end;
$$;

-- 호스트용: 일정의 결제 완료 신청 (서버 환불 처리용)
create function public.host_session_paid_bookings(p_session_id uuid)
returns table (booking_id uuid, amount integer, payment_key text, provider text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, p.amount, p.payment_key, p.provider
  from public.bookings b
  join public.payments p on p.booking_id = b.id
  join public.meetup_sessions s on s.id = b.session_id
  where b.session_id = p_session_id and b.status = 'confirmed' and p.status = 'paid'
    and private.owns_editable_meetup(s.meetup_id)
$$;

-- 내 결제 정보 (결제 화면·환불용)
create function public.my_booking_payment(p_booking_id uuid)
returns table (booking_id uuid, booking_status public.booking_status, hold_expires_at timestamptz, quantity smallint,
               order_id text, amount integer, payment_status public.payment_status, payment_key text, provider text,
               meetup_id uuid, title text, starts_at timestamptz, area text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.status, b.hold_expires_at, b.quantity, p.order_id, p.amount, p.status, p.payment_key, p.provider,
         m.id, m.title, s.starts_at, s.area
  from public.bookings b
  join public.payments p on p.booking_id = b.id
  join public.meetup_sessions s on s.id = b.session_id
  join public.meetups m on m.id = s.meetup_id
  where b.id = p_booking_id and b.user_id = auth.uid()
$$;

-- 내 신청 내역에 결제 상태 추가
drop function public.my_bookings();
create function public.my_bookings()
returns table (
  booking_id uuid, status public.booking_status, quantity smallint, total_price integer,
  created_at timestamptz, cancelled_at timestamptz, hold_expires_at timestamptz,
  session_id uuid, starts_at timestamptz, ends_at timestamptz, area text, venue_name text, address_detail text,
  meetup_id uuid, title text, category_slug text, is_sample boolean, host_id uuid, host_name text,
  payment_status public.payment_status, refunded_amount integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.status, b.quantity, b.total_price, b.created_at, b.cancelled_at, b.hold_expires_at,
         s.id, s.starts_at, s.ends_at, s.area, s.venue_name,
         case when b.status = 'confirmed' then s.address_detail end,
         m.id, m.title, m.category_slug, m.is_sample, h.user_id, h.display_name,
         p.status, p.refunded_amount
  from public.bookings b
  join public.meetup_sessions s on s.id = b.session_id
  join public.meetups m on m.id = s.meetup_id
  join public.host_profiles h on h.user_id = m.host_id
  left join public.payments p on p.booking_id = b.id
  where b.user_id = auth.uid() and b.status <> 'expired'
    and not (b.status = 'pending_payment' and b.hold_expires_at <= now())
  order by s.starts_at desc
$$;

-- ---------------------------------------------------------------------------
-- 3. 심사 결과 알림 (기존 함수에 알림 추가)
-- ---------------------------------------------------------------------------
create function private.notify_host_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'approved' then
      perform private.notify(new.user_id, 'host.approved', '호스트 신청이 승인되었어요', '이제 모임을 만들 수 있어요.', '/host');
    elsif new.status = 'rejected' then
      perform private.notify(new.user_id, 'host.rejected', '호스트 신청이 반려되었어요', coalesce(new.review_note, ''), '/host/apply');
    end if;
  end if;
  return new;
end;
$$;
create trigger host_profiles_notify_review after update of status on public.host_profiles
  for each row execute function private.notify_host_review();

create function private.notify_meetup_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.status in ('published', 'rejected', 'suspended') and not new.is_sample then
    perform private.notify(new.host_id, 'meetup.' || new.status::text,
      case new.status when 'published' then '모임이 공개되었어요'
                      when 'rejected' then '모임 검수가 반려되었어요'
                      else '모임이 운영 정지되었어요' end,
      new.title || coalesce(' · ' || new.review_note, ''), '/host/meetups/' || new.id);
  end if;
  return new;
end;
$$;
create trigger meetups_notify_review after update of status on public.meetups
  for each row execute function private.notify_meetup_review();

-- ---------------------------------------------------------------------------
-- 4. 회원 탈퇴 (개인정보 삭제·익명화, 로그인 차단)
--    보관: 거래(신청·결제) 기록, 동의 이력, 감사 기록 — 익명화된 회원 ID로만 연결
-- ---------------------------------------------------------------------------
create function public.withdraw_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  r record;
begin
  if v_user is null or not exists (select 1 from public.profiles where id = v_user and status <> 'withdrawn') then
    raise exception '로그인이 필요합니다' using errcode = '42501', hint = 'login_required';
  end if;
  if exists (select 1 from public.user_roles where user_id = v_user and role = 'admin')
     and (select count(*) from public.user_roles where role = 'admin') = 1 then
    raise exception '마지막 관리자는 탈퇴할 수 없습니다' using errcode = 'P0001', hint = 'last_admin';
  end if;
  if exists (select 1 from public.bookings b join public.payments p on p.booking_id = b.id
              join public.meetup_sessions s on s.id = b.session_id
             where b.user_id = v_user and b.status = 'confirmed' and p.status = 'paid' and s.starts_at > now()) then
    raise exception '결제한 예정 모임의 환불이 먼저 필요합니다' using errcode = 'P0001', hint = 'refund_required';
  end if;
  if exists (select 1 from public.bookings b join public.meetup_sessions s on s.id = b.session_id
              join public.meetups m on m.id = s.meetup_id
             where m.host_id = v_user and b.status in ('confirmed', 'pending_payment') and s.starts_at > now()) then
    raise exception '참가자가 있는 내 모임 일정을 먼저 취소해 주세요' using errcode = 'P0001', hint = 'host_active';
  end if;

  -- 내 예정 신청(무료·결제 대기) 취소, 자리 반환
  for r in select b.id, b.session_id, b.quantity from public.bookings b
            join public.meetup_sessions s on s.id = b.session_id
           where b.user_id = v_user and b.status in ('confirmed', 'pending_payment') and s.starts_at > now()
           for update of b loop
    update public.bookings set status = 'cancelled_by_user', cancelled_at = now() where id = r.id;
    update public.meetup_sessions set reserved_count = reserved_count - r.quantity where id = r.session_id;
    update public.payments set status = 'cancelled' where booking_id = r.id and status = 'ready';
  end loop;

  -- 호스트: 모임 비공개, 프로필 익명화
  update public.meetups set status = 'archived'
   where host_id = v_user and status in ('draft', 'pending_review', 'published', 'rejected');
  update public.meetup_sessions set status = 'cancelled'
   where meetup_id in (select id from public.meetups where host_id = v_user) and status in ('open', 'closed') and starts_at > now();
  update public.host_profiles
     set display_name = '탈퇴한 호스트', headline = '', bio = '', expertise = '{}', instagram_handle = null, status = 'suspended'
   where user_id = v_user;

  -- 개인정보 삭제·익명화
  update public.profiles
     set nickname = '탈퇴회원 ' || substr(replace(v_user::text, '-', ''), 1, 10), bio = null, avatar_url = null, status = 'withdrawn'
   where id = v_user;
  update public.profile_private
     set phone = null, birth_year = null, interests = '{}', adult_verified_at = null
   where user_id = v_user;
  delete from public.user_roles where user_id = v_user and role in ('host', 'admin');
  delete from public.notifications where user_id = v_user;

  -- 로그인 정보 삭제·차단 (이메일 익명화로 같은 이메일 재가입 가능)
  update auth.users
     set email = 'withdrawn+' || replace(v_user::text, '-', '') || '@deleted.invalid',
         phone = null, raw_user_meta_data = '{}'::jsonb, encrypted_password = '',
         banned_until = 'infinity'::timestamptz
   where id = v_user;
  delete from auth.identities where user_id = v_user;
  delete from auth.mfa_factors where user_id = v_user;
  delete from auth.sessions where user_id = v_user;

  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, reason)
  values (v_user, 'system', 'member.withdraw', 'member', v_user, '본인 탈퇴');
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. 함수 권한
-- ---------------------------------------------------------------------------
revoke all on function private.expire_holds(uuid) from public, anon, authenticated;
revoke all on function private.notify_host_review() from public, anon, authenticated;
revoke all on function private.notify_meetup_review() from public, anon, authenticated;

revoke all on function public.confirm_payment(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.refund_booking(uuid, uuid, public.booking_status, text) from public, anon, authenticated;
grant execute on function public.confirm_payment(uuid, text, text, integer) to service_role;
grant execute on function public.refund_booking(uuid, uuid, public.booking_status, text) to service_role;

revoke all on function public.host_cancel_session(uuid, text) from public, anon;
revoke all on function public.host_session_paid_bookings(uuid) from public, anon;
revoke all on function public.my_booking_payment(uuid) from public, anon;
revoke all on function public.my_bookings() from public, anon;
revoke all on function public.withdraw_my_account() from public, anon;
grant execute on function public.host_cancel_session(uuid, text) to authenticated;
grant execute on function public.host_session_paid_bookings(uuid) to authenticated;
grant execute on function public.my_booking_payment(uuid) to authenticated;
grant execute on function public.my_bookings() to authenticated;
grant execute on function public.withdraw_my_account() to authenticated;
