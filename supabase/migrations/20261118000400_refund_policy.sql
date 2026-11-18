-- 플랫폼 공통 환불 기준 (대표 결정 2026-11-18)
-- 참가자 취소: 프로그램 날짜(한국 시간) 기준 3일 전까지 100% · 2~1일 전 50% · 당일 0% (당일에도 취소는 가능 → 대기자에게 자리가 돌아감)
-- 호스트 사정 취소: 항상 100%
-- 부분 환불이면 남은 금액은 정산 대상(결제 시점 수수료율 그대로) — 정산 트리거가 refunded_amount 변화로 다시 계산

create function private.refund_percent(p_starts_at timestamptz)
returns integer
language sql
stable
set search_path = ''
as $$
  select case
    when (p_starts_at at time zone 'Asia/Seoul')::date - (now() at time zone 'Asia/Seoul')::date >= 3 then 100
    when (p_starts_at at time zone 'Asia/Seoul')::date - (now() at time zone 'Asia/Seoul')::date >= 1 then 50
    else 0
  end
$$;
revoke all on function private.refund_percent(timestamptz) from public, anon, authenticated;

-- 결제사에 보낼 환불 금액 미리 계산 (서버 비밀키로만)
create function public.refund_amount_for(p_booking_id uuid, p_cancel_status public.booking_status)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select floor(p.amount * (case when p_cancel_status = 'cancelled_by_host' then 100 else private.refund_percent(s.starts_at) end) / 100.0)::int
  from public.bookings b
  join public.meetup_sessions s on s.id = b.session_id
  join public.payments p on p.booking_id = b.id and p.status = 'paid'
  where b.id = p_booking_id
$$;
revoke all on function public.refund_amount_for(uuid, public.booking_status) from public, anon, authenticated;
grant execute on function public.refund_amount_for(uuid, public.booking_status) to service_role;

create or replace function public.refund_booking(p_booking_id uuid, p_actor uuid, p_cancel_status public.booking_status, p_reason text)
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
  v_pct integer;
  v_refund integer;
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

  -- 환불 금액: 호스트 취소는 항상 전액, 참가자 취소는 플랫폼 환불 기준(3일 전 100% · 2~1일 전 50% · 당일 0%)
  v_pct := case when p_cancel_status = 'cancelled_by_host' then 100 else private.refund_percent(s.starts_at) end;
  v_refund := floor(p.amount * v_pct / 100.0)::int;
  if v_refund > 0 then
    update public.payments set status = 'refunded', refunded_amount = v_refund, refunded_at = now() where id = p.id;
  end if;
  insert into public.payment_events (payment_id, kind, amount, detail)
  values (p.id, 'refunded', v_refund, jsonb_build_object('reason', p_reason, 'by', p_cancel_status, 'percent', v_pct));
  update public.bookings set status = p_cancel_status, cancelled_at = now() where id = b.id;
  update public.meetup_sessions set reserved_count = reserved_count - b.quantity where id = s.id;

  if p_cancel_status = 'cancelled_by_user' then
    perform private.notify(b.user_id, 'booking.refunded',
      case when v_refund > 0 then '신청이 취소되고 환불되었어요' else '신청이 취소되었어요 (환불 기간이 지나 환불 없음)' end,
      v_title || ' · 환불 ' || v_refund || '원 (' || v_pct || '%, 테스트 결제)', '/me/bookings');
    perform private.notify(v_host, 'host.booking_cancelled', '참가 신청이 취소되었어요', v_title, '/host/meetups/' || s.meetup_id);
  else
    perform private.notify(b.user_id, 'booking.cancelled_by_host', '호스트가 일정을 취소해 전액 환불되었어요',
      v_title || coalesce(' · 사유: ' || nullif(btrim(p_reason), ''), ''), '/me/bookings');
  end if;
  return v_refund;
end;
$$;

revoke all on function public.refund_booking(uuid, uuid, public.booking_status, text) from public, anon, authenticated;
grant execute on function public.refund_booking(uuid, uuid, public.booking_status, text) to service_role;
