-- 관리자 호스트 활동 중지·재개: 권한, 사유, 예정 신청 보호, 공개 화면 반영, 감사 기록·알림, 주소 변경
begin;
\ir _helpers.psql
select plan(18);

select pg_temp.create_member('sh@test.local', 'statusHost') as h \gset
select pg_temp.create_member('sp@test.local', 'statusPart') as p \gset
select pg_temp.create_member('sa@test.local', 'statusAdmin') as a \gset
select pg_temp.grant_role_direct(:'a', 'admin');
select pg_temp.grant_role_direct(:'h', 'host');
insert into public.host_profiles (user_id, display_name, status, is_featured, featured_order) values (:'h', '상태 테스트 호스트', 'approved', true, 1);
insert into public.meetups (id, host_id, category_slug, title, summary, description, price, status)
values ('c0000000-0000-4000-8000-000000000001', :'h', 'writing', '상태 테스트 프로그램', '상태 테스트 프로그램 요약입니다', '상태 테스트 프로그램의 상세 설명입니다.', 10000, 'published');
insert into public.meetup_sessions (id, meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity)
values ('c1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', now() + interval '3 days', now() + interval '3 days 2 hours', '성수동', '테스트 장소', '주소', 10);
insert into public.bookings (id, session_id, user_id, quantity, unit_price, total_price, status)
values ('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', :'p', 1, 10000, 10000, 'confirmed');

-- 권한
select pg_temp.login_as(:'h');
select throws_ok(format($$ select public.admin_set_host_active(%L, false, '스스로 중지 시도') $$, :'h'), '42501', null, '호스트 본인은 상태를 바꿀 수 없다');
select pg_temp.logout();
select pg_temp.login_as(:'a', 'aal1');
select throws_ok(format($$ select public.admin_set_host_active(%L, false, '2단계 인증 전 시도') $$, :'h'), '42501', null, '관리자도 2단계 인증 전에는 불가');
select pg_temp.logout();

select pg_temp.login_as(:'a', 'aal2');
select throws_ok(format($$ select public.admin_set_host_active(%L, false, '') $$, :'h'), '22023', null, '사유 필수');
select throws_ok(format($$ select public.admin_set_host_active(%L, false, '정책 위반 확인 중') $$, :'h'), '22023', null, '예정된 참가 신청이 있으면 중지할 수 없다');
select pg_temp.logout();

-- 신청이 정리되면 중지 가능
update public.bookings set status = 'cancelled_by_host', cancelled_at = now() where id = 'c2000000-0000-4000-8000-000000000001';
select pg_temp.login_as(:'a', 'aal2');
select lives_ok(format($$ select public.admin_set_host_active(%L, false, '정책 위반 확인 중') $$, :'h'), '활동 중지');
select throws_ok(format($$ select public.admin_set_host_active(%L, false, '정책 위반 확인 중') $$, :'h'), '22023', null, '이미 중지된 호스트는 다시 중지할 수 없다');
select pg_temp.logout();
select ok((select status = 'suspended' and not is_featured and featured_order is null from public.host_profiles where user_id = :'h'), '중지되면 추천에서도 빠진다');
select is((select status::text from public.meetups where id = 'c0000000-0000-4000-8000-000000000001'), 'published', '프로그램 상태 자체는 그대로 (재개 시 복원)');

select pg_temp.login_anon();
select is((select count(*)::int from public.host_profiles where user_id = :'h'), 0, '중지된 호스트 페이지는 보이지 않는다');
select is((select count(*)::int from public.meetups where host_id = :'h'), 0, '중지된 호스트의 프로그램은 보이지 않는다');
select pg_temp.logout();

-- 호스트 기능도 막힘
select pg_temp.login_as(:'h');
select ok(not private.is_approved_host(), '중지된 호스트는 호스트 기능을 쓸 수 없다');
select pg_temp.logout();

-- 재개
select pg_temp.login_as(:'a', 'aal2');
select lives_ok(format($$ select public.admin_set_host_active(%L, true, '확인 결과 문제 없음') $$, :'h'), '활동 재개');
select pg_temp.logout();
select pg_temp.login_anon();
select is((select count(*)::int from public.meetups where host_id = :'h'), 1, '재개하면 프로그램이 다시 보인다');
select pg_temp.logout();

select is((select count(*)::int from public.audit_logs where target_type = 'host' and target_id = :'h' and action in ('host.deactivate', 'host.reactivate')), 2, '중지·재개 감사 기록');
select ok(exists(select 1 from public.notifications where user_id = :'h' and kind = 'host.deactivated'), '중지 알림');

-- 주소 변경 (기존 관리자 함수)
select pg_temp.login_as(:'a', 'aal2');
select lives_ok(format($$ select public.admin_set_host_slug(%L, 'status-host') $$, :'h'), '관리자 주소 변경');
select pg_temp.logout();
select is((select slug from public.host_profiles where user_id = :'h'), 'status-host', '새 주소 저장');

-- 탈퇴한 호스트는 재개 불가
update public.host_profiles set status = 'suspended', display_name = '탈퇴한 호스트' where user_id = :'h';
select pg_temp.login_as(:'a', 'aal2');
select throws_ok(format($$ select public.admin_set_host_active(%L, true, '재개 시도합니다') $$, :'h'), '22023', null, '탈퇴한 호스트는 재개할 수 없다');
select pg_temp.logout();

select * from finish();
rollback;
