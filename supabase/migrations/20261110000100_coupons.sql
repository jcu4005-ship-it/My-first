-- ============================================================================
-- 참가자 할인 쿠폰 (첫 1년: Gathering 수수료 0, 할인은 호스트 부담)
--  - 쿠폰은 운영팀(관리자, 2단계 인증)만 만들고 끌 수 있음. 감사 기록
--  - 할인율은 1~10% (DB 제약으로 10% 초과 불가)
--  - 호스트가 프로그램마다 "쿠폰 허용"에 동의해야만 적용 (동의·철회 시각과 감사 기록)
--  - 금액 계산은 DB 신청 함수에서만: 정가 × 인원 − 할인 (10원 단위 내림)
--  - 한 사람은 같은 쿠폰을 한 번만 (진행 중·확정 신청 기준), 사용 한도·기간·첫 참여 전용 옵션
--  - 쿠폰 목록·코드는 관리자만 조회. 참가자는 코드를 입력해 미리보기·적용만 가능
-- ============================================================================

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9-]{2,18}[A-Z0-9]$'),
  name text not null check (char_length(name) between 2 and 40),
  percent_off smallint not null check (percent_off between 1 and 10),
  first_booking_only boolean not null default false,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
alter table public.coupons enable row level security;
revoke all on public.coupons from anon, authenticated;
grant select on public.coupons to authenticated;
create policy coupons_select_admin on public.coupons
  for select to authenticated using ((select private.is_admin()));

-- 프로그램별 호스트 동의
alter table public.meetups
  add column accept_coupons boolean not null default false,
  add column coupons_consented_at timestamptz;
grant select (accept_coupons) on public.meetups to anon, authenticated;
grant select (coupons_consented_at) on public.meetups to authenticated;

-- 신청에 쿠폰·할인 기록
alter table public.bookings
  add column coupon_id uuid references public.coupons (id) on delete restrict,
  add column discount_amount integer not null default 0 check (discount_amount >= 0);
alter table public.bookings drop constraint bookings_total;
alter table public.bookings add constraint bookings_total
  check (total_price = unit_price * quantity - discount_amount and discount_amount * 10 <= unit_price * quantity);
grant select (coupon_id, discount_amount) on public.bookings to authenticated;
create unique index bookings_one_coupon_per_user on public.bookings (coupon_id, user_id)
  where coupon_id is not null and status in ('confirmed', 'pending_payment');

-- ---------------------------------------------------------------------------
-- 쿠폰 확인 (신청 함수·미리보기 공용). 할인액을 돌려주고, 쓸 수 없으면 이유와 함께 오류
-- ---------------------------------------------------------------------------
create function private.coupon_discount(p_code text, p_user uuid, p_meetup_id uuid, p_gross integer, out o_coupon_id uuid, out o_discount integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.coupons;
  m record;
begin
  select * into c from public.coupons where code = upper(trim(p_code));
  if not found or not c.is_active or c.starts_at > now() or (c.ends_at is not null and c.ends_at <= now()) then
    raise exception '사용할 수 없는 쿠폰이에요' using errcode = 'P0001', hint = 'coupon_invalid';
  end if;
  select accept_coupons, price into m from public.meetups where id = p_meetup_id;
  if not coalesce(m.accept_coupons, false) then
    raise exception '이 프로그램은 쿠폰을 받지 않아요' using errcode = 'P0001', hint = 'coupon_not_allowed';
  end if;
  if p_gross <= 0 then
    raise exception '무료 프로그램에는 쿠폰을 쓸 수 없어요' using errcode = 'P0001', hint = 'coupon_free';
  end if;
  if exists (select 1 from public.bookings where coupon_id = c.id and user_id = p_user and status in ('confirmed', 'pending_payment')) then
    raise exception '이미 사용한 쿠폰이에요' using errcode = 'P0001', hint = 'coupon_used';
  end if;
  if c.first_booking_only and exists (select 1 from public.bookings where user_id = p_user and status = 'confirmed') then
    raise exception '첫 참여 때만 쓸 수 있는 쿠폰이에요' using errcode = 'P0001', hint = 'coupon_first_only';
  end if;
  if c.max_redemptions is not null and (
    select count(*) from public.bookings where coupon_id = c.id and status in ('confirmed', 'pending_payment')
  ) >= c.max_redemptions then
    raise exception '쿠폰이 모두 소진되었어요' using errcode = 'P0001', hint = 'coupon_exhausted';
  end if;
  o_coupon_id := c.id;
  o_discount := (p_gross * c.percent_off / 100 / 10) * 10; -- 10원 단위 내림
end;
$$;
revoke all on function private.coupon_discount(text, uuid, uuid, integer) from public, anon, authenticated;

-- 참가자: 신청 전 할인 미리보기 (신청 화면용, 금액만 돌려줌)
create function public.preview_coupon(p_session_id uuid, p_quantity integer, p_code text)
returns table (percent_off smallint, gross integer, discount integer, total integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_meetup uuid;
  v_price integer;
  r record;
begin
  if auth.uid() is null or not private.is_active_member() then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  select m.id, m.price into v_meetup, v_price
    from public.meetup_sessions s join public.meetups m on m.id = s.meetup_id
   where s.id = p_session_id and m.status = 'published';
  if not found then
    raise exception '일정을 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 4 then
    raise exception '인원을 확인해 주세요' using errcode = 'P0001';
  end if;
  select * into r from private.coupon_discount(p_code, auth.uid(), v_meetup, v_price * p_quantity);
  return query select (select c.percent_off from public.coupons c where c.id = r.o_coupon_id),
                      v_price * p_quantity, r.o_discount, v_price * p_quantity - r.o_discount;
end;
$$;
revoke all on function public.preview_coupon(uuid, integer, text) from public, anon;
grant execute on function public.preview_coupon(uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 신청: 기존 동작 그대로 + 쿠폰 (선택)
-- ---------------------------------------------------------------------------
drop function public.book_session(uuid, integer);
create function public.book_session(p_session_id uuid, p_quantity integer, p_coupon_code text default null)
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
revoke all on function public.book_session(uuid, integer, text) from public, anon;
grant execute on function public.book_session(uuid, integer, text) to authenticated;

-- 결제 화면: 정가·할인도 함께
drop function public.my_booking_payment(uuid);
create function public.my_booking_payment(p_booking_id uuid)
returns table (booking_id uuid, booking_status public.booking_status, hold_expires_at timestamptz, quantity smallint,
               order_id text, amount integer, payment_status public.payment_status,
               meetup_id uuid, title text, starts_at timestamptz, area text,
               gross_amount integer, discount_amount integer, coupon_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.status, b.hold_expires_at, b.quantity, p.order_id, p.amount, p.status,
         m.id, m.title, s.starts_at, s.area,
         b.unit_price * b.quantity, b.discount_amount, c.name
  from public.bookings b
  join public.payments p on p.booking_id = b.id
  join public.meetup_sessions s on s.id = b.session_id
  join public.meetups m on m.id = s.meetup_id
  left join public.coupons c on c.id = b.coupon_id
  where b.id = p_booking_id and b.user_id = auth.uid()
$$;
revoke all on function public.my_booking_payment(uuid) from public, anon;
grant execute on function public.my_booking_payment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 호스트: 프로그램별 쿠폰 허용 동의 / 철회 (이미 받은 신청에는 영향 없음)
-- ---------------------------------------------------------------------------
create function public.host_set_coupon_consent(p_meetup_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
begin
  if not private.is_approved_host() then
    raise exception '승인된 호스트만 할 수 있습니다' using errcode = '42501';
  end if;
  select id, accept_coupons into m from public.meetups where id = p_meetup_id and host_id = auth.uid() for update;
  if not found then
    raise exception '프로그램을 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if m.accept_coupons = coalesce(p_accept, false) then
    return;
  end if;
  update public.meetups
     set accept_coupons = coalesce(p_accept, false),
         coupons_consented_at = case when p_accept then now() else null end
   where id = p_meetup_id;
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after)
  values (auth.uid(), 'member', case when p_accept then 'meetup.coupon_consent' else 'meetup.coupon_withdraw' end,
          'meetup', p_meetup_id, jsonb_build_object('accept_coupons', m.accept_coupons), jsonb_build_object('accept_coupons', coalesce(p_accept, false)));
end;
$$;
revoke all on function public.host_set_coupon_consent(uuid, boolean) from public, anon;
grant execute on function public.host_set_coupon_consent(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 관리자: 쿠폰 만들기 / 켜고 끄기 (2단계 인증, 감사 기록)
-- ---------------------------------------------------------------------------
create function public.admin_create_coupon(p_code text, p_name text, p_percent smallint, p_first_only boolean,
                                           p_max integer, p_ends_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_code text := upper(trim(coalesce(p_code, '')));
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  if v_code !~ '^[A-Z0-9][A-Z0-9-]{2,18}[A-Z0-9]$' then
    raise exception '쿠폰 코드는 영문 대문자·숫자·하이픈 4~20자로 입력하세요' using errcode = '22023';
  end if;
  if p_percent is null or p_percent < 1 or p_percent > 10 then
    raise exception '할인율은 1~10%%만 가능합니다 (호스트 동의 한도)' using errcode = '22023';
  end if;
  if exists (select 1 from public.coupons where code = v_code) then
    raise exception '이미 있는 쿠폰 코드입니다' using errcode = '22023';
  end if;
  insert into public.coupons (code, name, percent_off, first_booking_only, max_redemptions, ends_at, created_by)
  values (v_code, trim(p_name), p_percent, coalesce(p_first_only, false), p_max, p_ends_at, auth.uid())
  returning id into v_id;
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, after)
  values (auth.uid(), 'admin', 'coupon.create', 'coupon', v_id,
          jsonb_build_object('code', v_code, 'percent_off', p_percent, 'first_booking_only', coalesce(p_first_only, false),
                             'max_redemptions', p_max, 'ends_at', p_ends_at));
  return v_id;
end;
$$;
revoke all on function public.admin_create_coupon(text, text, smallint, boolean, integer, timestamptz) from public, anon;
grant execute on function public.admin_create_coupon(text, text, smallint, boolean, integer, timestamptz) to authenticated;

create function public.admin_set_coupon_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before boolean;
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  select is_active into v_before from public.coupons where id = p_id for update;
  if not found then
    raise exception '쿠폰을 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  update public.coupons set is_active = coalesce(p_active, false) where id = p_id;
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after)
  values (auth.uid(), 'admin', case when p_active then 'coupon.activate' else 'coupon.deactivate' end, 'coupon', p_id,
          jsonb_build_object('is_active', v_before), jsonb_build_object('is_active', coalesce(p_active, false)));
end;
$$;
revoke all on function public.admin_set_coupon_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_coupon_active(uuid, boolean) to authenticated;
