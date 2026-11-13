-- 스키마 수준 보안 검사: RLS 활성화, 역할별 테이블 권한, 함수 실행 권한
begin;
\ir _helpers.psql
select plan(14);

-- N18: public 스키마에 RLS 꺼진 테이블이 없어야 함
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity $$,
  'N18: public 스키마의 모든 테이블에 RLS가 켜져 있다'
);

-- 비로그인(anon) 테이블 권한: profiles 공개 열 조회만
select results_eq(
  $$ select table_name::text collate "C" as t, privilege_type::text collate "C" as p from information_schema.role_table_grants
     where grantee = 'anon' and table_schema = 'public' order by 1,2 $$,
  $$ values ('categories' collate "C", 'SELECT' collate "C") $$,
  'anon 테이블 단위 권한은 카테고리 조회뿐이다 (나머지는 열 단위)'
);
select results_eq(
  $$ select table_name::text collate "C" as t, privilege_type::text collate "C" as p from information_schema.column_privileges
     where grantee = 'anon' and table_schema = 'public' group by 1,2 order by 1,2 $$,
  $$ values ('app_settings' collate "C",'SELECT' collate "C"), ('categories','SELECT'), ('contents','SELECT'), ('host_profiles','SELECT'), ('meetup_sessions','SELECT'),
            ('meetups','SELECT'), ('profiles','SELECT') $$,
  'anon 열 권한은 공개 정보(서비스 설정·카테고리·콘텐츠·호스트·모임·회차·프로필) 조회뿐이다'
);

-- 로그인 회원(authenticated) 테이블 단위 권한: 조회만, 추가·수정·삭제 없음
select results_eq(
  $$ select table_name::text collate "C" as t, privilege_type::text collate "C" as p from information_schema.role_table_grants
     where grantee = 'authenticated' and table_schema = 'public' order by 1,2 $$,
  $$ values ('audit_logs' collate "C",'SELECT' collate "C"), ('categories','SELECT'), ('contents','SELECT'), ('coupons','SELECT'), ('host_follows','SELECT'), ('invite_codes','SELECT'), ('legal_consents','SELECT'), ('payment_events','SELECT'), ('support_messages','SELECT'), ('support_tickets','SELECT'), ('user_roles','SELECT') $$,
  'authenticated 테이블 단위 권한은 조회뿐이다 (RLS로 범위 제한)'
);
select results_eq(
  $$ select (table_name::text || '.' || column_name::text) collate "C" as c from information_schema.column_privileges
     where grantee = 'authenticated' and table_schema = 'public' and privilege_type = 'UPDATE'
       and table_name in ('profiles', 'profile_private', 'user_roles', 'legal_consents', 'audit_logs', 'bookings') order by 1 $$,
  $$ values ('profile_private.birth_year' collate "C"), ('profile_private.interests'), ('profile_private.phone'),
            ('profiles.avatar_url'), ('profiles.bio'), ('profiles.nickname') $$,
  '회원 정보 표에서 authenticated가 수정 가능한 열은 6개뿐이다 (status·adult_verified_at·역할·신청 제외)'
);
select is_empty(
  $$ select table_name || '.' || column_name from information_schema.column_privileges
     where grantee = 'authenticated' and table_schema = 'public' and privilege_type = 'UPDATE'
       and column_name in ('status', 'is_sample', 'host_id', 'reserved_count', 'published_at', 'review_note', 'user_id', 'role') $$,
  '상태·샘플 여부·소유자·예약 인원·역할 열은 누구도 직접 수정할 수 없다'
);
select results_eq(
  $$ select distinct table_name::text collate "C" as t from information_schema.column_privileges
     where grantee in ('anon','authenticated') and table_schema = 'public' and privilege_type = 'INSERT' order by 1 $$,
  $$ values ('meetup_sessions' collate "C"), ('meetups') $$,
  '직접 추가 가능한 표는 모임·일정뿐이다 (호스트, RLS로 제한). 신청·역할·기록은 함수로만'
);
select is_empty(
  $$ select 1 from information_schema.role_table_grants
     where grantee in ('anon','authenticated') and table_schema = 'public' and privilege_type in ('DELETE','TRUNCATE') $$,
  '삭제 권한은 아무에게도 없다'
);

select ok(not has_function_privilege('authenticated', 'private.bootstrap_first_admin(text,text)', 'execute'),
  '로그인 회원은 최초 관리자 지정 함수를 실행할 수 없다');
select ok(not has_function_privilege('anon', 'private.bootstrap_first_admin(text,text)', 'execute'),
  '비로그인은 최초 관리자 지정 함수를 실행할 수 없다');
select ok(not has_function_privilege('service_role', 'private.bootstrap_first_admin(text,text)', 'execute'),
  '서비스 키(service_role)로도 최초 관리자 지정 함수를 실행할 수 없다');
select ok(not has_function_privilege('anon', 'public.admin_set_user_role(uuid,public.app_role,boolean,text)', 'execute'),
  '비로그인은 역할 변경 함수를 실행할 수 없다');
select ok(not has_function_privilege('authenticated', 'private.handle_new_user()', 'execute'),
  '가입 트리거 함수는 직접 실행할 수 없다');

-- 외부 API가 노출하는 스키마에 private가 없어야 함 (PostgREST 설정은 config.toml/대시보드 — 여기서는 스키마 권한 확인)
select ok(not has_schema_privilege('anon', 'private', 'create') and not has_schema_privilege('authenticated', 'private', 'create'),
  'private 스키마에 회원이 객체를 만들 수 없다');

select * from finish();
rollback;
