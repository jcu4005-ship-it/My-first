-- 정산: 참가비는 플랫폼 결제로만 받고, 호스트에게는 수수료를 뺀 금액을 정산
-- - 수수료율·수수료 0% 기간은 운영 설정(관리자만 변경, 사유·감사 기록)
-- - 결제가 완료되는 순간의 수수료율을 정산 행에 고정(나중에 설정을 바꿔도 지난 결제는 그대로)
-- - 호스트 승인일로부터 N개월 동안은 0%
-- - 실제 송금은 하지 않음(자동 이체 없음). 관리자가 정산 확정 → 지급 완료를 기록만 함
-- - 지금은 테스트 결제만 있으므로 모든 정산 행도 테스트(mode='test')

alter table public.app_settings
  add column commission_rate_bp integer not null default 2000 check (commission_rate_bp between 0 and 5000),
  add column commission_free_months integer not null default 6 check (commission_free_months between 0 and 24);
grant select (commission_rate_bp, commission_free_months) on public.app_settings to anon, authenticated;

create function public.admin_set_commission(p_rate_bp integer, p_free_months integer, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  old record;
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  if char_length(coalesce(v_reason, '')) < 5 then
    raise exception '사유를 5자 이상 입력하세요' using errcode = '22023';
  end if;
  if p_rate_bp is null or p_rate_bp not between 0 and 5000 then
    raise exception '수수료율은 0~50%% 사이로 입력하세요' using errcode = '22023';
  end if;
  if p_free_months is null or p_free_months not between 0 and 24 then
    raise exception '수수료 0%% 기간은 0~24개월 사이로 입력하세요' using errcode = '22023';
  end if;
  select commission_rate_bp, commission_free_months into old from public.app_settings where id for update;
  update public.app_settings
     set commission_rate_bp = p_rate_bp, commission_free_months = p_free_months, updated_at = now(), updated_by = auth.uid()
   where id;
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, before, after, reason)
  values (auth.uid(), 'admin', 'settings.commission', 'app_settings',
          jsonb_build_object('commission_rate_bp', old.commission_rate_bp, 'commission_free_months', old.commission_free_months),
          jsonb_build_object('commission_rate_bp', p_rate_bp, 'commission_free_months', p_free_months), v_reason);
end;
$$;
revoke all on function public.admin_set_commission(integer, integer, text) from public, anon;
grant execute on function public.admin_set_commission(integer, integer, text) to authenticated;

-- 이 호스트에게 지금 적용될 수수료율 (승인일 + 0% 기간 안이면 0)
create function private.host_commission_bp(p_host uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when now() < coalesce(h.reviewed_at, h.applied_at, now()) + make_interval(months => s.commission_free_months) then 0
    else s.commission_rate_bp
  end
  from public.host_profiles h, public.app_settings s
  where h.user_id = p_host and s.id
$$;
revoke all on function private.host_commission_bp(uuid) from public, anon, authenticated;

create type public.settlement_status as enum ('pending', 'confirmed', 'paid', 'cancelled');

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete restrict,
  payment_id uuid not null unique references public.payments (id) on delete restrict,
  host_id uuid not null references public.profiles (id) on delete restrict,
  mode text not null default 'test' check (mode = 'test'), -- 실결제 전까지 테스트만
  gross_amount integer not null check (gross_amount >= 0),          -- 참가자가 낸 금액(쿠폰 할인 후) - 환불액
  commission_rate_bp integer not null check (commission_rate_bp between 0 and 5000),
  commission_amount integer not null check (commission_amount >= 0),
  net_amount integer not null check (net_amount >= 0),               -- 호스트가 받을 금액
  status public.settlement_status not null default 'pending',
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users (id) on delete set null,
  paid_at timestamptz,
  paid_by uuid references auth.users (id) on delete set null,
  memo text check (memo is null or char_length(memo) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settlements_sum check (commission_amount + net_amount = gross_amount)
);
create index settlements_host_idx on public.settlements (host_id, created_at desc);
create index settlements_status_idx on public.settlements (status, created_at desc);
create trigger settlements_set_updated_at before update on public.settlements
  for each row execute function private.set_updated_at();
alter table public.settlements enable row level security;
revoke all on public.settlements from public, anon, authenticated;

-- 결제 완료 → 정산 행 생성(수수료율 고정) / 환불 → 금액 다시 계산, 전액 환불이면 취소
create function private.sync_settlement_from_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host uuid;
  v_gross integer;
  v_bp integer;
  v_comm integer;
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    select m.host_id into v_host
      from public.bookings b join public.meetup_sessions s on s.id = b.session_id join public.meetups m on m.id = s.meetup_id
     where b.id = new.booking_id;
    v_bp := coalesce(private.host_commission_bp(v_host), 0);
    v_gross := new.amount - new.refunded_amount;
    v_comm := floor(v_gross * v_bp / 10000.0)::int;
    insert into public.settlements (booking_id, payment_id, host_id, gross_amount, commission_rate_bp, commission_amount, net_amount)
    values (new.booking_id, new.id, v_host, v_gross, v_bp, v_comm, v_gross - v_comm)
    on conflict (booking_id) do nothing;
  elsif tg_op = 'UPDATE' and new.refunded_amount is distinct from old.refunded_amount then
    update public.settlements st
       set gross_amount = new.amount - new.refunded_amount,
           commission_amount = floor((new.amount - new.refunded_amount) * st.commission_rate_bp / 10000.0)::int,
           net_amount = (new.amount - new.refunded_amount) - floor((new.amount - new.refunded_amount) * st.commission_rate_bp / 10000.0)::int,
           status = case when new.amount - new.refunded_amount = 0 and st.status = 'pending' then 'cancelled'::public.settlement_status else st.status end
     where st.payment_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_settlement_from_payment() from public, anon, authenticated;
create trigger payments_sync_settlement after insert or update of status, refunded_amount on public.payments
  for each row execute function private.sync_settlement_from_payment();

-- 정산 가능일: 프로그램 끝난 뒤 7일 (분쟁·환불 확인 기간)
create function private.settlement_eligible_at(p_booking uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select s.ends_at + interval '7 days'
  from public.bookings b join public.meetup_sessions s on s.id = b.session_id
  where b.id = p_booking
$$;
revoke all on function private.settlement_eligible_at(uuid) from public, anon, authenticated;

-- 호스트: 내 정산 내역 (참가자는 닉네임도 보이지 않음 — 금액만)
create function public.host_my_settlements()
returns table (id uuid, meetup_title text, starts_at timestamptz, gross_amount integer, commission_rate_bp integer,
               commission_amount integer, net_amount integer, status public.settlement_status, eligible_at timestamptz,
               confirmed_at timestamptz, paid_at timestamptz, mode text)
language sql
stable
security definer
set search_path = ''
as $$
  select st.id, m.title, s.starts_at, st.gross_amount, st.commission_rate_bp, st.commission_amount, st.net_amount, st.status,
         s.ends_at + interval '7 days', st.confirmed_at, st.paid_at, st.mode
  from public.settlements st
  join public.bookings b on b.id = st.booking_id
  join public.meetup_sessions s on s.id = b.session_id
  join public.meetups m on m.id = s.meetup_id
  where st.host_id = auth.uid() and private.has_role('host')
  order by s.starts_at desc
  limit 300
$$;
revoke all on function public.host_my_settlements() from public, anon;
grant execute on function public.host_my_settlements() to authenticated;

-- 호스트: 지금 적용되는 내 수수료율과 0% 기간 끝나는 날
create function public.host_my_commission()
returns table (rate_bp integer, standard_rate_bp integer, free_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select private.host_commission_bp(h.user_id), s.commission_rate_bp,
         coalesce(h.reviewed_at, h.applied_at, now()) + make_interval(months => s.commission_free_months)
  from public.host_profiles h, public.app_settings s
  where h.user_id = auth.uid() and s.id and private.has_role('host')
$$;
revoke all on function public.host_my_commission() from public, anon;
grant execute on function public.host_my_commission() to authenticated;

-- 관리자: 정산 목록
create function public.admin_settlements(p_status text default null)
returns table (id uuid, host_id uuid, host_name text, meetup_title text, starts_at timestamptz, gross_amount integer,
               commission_rate_bp integer, commission_amount integer, net_amount integer, status public.settlement_status,
               eligible_at timestamptz, confirmed_at timestamptz, paid_at timestamptz, memo text, mode text)
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
    select st.id, st.host_id, h.display_name, m.title, s.starts_at, st.gross_amount, st.commission_rate_bp, st.commission_amount,
           st.net_amount, st.status, s.ends_at + interval '7 days', st.confirmed_at, st.paid_at, st.memo, st.mode
    from public.settlements st
    join public.host_profiles h on h.user_id = st.host_id
    join public.bookings b on b.id = st.booking_id
    join public.meetup_sessions s on s.id = b.session_id
    join public.meetups m on m.id = s.meetup_id
    where p_status is null or st.status::text = p_status
    order by s.starts_at desc
    limit 300;
end;
$$;
revoke all on function public.admin_settlements(text) from public, anon;
grant execute on function public.admin_settlements(text) to authenticated;

-- 관리자: 정산 확정(정산 가능일 이후) → 지급 완료 기록. 송금은 시스템 밖에서. 모두 감사 기록.
create function public.admin_advance_settlement(p_id uuid, p_action text, p_memo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  st record;
  v_memo text := nullif(btrim(coalesce(p_memo, '')), '');
  v_next public.settlement_status;
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  if char_length(coalesce(v_memo, '')) < 5 then
    raise exception '메모(사유)를 5자 이상 입력하세요' using errcode = '22023';
  end if;
  select * into st from public.settlements where id = p_id for update;
  if not found then
    raise exception '정산 내역을 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if p_action = 'confirm' then
    if st.status <> 'pending' then
      raise exception '대기 중인 정산만 확정할 수 있어요' using errcode = '22023';
    end if;
    if private.settlement_eligible_at(st.booking_id) > now() then
      raise exception '프로그램이 끝나고 7일이 지나야 확정할 수 있어요' using errcode = '22023';
    end if;
    -- 이 신청에 대한 문의, 또는 같은 참가자의 환불 문의가 열려 있으면 확정 보류
    if exists (select 1 from public.support_tickets t
                where t.status <> 'closed'
                  and (t.booking_id = st.booking_id
                       or (t.category = 'refund' and t.user_id = (select user_id from public.bookings where id = st.booking_id)))) then
      raise exception '환불 문의가 열려 있어요. 문의를 먼저 정리해 주세요' using errcode = '22023';
    end if;
    v_next := 'confirmed';
    update public.settlements set status = v_next, confirmed_at = now(), confirmed_by = auth.uid(), memo = v_memo where id = p_id;
  elsif p_action = 'paid' then
    if st.status <> 'confirmed' then
      raise exception '확정된 정산만 지급 완료로 기록할 수 있어요' using errcode = '22023';
    end if;
    v_next := 'paid';
    update public.settlements set status = v_next, paid_at = now(), paid_by = auth.uid(), memo = v_memo where id = p_id;
    perform private.notify(st.host_id, 'settlement.paid', '정산금이 지급되었어요', st.net_amount || '원', '/host/settlements');
  else
    raise exception '알 수 없는 작업입니다' using errcode = '22023';
  end if;
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after, reason)
  values (auth.uid(), 'admin', 'settlement.' || p_action, 'settlement', p_id,
          jsonb_build_object('status', st.status), jsonb_build_object('status', v_next, 'net_amount', st.net_amount), v_memo);
end;
$$;
revoke all on function public.admin_advance_settlement(uuid, text, text) from public, anon;
grant execute on function public.admin_advance_settlement(uuid, text, text) to authenticated;
