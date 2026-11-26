-- 후기 요청 알림 (2026-11-18): 프로그램이 끝나고 2시간 뒤, 참가자에게 한 번 "후기를 남겨 주세요"
-- - 확정 신청 · 불참으로 체크되지 않음 · 아직 후기 없음 · 끝난 지 30일 안 · 샘플 아님
-- - DB 예약 작업(pg_cron) 매시 37분. 사이트 안 알림만(이메일 아님)

alter table public.bookings add column review_requested_at timestamptz;

create function private.send_review_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select b.id, b.user_id, m.title, h.display_name
      from public.bookings b
      join public.meetup_sessions s on s.id = b.session_id
      join public.meetups m on m.id = s.meetup_id
      join public.host_profiles h on h.user_id = m.host_id
     where b.status = 'confirmed' and b.review_requested_at is null and b.attended is distinct from false
       and not m.is_sample and s.status <> 'cancelled'
       and s.ends_at <= now() - interval '2 hours' and s.ends_at > now() - interval '30 days'
       and not exists (select 1 from public.reviews rv where rv.booking_id = b.id)
     for update of b skip locked
  loop
    perform private.notify(r.user_id, 'review.request', '오늘 시간은 어떠셨나요?',
      left(r.title, 40) || ' · ' || r.display_name || '님께 후기를 남겨 주세요 (30일 안)', '/me/reviews');
    update public.bookings set review_requested_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function private.send_review_requests() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'roundi-review-requests') then
    perform cron.unschedule('roundi-review-requests');
  end if;
  perform cron.schedule('roundi-review-requests', '37 * * * *', 'select private.send_review_requests()');
end;
$$;
