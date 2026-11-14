-- ============================================================================
-- 스테이징 전용: 자동 테스트가 만든 호스트를 공개 목록에서 숨기기 (대표 요청 2026-11-14)
-- 스테이징 테스트 계정은 모두 stg-…@example.com 형식 (tests/support/fixtures.ts)
-- 계정·신청·결제·감사 기록은 지우지 않음. is_test 표시만 바꿈. 다시 실행해도 됨.
-- ============================================================================
begin;

with marked as (
  update public.host_profiles h set is_test = true
  from auth.users u
  where u.id = h.user_id and not h.is_test
    and u.email like 'stg-%@example.com'
  returning h.user_id
)
insert into public.audit_logs (actor_id, actor_kind, action, target_type, after, reason)
select null, 'system', 'staging.hide_test_hosts', 'host_profile',
       jsonb_build_object('count', count(*)), '스테이징: 자동 테스트 호스트를 공개 목록에서 숨김 (기록은 유지)'
from marked having count(*) > 0;

commit;
