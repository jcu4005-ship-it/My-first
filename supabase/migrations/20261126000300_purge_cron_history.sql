-- ============================================================================
-- 예약 작업 실행 기록 정리
--  - 문제: 매분 도는 예약 작업(자리 해제·오픈 알림)의 실행 기록(cron.job_run_details)이 하루 2,800건씩 쌓이고
--    자동으로 지워지지 않아, 몇 달 뒤 DB가 불필요하게 커지고 느려질 수 있음
--  - 해결: 매일 새벽(한국 04:20 = UTC 19:20)에 7일 지난 기록을 삭제. 최근 7일은 오류 추적용으로 남김
-- ============================================================================

create extension if not exists pg_cron with schema pg_catalog;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'roundi-purge-cron-history') then
    perform cron.unschedule('roundi-purge-cron-history');
  end if;
  perform cron.schedule(
    'roundi-purge-cron-history',
    '20 19 * * *',
    $job$delete from cron.job_run_details where end_time < now() - interval '7 days'$job$
  );
end $$;
