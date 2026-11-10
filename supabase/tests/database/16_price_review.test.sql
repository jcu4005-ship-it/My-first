-- 참가비 공동 결정: 유료 프로그램 가격 근거 필수, 공개 후 인상 시 재검수, 인하는 바로 반영
begin;
\ir _helpers.psql
select plan(11);

select pg_temp.create_member('prh@test.local', 'priceHost') as h \gset
select pg_temp.create_member('pra@test.local', 'priceAdmin') as a \gset
select pg_temp.grant_role_direct(:'a', 'admin');
select pg_temp.grant_role_direct(:'h', 'host');
insert into public.host_profiles (user_id, display_name, status) values (:'h', '가격 테스트 호스트', 'approved');

select pg_temp.login_as(:'h');
select lives_ok($$ insert into public.meetups (host_id, category_slug, title, summary, description, price, max_quantity_per_booking)
  values (auth.uid(), 'writing', '가격 테스트 프로그램', '가격 테스트 프로그램 요약입니다', '가격 테스트 프로그램의 상세 설명입니다.', 40000, 2) $$, '유료 프로그램 작성');
select pg_temp.logout();
select set_config('t.m', id::text, false) from public.meetups where title = '가격 테스트 프로그램';
insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity)
values (current_setting('t.m')::uuid, now() + interval '5 days', now() + interval '5 days 2 hours', '성수동', '테스트 장소', '주소', 6);

select pg_temp.login_as(:'h');
select throws_ok($$ select public.host_set_meetup_status(current_setting('t.m')::uuid, 'submit') $$, '22023', '유료 프로그램은 가격 근거를 10자 이상 적어 주세요', '가격 근거 없이 검수 요청 불가');
select lives_ok($$ update public.meetups set price_rationale = '3시간 실습, 재료비 1만 원 포함, 6명 정원' where id = current_setting('t.m')::uuid $$, '가격 근거 작성');
select lives_ok($$ select public.host_set_meetup_status(current_setting('t.m')::uuid, 'submit') $$, '가격 근거가 있으면 검수 요청');
select pg_temp.logout();

select pg_temp.login_as(:'a', 'aal2');
select lives_ok($$ select public.admin_review_meetup(current_setting('t.m')::uuid, 'publish', null) $$, '관리자 공개 (가격 승인)');
select is((select price_rationale from public.meetups where id = current_setting('t.m')::uuid), '3시간 실습, 재료비 1만 원 포함, 6명 정원', '관리자는 가격 근거를 볼 수 있다');
select pg_temp.logout();

-- 인하: 바로 반영, 공개 유지
select pg_temp.login_as(:'h');
update public.meetups set price = 35000 where id = current_setting('t.m')::uuid;
select pg_temp.logout();
select is((select status::text || ':' || price from public.meetups where id = current_setting('t.m')::uuid), 'published:35000', '참가비를 내리면 공개 상태 그대로');

-- 인상: 검수 대기로 돌아감
select pg_temp.login_as(:'h');
update public.meetups set price = 400000 where id = current_setting('t.m')::uuid;
select pg_temp.logout();
select is((select status::text || ':' || price from public.meetups where id = current_setting('t.m')::uuid), 'pending_review:400000', '참가비를 올리면 다시 검수 대기');
select ok(exists(select 1 from public.audit_logs where action = 'meetup.price_increase' and target_id = current_setting('t.m')::uuid), '인상 감사 기록');
select pg_temp.login_anon();
select is((select count(*)::int from public.meetups where id = current_setting('t.m')::uuid), 0, '재검수 중에는 공개 목록에서 내려간다');
select pg_temp.logout();

-- 무료 프로그램은 근거 없이도 검수 요청 가능
select pg_temp.login_as(:'h');
insert into public.meetups (host_id, category_slug, title, summary, description, price) values (auth.uid(), 'writing', '무료 가격 테스트', '무료 가격 테스트 요약입니다', '무료 가격 테스트의 상세 설명입니다.', 0);
select pg_temp.logout();
insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity)
select id, now() + interval '5 days', now() + interval '5 days 2 hours', '성수동', '테스트 장소', '주소', 6 from public.meetups where title = '무료 가격 테스트';
select pg_temp.login_as(:'h');
select lives_ok($$ select public.host_set_meetup_status((select id from public.meetups where title = '무료 가격 테스트'), 'submit') $$, '무료 프로그램은 가격 근거 불필요');
select pg_temp.logout();

select * from finish();
rollback;
