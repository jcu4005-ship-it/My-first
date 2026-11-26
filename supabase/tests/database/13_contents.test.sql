-- 콘텐츠(저널): 작성 권한, 검토·공개 흐름, 공개 범위, 감사 기록, 탈퇴 정리
begin;
\ir _helpers.psql
select plan(27);

select pg_temp.create_member('ch@test.local', 'contentHost') as h \gset
select pg_temp.create_member('cm@test.local', 'contentMember') as m \gset
select pg_temp.create_member('ca@test.local', 'contentAdmin') as a \gset
select pg_temp.grant_role_direct(:'a', 'admin');
select pg_temp.grant_role_direct(:'h', 'host');
insert into public.host_profiles (user_id, display_name, status) values (:'h', '콘텐츠 호스트', 'approved');

\set body '''이 글은 테스트용 본문입니다. 백 자 이상이 되어야 공개할 수 있어서 조금 길게 적습니다. 사진을 찍기 전에 빛이 어디서 오는지 먼저 살펴보는 습관을 들이면, 같은 장비로도 전혀 다른 결과를 얻을 수 있습니다. 오늘은 그 연습 방법을 소개합니다.'''

-- 일반 회원·비로그인은 작성 불가, 표 직접 쓰기 불가
select pg_temp.login_as(:'m');
select throws_ok($$ select public.save_content(null, 'article', '회원이 쓴 글', '', '', null, null, null) $$, '42501', null, '일반 회원은 콘텐츠를 쓸 수 없다');
select throws_ok($$ insert into public.contents (slug, type, title, author_id) values ('x-direct', 'article', '직접', auth.uid()) $$, '42501', null, '표에 직접 넣을 수 없다');
select pg_temp.logout();

-- 호스트: 작성 → 필수 항목 검사 → 검토 요청
select pg_temp.login_as(:'h');
select lives_ok(format($$ select set_config('t.c', public.save_content(null, 'article', '빛을 읽는 법', '', '짧은 본문', null, %L, null)::text, true) $$, :'m'), '호스트는 작성할 수 있다 (다른 호스트 지정은 무시)');
select is((select host_id from public.contents where id = current_setting('t.c')::uuid), :'h'::uuid, '호스트 글은 항상 본인 이름으로');
select throws_ok($$ select public.submit_content(current_setting('t.c')::uuid) $$, '22023', null, '요약·본문이 짧으면 검토 요청 불가');
select throws_ok(format($$ select public.save_content(current_setting('t.c')::uuid, 'article', '빛을 읽는 법', '요약입니다 열 자 이상', %s, %L, null, null) $$, :'body', :'m' || '/a.png'), '42501', null, '다른 사람 폴더 사진은 쓸 수 없다');
select lives_ok(format($$ select public.save_content(current_setting('t.c')::uuid, 'article', '빛을 읽는 법', '요약입니다 열 자 이상', %s, %L, null, null) $$, :'body', :'h' || '/c.png'), '보완 저장');
select lives_ok($$ select public.submit_content(current_setting('t.c')::uuid) $$, '검토 요청');
select throws_ok($$ select public.save_content(current_setting('t.c')::uuid, 'article', '검토 중 수정', '', '', null, null, null) $$, '22023', null, '검토 중에는 고칠 수 없다');
select throws_ok($$ select public.admin_review_content(current_setting('t.c')::uuid, 'publish', null) $$, '42501', null, '호스트는 스스로 공개할 수 없다');
select pg_temp.logout();

-- 공개 전에는 다른 사람에게 보이지 않음
select pg_temp.login_anon();
select is((select count(*)::int from public.contents where author_id = :'h'), 0, '공개 전에는 비로그인에게 보이지 않는다');
select pg_temp.logout();

-- 관리자: 2단계 인증 전 불가 → 반려(사유 필수) → 재요청 → 공개
select pg_temp.login_as(:'a', 'aal1');
select throws_ok($$ select public.admin_review_content(current_setting('t.c')::uuid, 'publish', null) $$, '42501', null, '2단계 인증 전 공개 불가');
select pg_temp.logout();
select pg_temp.login_as(:'a', 'aal2');
select throws_ok($$ select public.admin_review_content(current_setting('t.c')::uuid, 'reject', '') $$, '22023', null, '반려 사유 필수');
select lives_ok($$ select public.admin_review_content(current_setting('t.c')::uuid, 'reject', '사진 출처를 적어 주세요') $$, '반려');
select pg_temp.logout();
select pg_temp.login_as(:'h');
select lives_ok($$ select public.submit_content(current_setting('t.c')::uuid) $$, '반려 후 다시 검토 요청');
select pg_temp.logout();
select pg_temp.login_as(:'a', 'aal2');
select lives_ok($$ select public.admin_review_content(current_setting('t.c')::uuid, 'publish', null) $$, '공개');
-- 관리자 본인 글은 바로 공개
select lives_ok(format($$ select set_config('t.ac', public.save_content(null, 'interview', '호스트 인터뷰: 빛과 사진', '사진가와 나눈 대화를 정리했어요', %s, null, %L, null)::text, true) $$, :'body', :'h'), '관리자는 호스트를 지정해 인터뷰를 쓸 수 있다');
select lives_ok($$ select public.admin_review_content(current_setting('t.ac')::uuid, 'publish', null) $$, '관리자 글은 바로 공개');
select pg_temp.logout();

select ok(exists(select 1 from public.notifications where user_id = :'h' and kind = 'content.publish'), '공개 알림');
select is((select count(*)::int from public.audit_logs where target_type = 'content' and target_id = current_setting('t.c')::uuid), 4, '요청·반려·재요청·공개 감사 기록');

select pg_temp.login_anon();
select is((select count(*)::int from public.contents where host_id = :'h'), 2, '공개된 글은 비로그인도 볼 수 있다');
select pg_temp.logout();

-- 호스트가 공개된 글을 고치면 다시 비공개(작성 중)
select pg_temp.login_as(:'h');
select lives_ok(format($$ select public.save_content(current_setting('t.c')::uuid, 'article', '빛을 읽는 법 (수정)', '요약입니다 열 자 이상', %s, null, null, null) $$, :'body'), '공개 글 수정');
select pg_temp.logout();
select is((select status::text from public.contents where id = current_setting('t.c')::uuid), 'draft', '수정하면 다시 검토가 필요하다');

-- 호스트 이용 제한 → 관련 글 비공개
update public.host_profiles set status = 'suspended' where user_id = :'h';
select pg_temp.login_anon();
select is((select count(*)::int from public.contents where host_id = :'h'), 0, '이용 제한 호스트의 글은 보이지 않는다');
select pg_temp.logout();
update public.host_profiles set status = 'approved' where user_id = :'h';

-- 대표 사진 저장소: 본인 폴더만
select pg_temp.login_as(:'h');
select lives_ok(format($$ insert into storage.objects (bucket_id, name, owner) values ('content-covers', %L, auth.uid()) $$, :'h' || '/cover.png'), '본인 폴더에 대표 사진 올리기 가능');
select throws_ok(format($$ insert into storage.objects (bucket_id, name, owner) values ('content-covers', %L, auth.uid()) $$, :'m' || '/cover.png'), '42501', null, '다른 사람 폴더에는 올릴 수 없다');
select pg_temp.logout();

-- 탈퇴 → 글 내림
select pg_temp.login_as(:'h');
select public.withdraw_my_account();
select pg_temp.logout();
select is((select count(*)::int from public.contents where host_id = :'h' and status <> 'archived'), 0, '탈퇴하면 콘텐츠가 내려간다');

select * from finish();
rollback;
