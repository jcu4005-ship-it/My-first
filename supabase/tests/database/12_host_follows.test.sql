-- 호스트 팔로우: 본인 목록만 보기, 함수로만 팔로우, 승인 호스트만, 자기 자신 불가, 탈퇴 정리
begin;
\ir _helpers.psql
select plan(15);

select pg_temp.create_member('fh@test.local', 'followHost') as h \gset
select pg_temp.create_member('fp@test.local', 'followPending') as p \gset
select pg_temp.create_member('fm@test.local', 'followMember') as m \gset
select pg_temp.create_member('fo@test.local', 'followOther') as o \gset
insert into public.host_profiles (user_id, display_name, status) values (:'h', '팔로우 호스트', 'approved'), (:'p', '심사 중 호스트', 'applied');

-- 직접 쓰기는 불가
select pg_temp.login_as(:'m');
select throws_ok(format($$ insert into public.host_follows (follower_id, host_id) values (auth.uid(), %L) $$, :'h'), '42501', null, '표에 직접 넣을 수 없다 (함수로만)');
select lives_ok(format($$ select public.follow_host(%L) $$, :'h'), '승인된 호스트 팔로우');
select lives_ok(format($$ select public.follow_host(%L) $$, :'h'), '두 번 눌러도 오류 없음');
select throws_ok(format($$ select public.follow_host(%L) $$, :'p'), 'P0002', null, '심사 중 호스트는 팔로우할 수 없다');
select throws_ok(format($$ select public.follow_host(%L) $$, :'o'), 'P0002', null, '호스트가 아닌 회원은 팔로우할 수 없다');
select is((select count(*)::int from public.host_follows), 1, '본인 팔로우 목록이 보인다');
select pg_temp.logout();

select pg_temp.login_as(:'h');
select throws_ok(format($$ select public.follow_host(%L) $$, :'h'), '22023', null, '자기 자신은 팔로우할 수 없다');
select is((select count(*)::int from public.host_follows), 0, '다른 사람의 팔로우 목록은 볼 수 없다 (호스트 본인도)');
select pg_temp.logout();

select pg_temp.login_as(:'o');
select public.follow_host(:'h');
select pg_temp.logout();

-- 팔로워 수는 비로그인도 함수로 확인
select pg_temp.login_anon();
select is(public.host_follower_count(:'h'), 2, '공개 팔로워 수');
select throws_ok(format($$ select public.follow_host(%L) $$, :'h'), '42501', null, '비로그인은 팔로우할 수 없다');
select pg_temp.logout();

-- 취소
select pg_temp.login_as(:'o');
select lives_ok(format($$ select public.unfollow_host(%L) $$, :'h'), '팔로우 취소');
select pg_temp.logout();
select is(public.host_follower_count(:'h'), 1, '취소하면 수가 줄어든다');

-- 정지된 호스트는 수가 0으로 보임
update public.host_profiles set status = 'suspended' where user_id = :'h';
select is(public.host_follower_count(:'h'), 0, '이용 제한 호스트의 팔로워 수는 공개하지 않는다');
update public.host_profiles set status = 'approved' where user_id = :'h';

-- 탈퇴하면 팔로우 삭제
select pg_temp.login_as(:'m');
select public.withdraw_my_account();
select pg_temp.logout();
select is((select count(*)::int from public.host_follows where follower_id = :'m'), 0, '탈퇴한 회원의 팔로우는 삭제된다');
select is(public.host_follower_count(:'h'), 0, '탈퇴 뒤 팔로워 수에서 빠진다');

select * from finish();
rollback;
