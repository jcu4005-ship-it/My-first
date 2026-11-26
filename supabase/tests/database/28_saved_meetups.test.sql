-- 저장(찜): 본인 것만, 공개 프로그램만, 호스트는 숫자만
begin;
\ir _helpers.psql
select plan(8);

select pg_temp.create_member('svh@test.local', 'saveHost') as h \gset
select pg_temp.create_member('svp@test.local', 'savePart') as p \gset
select pg_temp.create_member('svq@test.local', 'saveOther') as q \gset
select pg_temp.published_session(:'h', 0, 6) as s \gset
select meetup_id as m from public.meetup_sessions where id = :'s' \gset
insert into public.meetups (host_id, category_slug, title, summary, description, price, max_quantity_per_booking, status)
values (:'h', 'writing', '검수 중 저장 시험', '검수 중 저장 시험 요약입니다', '검수 중 저장 시험 설명입니다. 충분히 길게 적습니다.', 0, 1, 'pending_review') returning id as d \gset

select pg_temp.login_as(:'p');
select lives_ok(format($$ select public.set_meetup_saved(%L, true) $$, :'m'), '공개 프로그램 저장');
select throws_ok(format($$ select public.set_meetup_saved(%L, true) $$, :'d'), '22023', null, '공개 전 프로그램은 저장 불가');
select throws_ok(format($$ insert into public.saved_meetups (user_id, meetup_id) values (%L, %L) $$, :'p', :'m'), '42501', null, '표에 직접 쓸 수 없다 (함수로만)');
select is((select count(*)::int from public.my_saved_meetups()), 1, '내 저장 목록');
select pg_temp.logout();

select pg_temp.login_as(:'q');
select is((select count(*)::int from public.my_saved_meetups()), 0, '다른 사람의 저장은 보이지 않는다');
select public.set_meetup_saved(:'m', false);  -- q 자신의 저장만 지움 (p의 저장은 그대로)
select pg_temp.logout();
select is((select count(*)::int from public.saved_meetups where user_id = :'p'), 1, '남의 저장은 지울 수 없다');

select pg_temp.login_as(:'h');
select is((select saves from public.host_meetup_save_counts() where meetup_id = :'m'), 1, '호스트는 저장 수를 본다');
select throws_ok($$ select * from public.saved_meetups $$, '42501', null, '표는 아무도 직접 읽을 수 없다 (호스트도 누가 저장했는지 못 봄)');
select pg_temp.logout();

select * from finish();
rollback;
