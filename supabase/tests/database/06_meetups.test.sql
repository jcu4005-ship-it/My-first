-- 모임 탐색: 공개 범위, 비공개 주소, 쓰기 차단, 주류 잠금
begin;
\ir _helpers.psql
select plan(16);

select pg_temp.create_member('host@test.local', 'hostT') as h \gset
select pg_temp.create_member('other@test.local', 'otherT') as o \gset
insert into public.host_profiles (user_id, display_name, status) values (:'h', '테스트 호스트', 'approved');
insert into public.meetups (id, host_id, category_slug, title, summary, description, price, status)
values ('b0000000-0000-4000-8000-000000000001', :'h', 'writing', '공개된 테스트 모임', '공개된 테스트 모임 요약입니다', '공개된 테스트 모임의 상세 설명입니다.', 10000, 'published'),
       ('b0000000-0000-4000-8000-000000000002', :'h', 'writing', '검토 중 테스트 모임', '검토 중 테스트 모임 요약입니다', '검토 중 테스트 모임의 상세 설명입니다.', 10000, 'pending_review');
insert into public.meetup_sessions (meetup_id, starts_at, ends_at, area, venue_name, address_detail, capacity)
values ('b0000000-0000-4000-8000-000000000001', now() + interval '3 days', now() + interval '3 days 2 hours', '성수동', '테스트 장소', '비밀 상세 주소 123', 10),
       ('b0000000-0000-4000-8000-000000000002', now() + interval '3 days', now() + interval '3 days 2 hours', '성수동', '테스트 장소', '비밀 상세 주소 456', 10);

-- 비로그인
select pg_temp.login_anon();
select ok(exists(select 1 from public.categories where slug = 'writing'), '비로그인도 카테고리를 볼 수 있다');
select ok(not exists(select 1 from public.categories where slug in ('reading', 'outdoor', 'networking', 'wine')), '운영을 멈춘 친목형 카테고리는 보이지 않는다');
select ok(exists(select 1 from public.meetups where id = 'b0000000-0000-4000-8000-000000000001'), '공개 모임은 누구나 볼 수 있다');
select ok(not exists(select 1 from public.meetups where id = 'b0000000-0000-4000-8000-000000000002'), '검토 중 모임은 공개되지 않는다');
select is((select count(*)::int from public.meetup_sessions where meetup_id = 'b0000000-0000-4000-8000-000000000002'), 0, '검토 중 모임의 회차도 보이지 않는다');
select throws_ok($$ select address_detail from public.meetup_sessions $$, '42501', null, '상세 주소는 공개 조회할 수 없다');
select throws_ok($$ insert into public.meetups (host_id, category_slug, title, summary, description, price) values (gen_random_uuid(), 'writing', '불법 등록 시도', '불법 등록 시도 요약입니다', '불법 등록 시도 상세 설명입니다.', 0) $$, '42501', null, '비로그인은 모임을 만들 수 없다');
select pg_temp.logout();

-- 다른 회원
select pg_temp.login_as(:'o');
select ok(not exists(select 1 from public.meetups where id = 'b0000000-0000-4000-8000-000000000002'), '다른 회원은 남의 검토 중 모임을 볼 수 없다');
select lives_ok(format($$ update public.meetups set price = 0 where host_id = %L $$, :'h'), '다른 회원의 모임 수정 시도');
select throws_ok($$ update public.meetup_sessions set reserved_count = 0 $$, '42501', null, '회원은 예약 인원을 직접 바꿀 수 없다');
select throws_ok(format($$ update public.host_profiles set status = 'approved' where user_id = %L $$, :'o'), '42501', null, '호스트 승인 상태를 스스로 바꿀 수 없다');
select pg_temp.logout();
select is((select min(price) from public.meetups where host_id = :'h'), 10000, '다른 회원의 수정은 반영되지 않는다');

-- 호스트 본인은 자기 검토 중 모임을 볼 수 있다
select pg_temp.login_as(:'h');
select ok(exists(select 1 from public.meetups where id = 'b0000000-0000-4000-8000-000000000002'), '호스트는 자기 검토 중 모임을 볼 수 있다');
select pg_temp.logout();

-- 주류 모임 공개 잠금
select throws_ok(format($$ insert into public.meetups (host_id, category_slug, meetup_type, title, summary, description, price, status) values (%L, 'coffee', 'alcohol', '와인 시음 모임 테스트', '와인 시음 모임 테스트 요약', '와인 시음 모임 테스트 상세 설명입니다.', 30000, 'published') $$, :'h'),
  '23514', null, '주류 모임은 공개(published)할 수 없다');

-- 비활성 카테고리로는 새로 만들거나 옮길 수 없다
select throws_ok(format($$ insert into public.meetups (host_id, category_slug, title, summary, description, price) values (%L, 'reading', '비활성 카테고리 시도', '비활성 카테고리 시도 요약입니다', '비활성 카테고리 시도 상세 설명입니다.', 0) $$, :'h'),
  '22023', null, '비활성 카테고리로 클래스를 만들 수 없다');
select throws_ok($$ update public.meetups set category_slug = 'outdoor' where id = 'b0000000-0000-4000-8000-000000000001' $$,
  '22023', null, '비활성 카테고리로 옮길 수 없다');

select * from finish();
rollback;
