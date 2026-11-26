-- ============================================================================
-- 스테이징 전용: 샘플 호스트·샘플 프로그램·샘플 글 지우기 (대표 요청 2026-11-14)
-- staging.yml 에서 seed_samples=no 일 때만 실행. 로컬·CI(seed.sql)에는 자동 테스트용 샘플이 계속 있음.
--  - 지우는 것: is_sample 인 프로그램·회차·글·호스트 프로필, 샘플 호스트의 호스트 역할
--  - 남기는 것: 샘플 계정 자체(로그인 불가, 화면에 안 보임)와 그 동의 기록, 모든 테스트 계정·신청·결제·감사 기록
--  - 한 묶음으로 실행: 중간에 하나라도 실패하면 아무것도 지워지지 않음
--  - 다시 실행해도 됨 (지울 샘플이 없으면 아무 일도 없음)
-- ============================================================================
begin;

create temp table _sample_hosts on commit drop as
  select user_id from public.host_profiles where is_sample;

insert into public.audit_logs (actor_id, actor_kind, action, target_type, before, reason)
select null, 'system', 'staging.remove_samples', 'host_profile',
       jsonb_build_object(
         'hosts', (select count(*) from _sample_hosts),
         'meetups', (select count(*) from public.meetups where is_sample),
         'contents', (select count(*) from public.contents where is_sample)),
       '스테이징: 샘플 호스트·프로그램·글 정리 (실제 첫 호스트만 보이게)'
where exists (select 1 from _sample_hosts) or exists (select 1 from public.meetups where is_sample);

delete from public.contents where is_sample;
delete from public.meetup_sessions where meetup_id in (select id from public.meetups where is_sample);
delete from public.meetups where is_sample;
delete from public.host_follows where host_id in (select user_id from _sample_hosts);
delete from public.host_profiles where user_id in (select user_id from _sample_hosts);
delete from public.user_roles where role = 'host' and user_id in (select user_id from _sample_hosts);

commit;
