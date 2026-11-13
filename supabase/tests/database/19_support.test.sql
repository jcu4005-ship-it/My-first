-- 고객센터 1:1 문의: 본인만 조회, 함수로만 작성, 관리자 답변(알림·감사 기록), 이어서 적기, 도배 방지
begin;
\ir _helpers.psql
select plan(18);

select pg_temp.create_member('sp1@test.local', 'supUser1') as u1 \gset
select pg_temp.create_member('sp2@test.local', 'supUser2') as u2 \gset
select pg_temp.create_member('spa@test.local', 'supAdmin') as a \gset
select pg_temp.create_member('sph@test.local', 'supHost') as h \gset
select pg_temp.grant_role_direct(:'a', 'admin');
select pg_temp.published_session(:'h', 0, 6) as s \gset

-- 회원 2의 신청 (회원 1이 붙이면 거부되어야 함)
select pg_temp.login_as(:'u2');
select public.book_session(:'s'::uuid, 1);
select pg_temp.logout();
select id as b2 from public.bookings where user_id = :'u2' \gset

-- 비로그인은 문의 불가
select pg_temp.login_anon();
select throws_ok($$ select public.create_support_ticket('other', '제목입니다', '내용을 적습니다', null) $$, '42501', null, '비로그인은 문의 함수 실행 불가');
select pg_temp.logout();

select pg_temp.login_as(:'u1');
select throws_ok($$ insert into public.support_tickets (user_id, category, subject) values (auth.uid(), 'other', '직접 쓰기') $$, '42501', null, '표에 직접 쓰기 불가');
select throws_ok($$ select public.create_support_ticket('other', '제', '내용을 적습니다', null) $$, '22023', '제목은 2~80자로 적어 주세요', '제목 길이 검사');
select throws_ok($$ select public.create_support_ticket('other', '제목입니다', '짧음', null) $$, '22023', '내용은 5~2000자로 적어 주세요', '내용 길이 검사');
select throws_ok(format($$ select public.create_support_ticket('booking', '남의 신청', '다른 사람 신청을 붙여 봅니다', %L::uuid) $$, :'b2'), '22023', '내 신청 건만 연결할 수 있어요', '남의 신청은 연결 불가');
select lives_ok($$ select public.create_support_ticket('refund', '환불 문의', '환불은 언제 되나요? 궁금합니다.', null) $$, '문의 남기기');
select is((select status::text from public.support_tickets where user_id = auth.uid()), 'open', '새 문의는 답변 대기');
select pg_temp.logout();
select id as t from public.support_tickets where user_id = :'u1' \gset

-- 다른 회원은 볼 수 없음
select pg_temp.login_as(:'u2');
select is((select count(*)::int from public.support_tickets where id = :'t'), 0, '다른 회원의 문의는 보이지 않는다');
select is((select count(*)::int from public.support_messages where ticket_id = :'t'), 0, '다른 회원의 문의 내용도 보이지 않는다');
select throws_ok(format($$ select public.add_support_message(%L::uuid, '남의 문의에 끼어들기') $$, :'t'), 'P0002', '문의를 찾을 수 없습니다', '남의 문의에 이어 적기 불가');
select pg_temp.logout();

-- 관리자: 2단계 인증 전 불가 → 답변 → 알림·감사 기록
select pg_temp.login_as(:'a', 'aal1');
select throws_ok(format($$ select public.admin_reply_support(%L::uuid, '답변드립니다. 확인해 보겠습니다.', false) $$, :'t'), '42501', null, '2단계 인증 전 관리자 답변 불가');
select pg_temp.logout();
select pg_temp.login_as(:'a', 'aal2');
select is((select count(*)::int from public.support_tickets where id = :'t'), 1, '관리자는 문의를 볼 수 있다');
select lives_ok(format($$ select public.admin_reply_support(%L::uuid, '환불은 취소 후 영업일 기준 3일 안에 처리돼요.', false) $$, :'t'), '관리자 답변');
select pg_temp.logout();
select is((select status::text from public.support_tickets where id = :'t'), 'answered', '답변하면 답변 완료');
select ok(exists(select 1 from public.notifications where user_id = :'u1' and kind = 'support_reply'), '회원에게 답변 알림');
select ok(exists(select 1 from public.audit_logs where action = 'support.reply' and target_id = :'t'), '답변 감사 기록');

-- 회원이 이어서 적으면 다시 답변 대기
select pg_temp.login_as(:'u1');
select public.add_support_message(:'t'::uuid, '추가로 궁금한 점이 있어요.');
select is((select status::text from public.support_tickets where id = :'t'), 'open', '이어서 적으면 다시 답변 대기');
-- 도배 방지: 하루 5건
select public.create_support_ticket('other', '문의 ' || g, '도배 방지 시험 내용입니다', null) from generate_series(2, 5) g;
select throws_ok($$ select public.create_support_ticket('other', '여섯 번째', '도배 방지 시험 내용입니다', null) $$, '22023', '문의는 하루 5건까지 남길 수 있어요. 기존 문의에 이어서 적어 주세요', '하루 5건 제한');
select pg_temp.logout();

select * from finish();
rollback;
