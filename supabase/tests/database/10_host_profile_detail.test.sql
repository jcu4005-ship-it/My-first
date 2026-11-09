-- 호스트 상세 프로필: 이름 주소(slug), 작업 철학·사진, 사진 저장소 권한, 탈퇴 시 정리
begin;
\ir _helpers.psql
select plan(16);

select pg_temp.create_member('dh@test.local', 'detailHost') as h \gset
select pg_temp.create_member('do@test.local', 'detailOther') as o \gset
select pg_temp.create_member('da@test.local', 'detailAdmin') as a \gset
select pg_temp.grant_role_direct(:'a', 'admin');
insert into public.host_profiles (user_id, display_name, status) values (:'h', '상세 테스트 호스트', 'applied');
select is((select slug from public.host_profiles where user_id = :'h'), null, '심사 중에는 주소(slug)가 없다');
update public.host_profiles set status = 'approved' where user_id = :'h';
select matches((select slug from public.host_profiles where user_id = :'h'), '^host-[0-9a-f]{8}$', '승인되면 주소가 자동으로 생긴다');
insert into public.host_profiles (user_id, display_name, status) values (:'o', '다른 호스트', 'approved');

-- 호스트 본인
select pg_temp.login_as(:'h');
select lives_ok($$ update public.host_profiles set philosophy = '좋은 질문을 만드는 연습', occupation = '철학 강사' where user_id = auth.uid() $$, '본인 작업 철학·직업 수정 가능');
select throws_ok($$ update public.host_profiles set slug = 'my-own-slug' where user_id = auth.uid() $$, '42501', null, '주소(slug)는 스스로 바꿀 수 없다');
select throws_ok(format($$ update public.host_profiles set avatar_path = %L where user_id = auth.uid() $$, :'o' || '/a.png'), '42501', null, '다른 사람 폴더의 사진은 쓸 수 없다');
select lives_ok(format($$ update public.host_profiles set avatar_path = %L where user_id = auth.uid() $$, :'h' || '/avatar-1.png'), '본인 폴더 사진은 쓸 수 있다');
select lives_ok(format($$ update public.host_profiles set philosophy = '남의 철학' where user_id = %L $$, :'o'), '다른 호스트 수정 시도');
select pg_temp.logout();
select is((select philosophy from public.host_profiles where user_id = :'o'), '', '다른 호스트 프로필은 바뀌지 않는다');

-- 사진 저장소: 본인 폴더만
select pg_temp.login_as(:'h');
select lives_ok(format($$ insert into storage.objects (bucket_id, name, owner) values ('host-avatars', %L, auth.uid()) $$, :'h' || '/x.png'), '본인 폴더에 사진 올리기 가능');
select throws_ok(format($$ insert into storage.objects (bucket_id, name, owner) values ('host-avatars', %L, auth.uid()) $$, :'o' || '/x.png'), '42501', null, '다른 사람 폴더에는 올릴 수 없다');
select pg_temp.logout();
select pg_temp.login_anon();
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('host-avatars', 'anon/x.png') $$, '42501', null, '비로그인은 올릴 수 없다');
select pg_temp.logout();

-- 관리자: 주소 변경
select pg_temp.login_as(:'h');
select throws_ok(format($$ select public.admin_set_host_slug(%L, 'think-lab') $$, :'h'), '42501', null, '관리자가 아니면 주소 변경 불가');
select pg_temp.logout();
select pg_temp.login_as(:'a', 'aal2');
select lives_ok(format($$ select public.admin_set_host_slug(%L, 'detail-host') $$, :'h'), '관리자는 주소를 바꿀 수 있다');
select throws_ok(format($$ select public.admin_set_host_slug(%L, 'detail-host') $$, :'o'), '22023', null, '이미 쓰는 주소는 불가');
select throws_ok(format($$ select public.admin_set_host_slug(%L, '한글주소') $$, :'o'), '22023', null, '영문 소문자·숫자·하이픈만');
select pg_temp.logout();

-- 탈퇴: 작업 철학·직업·사진 경로 삭제
select pg_temp.login_as(:'h');
select public.withdraw_my_account();
select pg_temp.logout();
select ok((select philosophy = '' and occupation = '' and avatar_path is null from public.host_profiles where user_id = :'h'), '탈퇴하면 작업 철학·직업·사진 정보가 지워진다');

select * from finish();
rollback;
