-- 무료 신청 취소 때 참가자 본인에게도 알림 (대표 요청 2026-11-18: "취소되었다는 것도 알람에 떠야지")
-- 유료 신청 취소는 refund_booking 이 이미 "취소·환불" 알림을 보냄
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
    -- 참가자 본인에게도 취소 확인 알림 (대표 요청 2026-11-18)
    perform private.notify(b.user_id, 'booking.cancelled', '신청을 취소했어요',
      v_title || ' · ' || to_char(s.starts_at at time zone 'Asia/Seoul', 'MM/DD HH24:MI'), '/me/bookings');
  end if;
end;
$$;

