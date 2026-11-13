-- 프로그램 대표 사진: 본인 폴더 사진만 연결, 누구나 볼 수 있음, 공개 중 변경은 감사 기록
begin;
\ir _helpers.psql
select plan(5);

select pg_temp.create_member('cvh@test.local', 'coverHost') as h \gset
select pg_temp.create_member('cvo@test.local', 'coverOther') as o \gset
select pg_temp.published_session(:'h', 0, 6) as s \gset
select set_config('t.m', meetup_id::text, false) from public.meetup_sessions where id = :'s';

select pg_temp.login_as(:'h');
select throws_ok(format($$ update public.meetups set cover_path = %L where id = current_setting('t.m')::uuid $$, :'o' || '/meetup-1.jpg'),
  '22023', '본인이 올린 사진만 쓸 수 있어요', '남의 폴더 사진은 연결 불가');
select throws_ok($$ update public.meetups set cover_path = '../x.jpg' where id = current_setting('t.m')::uuid $$, '22023', '본인이 올린 사진만 쓸 수 있어요', '잘못된 경로 형식 거부 (본인 폴더가 아님)');
select lives_ok(format($$ update public.meetups set cover_path = %L where id = current_setting('t.m')::uuid $$, :'h' || '/meetup-1.jpg'), '본인 폴더 사진 연결');
select pg_temp.logout();
select ok(exists(select 1 from public.audit_logs where action = 'meetup.cover_change' and target_id = current_setting('t.m')::uuid), '공개 중 사진 변경 감사 기록');

select pg_temp.login_anon();
select is((select cover_path from public.meetups where id = current_setting('t.m')::uuid), :'h' || '/meetup-1.jpg', '비로그인도 대표 사진 경로를 볼 수 있다');
select pg_temp.logout();

select * from finish();
rollback;
