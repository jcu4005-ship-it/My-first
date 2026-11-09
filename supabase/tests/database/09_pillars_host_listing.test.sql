-- 3대 분류(Knowledge/Creators/Experts) + 호스트 목록 정보(대표 분류·운영팀 추천) 권한
begin;
\ir _helpers.psql
select plan(14);

select pg_temp.create_member('lh@test.local', 'listHost') as h \gset
select pg_temp.create_member('lp@test.local', 'listPending') as p \gset
select pg_temp.create_member('la@test.local', 'listAdmin') as a \gset
select pg_temp.grant_role_direct(:'a', 'admin');
insert into public.host_profiles (user_id, display_name, status) values (:'h', '목록 테스트 호스트', 'approved'), (:'p', '심사 중 호스트', 'applied');

-- 분류 체계
select is((select count(*)::int from public.categories where pillar is null), 0, '모든 분야는 대분류가 있다');
select ok((select pillar = 'knowledge' and is_active from public.categories where slug = 'philosophy'), '철학·인문은 Knowledge로 다시 열림');
select ok((select pillar = 'creators' from public.categories where slug = 'photo'), '사진·영상은 Creators');
select ok((select pillar = 'experts' from public.categories where slug = 'career'), '커리어·실무는 Experts');
select ok((select not is_active from public.categories where slug = 'wine'), '와인(주류)은 계속 잠금');

-- 비로그인: 분류·추천 정보는 볼 수 있지만 바꿀 수 없음
select pg_temp.login_anon();
select ok(exists(select 1 from public.categories where pillar = 'knowledge'), '비로그인도 대분류를 볼 수 있다');
select ok(not exists(select 1 from public.host_profiles where user_id = :'p'), '심사 중 호스트는 목록에 보이지 않는다');
select pg_temp.logout();

-- 호스트 본인: 추천 여부를 스스로 바꿀 수 없음
select pg_temp.login_as(:'h');
select throws_ok($$ update public.host_profiles set is_featured = true where user_id = auth.uid() $$, '42501', null, '호스트는 추천 여부를 직접 바꿀 수 없다');
select throws_ok(format($$ select public.admin_update_host_listing(%L, 'creators', true, 1::smallint) $$, :'h'), '42501', null, '관리자가 아니면 추천 지정 불가');
select pg_temp.logout();

-- 관리자: 2단계 인증 전에는 불가, 후에는 가능 + 감사 기록
select pg_temp.login_as(:'a', 'aal1');
select throws_ok(format($$ select public.admin_update_host_listing(%L, 'creators', true, 1::smallint) $$, :'h'), '42501', null, '관리자도 2단계 인증 전에는 불가');
select pg_temp.logout();
select pg_temp.login_as(:'a', 'aal2');
select lives_ok(format($$ select public.admin_update_host_listing(%L, 'knowledge', true, 2::smallint) $$, :'h'), '관리자(2단계 인증)는 대표 분류·추천 지정 가능');
select throws_ok(format($$ select public.admin_update_host_listing(%L, 'creators', true, 1::smallint) $$, :'p'), '22023', null, '승인되지 않은 호스트는 추천할 수 없다');
select pg_temp.logout();
select ok((select primary_pillar = 'knowledge' and is_featured and featured_order = 2 from public.host_profiles where user_id = :'h'), '대표 분류·추천이 저장된다');
select ok(exists(select 1 from public.audit_logs where action = 'host.listing_update' and target_id = :'h'), '감사 기록이 남는다');

select * from finish();
rollback;
