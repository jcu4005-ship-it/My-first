-- 후기·출석·공지·현황: 쓰기는 함수로만, 본인/담당 호스트/관리자(2단계)만, 조건 밖은 거절
begin;
\ir _helpers.psql
select plan(28);

select pg_temp.create_member('rvh@test.local', 'reviewHost') as h \gset
select pg_temp.create_member('rvp@test.local', 'reviewPart') as p \gset
select pg_temp.create_member('rvq@test.local', 'reviewOther') as q \gset
select pg_temp.create_member('rva@test.local', 'reviewAdmin') as a \gset
select pg_temp.grant_role_direct(:'a', 'admin');
select pg_temp.published_session(:'h', 0, 6) as s \gset

select pg_temp.login_as(:'p');
select public.book_session(:'s', 1) as b \gset
select pg_temp.logout();
select pg_temp.login_as(:'q');
select public.book_session(:'s', 1) as bq \gset
select pg_temp.logout();

-- 표 직접 접근 불가
select pg_temp.login_as(:'p');
select throws_ok($$ select * from public.reviews $$, '42501', null, '후기 표는 직접 읽을 수 없다');
select throws_ok(format($$ insert into public.reviews (booking_id, meetup_id, host_id, user_id, rating, body) select %L, meetup_id, %L, %L, 5, '직접 넣는 후기입니다 열 자' from public.meetup_sessions where id = %L $$, :'b', :'h', :'p', :'s'), '42501', null, '후기 표에 직접 쓸 수 없다');
-- 시작 전에는 후기 불가
select throws_ok(format($$ select public.write_review(%L, 5, '아직 시작하지 않은 프로그램 후기') $$, :'b'), '22023', null, '시작 전에는 후기를 쓸 수 없다');
select pg_temp.logout();

-- 시작 전에는 출석 체크 불가
select pg_temp.login_as(:'h');
select throws_ok(format($$ select public.host_mark_attendance(%L, true) $$, :'b'), '22023', null, '시작 전에는 출석 체크 불가');
select pg_temp.logout();

-- 프로그램이 지난 것으로 만듦
update public.meetup_sessions set starts_at = now() - interval '2 days', ends_at = now() - interval '2 days' + interval '2 hours' where id = :'s';

-- 출석: 담당 호스트만
select pg_temp.login_as(:'q');
select throws_ok(format($$ select public.host_mark_attendance(%L, true) $$, :'b'), '42501', null, '참가자는 출석을 체크할 수 없다');
select pg_temp.logout();
select pg_temp.create_member('rvh2@test.local', 'otherHost') as h2 \gset
select pg_temp.published_session(:'h2', 0, 4) as s2 \gset
select pg_temp.login_as(:'h2');
select throws_ok(format($$ select public.host_mark_attendance(%L, true) $$, :'b'), 'P0002', null, '다른 호스트는 출석을 체크할 수 없다');
select pg_temp.logout();
select pg_temp.login_as(:'h');
select lives_ok(format($$ select public.host_mark_attendance(%L, true) $$, :'b'), '담당 호스트는 참석 체크');
select lives_ok(format($$ select public.host_mark_attendance(%L, false) $$, :'bq'), '담당 호스트는 불참 체크');
select is((select attended from public.host_meetup_participants((select meetup_id from public.meetup_sessions where id = :'s')) where booking_id = :'b'), true, '참가자 목록에 출석이 보인다');
select pg_temp.logout();

-- 후기 쓰기
select pg_temp.login_as(:'q');
select throws_ok(format($$ select public.write_review(%L, 5, '남의 신청으로 쓰는 후기입니다') $$, :'b'), 'P0002', null, '남의 신청으로는 후기를 쓸 수 없다');
select throws_ok(format($$ select public.write_review(%L, 5, '불참 처리된 사람의 후기입니다') $$, :'bq'), '22023', null, '불참 처리된 신청은 후기를 쓸 수 없다');
select pg_temp.logout();
select pg_temp.login_as(:'p');
select throws_ok(format($$ select public.write_review(%L, 6, '별점이 범위를 벗어난 후기') $$, :'b'), '22023', null, '별점은 1~5');
select throws_ok(format($$ select public.write_review(%L, 5, '짧아요') $$, :'b'), '22023', null, '10자 미만 거절');
select public.write_review(:'b', 5, '작은 자리라서 깊게 이야기할 수 있었어요.') as rv \gset
select throws_ok(format($$ select public.write_review(%L, 4, '두 번째 후기를 써 봅니다') $$, :'b'), '23505', null, '신청 1건당 후기 1개');
select is((select can_write from public.my_reviewable_bookings() where booking_id = :'b'), false, '쓴 뒤에는 쓸 수 있음 표시가 꺼진다');
select pg_temp.logout();
select ok(exists (select 1 from public.notifications where user_id = :'h' and kind = 'review.new'), '호스트에게 새 후기 알림');

-- 공개 후기: 비로그인도 닉네임·내용만
select pg_temp.login_anon();
select is((select nickname from public.public_reviews((select meetup_id from public.meetup_sessions where id = :'s'))), 'reviewPart', '비로그인도 공개 후기를 본다 (닉네임)');
select is((select review_count from public.review_summary(null, :'h')), 1, '호스트 후기 수');
select is((select count(*)::int from public.public_reviews(null, null)), 0, '조건 없이 전체 후기를 긁어갈 수 없다');
select pg_temp.logout();

-- 호스트 답글: 담당 호스트만
select pg_temp.login_as(:'h2');
select throws_ok(format($$ select public.host_reply_review(%L, '다른 호스트의 답글') $$, :'rv'), 'P0002', null, '다른 호스트는 답글 불가');
select pg_temp.logout();
select pg_temp.login_as(:'h');
select lives_ok(format($$ select public.host_reply_review(%L, '와 주셔서 고마워요!') $$, :'rv'), '담당 호스트 답글');
select pg_temp.logout();

-- 관리자 숨김: 2단계 인증 + 사유 + 감사 기록
select pg_temp.login_as(:'a', 'aal1');
select throws_ok(format($$ select public.admin_set_review_hidden(%L, true, '부적절한 표현 포함') $$, :'rv'), '42501', null, '2단계 인증 전 관리자는 숨김 불가');
select pg_temp.logout();
select pg_temp.login_as(:'a', 'aal2');
select throws_ok(format($$ select public.admin_set_review_hidden(%L, true, '짧') $$, :'rv'), '22023', null, '사유 5자 이상');
select lives_ok(format($$ select public.admin_set_review_hidden(%L, true, '부적절한 표현 포함') $$, :'rv'), '관리자 숨김');
select ok(exists (select 1 from public.audit_logs where action = 'review.hide' and target_id = :'rv'), '숨김은 감사 기록에 남는다');
select pg_temp.logout();
select pg_temp.login_anon();
select is((select count(*)::int from public.public_reviews(null, :'h')), 0, '숨긴 후기는 공개 목록에서 빠진다');
select pg_temp.logout();

-- 참가자 공지: 담당 호스트만, 확정 참가자에게 알림
select pg_temp.login_as(:'p');
select throws_ok(format($$ select public.host_send_session_notice(%L, '참가자가 보내는 공지입니다') $$, :'s'), '42501', null, '참가자는 공지를 보낼 수 없다');
select pg_temp.logout();
select pg_temp.login_as(:'h');
select is(public.host_send_session_notice(:'s', '오늘 비가 와요. 우산 챙겨 오세요.'), 2, '확정 참가자 2명에게 공지');
select pg_temp.logout();

select * from finish();
rollback;
