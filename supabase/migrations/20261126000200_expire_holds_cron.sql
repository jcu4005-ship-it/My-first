-- ============================================================================
-- 결제 대기(자리 잡기 10분) 자동 만료
--  - 문제: 결제하지 않고 나간 사람의 자리가, 그 일정에 누군가 다시 신청해 보기 전까지는 계속 "찬 것"으로 보임
--    (남은 자리 = 정원 - reserved_count 를 화면 전체가 쓰는데, 만료 정리는 신청·결제 함수 안에서만 실행됐음)
--    → 마지막 자리를 잡고 떠난 사람 때문에 일정이 "마감"으로 보여 신청이 끊기는 문제
--  - 해결: 매분 만료된 자리 잡기를 모두 정리 (DB 예약 작업). 자리가 돌아오면 기존 트리거가 대기자에게 알림
--  - 잠그는 순서: 신청 함수와 같은 순서(일정 행 → 신청 행)로 잠가 서로 기다리다 멈추는 교착을 막음
-- ============================================================================

create function private.expire_all_holds()
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
    select distinct session_id from public.bookings
     where status = 'pending_payment' and hold_expires_at <= now()
  loop
    perform 1 from public.meetup_sessions where id = r.session_id for update; -- 신청 함수와 같은 순서: 일정 먼저
    perform private.expire_holds(r.session_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function private.expire_all_holds() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'roundi-expire-holds') then
    perform cron.unschedule('roundi-expire-holds');
  end if;
  perform cron.schedule('roundi-expire-holds', '* * * * *', 'select private.expire_all_holds()');
end $$;
