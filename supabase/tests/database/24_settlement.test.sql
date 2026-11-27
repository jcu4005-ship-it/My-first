-- 정산: 결제 완료 시 수수료율 고정, 승인 6개월 안은 0%, 환불 반영, 관리자 확정·지급 기록(2단계·감사), 본인만 조회
begin;
\ir _helpers.psql
select plan(22);

select pg_temp.create_member('sth@test.local', 'settleHost') as h \gset
select pg_temp.create_member('sth2@test.local', 'settleHostNew') as h2 \gset
select pg_temp.create_member('stp@test.local', 'settlePart') as p \gset
select pg_temp.create_member('sta@test.local', 'settleAdmin') as a \gset
select pg_temp.grant_role_direct(:'a', 'admin');

select pg_temp.published_session(:'h', 30000, 6) as s \gset
select pg_temp.published_session(:'h2', 30000, 6) as s2 \gset
-- h는 7개월 전에 승인(0% 기간 지남), h2는 오늘 승인(0% 기간 안)
update public.host_profiles set reviewed_at = now() - interval '7 months' where user_id = :'h';
update public.host_profiles set reviewed_at = now() where user_id = :'h2';

select is((select commission_rate_bp from public.app_settings), 2000, '기본 수수료율 20%');
select is((select commission_free_months from public.app_settings), 0, '기본 0% 기간 없음 (수수료는 항상 20%)');
-- 0% 기간 기능은 남아 있으므로, 아래 시험에서는 이 안에서만 6개월로 켜서 동작을 계속 검증 (시험이 끝나면 되돌려짐)
update public.app_settings set commission_free_months = 6;

-- 결제 → 정산 행
select pg_temp.login_as(:'p');
select public.book_session(:'s', 1) as b \gset
select public.book_session(:'s2', 1) as b2 \gset
select pg_temp.logout();
select pg_temp.login_service();
select public.confirm_payment(:'b', 'mock', 'mock_st1', 30000);
select public.confirm_payment(:'b2', 'mock', 'mock_st2', 30000);
select pg_temp.logout();

select is((select commission_rate_bp || '/' || commission_amount || '/' || net_amount from public.settlements where booking_id = :'b'), '2000/6000/24000', '0% 기간이 지난 호스트: 수수료 20% 빼고 정산');
select is((select commission_rate_bp || '/' || net_amount from public.settlements where booking_id = :'b2'), '0/30000', '승인 6개월 안: 수수료 0%');
select is((select mode from public.settlements where booking_id = :'b'), 'test', '실결제 전까지 정산도 테스트');

-- 표 직접 접근 불가, 본인 정산만
select pg_temp.login_as(:'h');
select throws_ok($$ select * from public.settlements $$, '42501', null, '정산 표는 직접 읽을 수 없다');
select is((select count(*)::int from public.host_my_settlements()), 1, '호스트는 자기 정산만 본다');
select is((select rate_bp from public.host_my_commission()), 2000, '내 수수료율 20%');
select pg_temp.logout();
select pg_temp.login_as(:'h2');
select is((select rate_bp from public.host_my_commission()), 0, '0% 기간 안의 호스트');
select pg_temp.logout();
select pg_temp.login_as(:'p');
select is((select count(*)::int from public.host_my_settlements()), 0, '참가자는 정산을 볼 수 없다');
select pg_temp.logout();

-- 수수료율을 바꿔도 지난 결제는 그대로
select pg_temp.login_as(:'a', 'aal1');
select throws_ok($$ select public.admin_set_commission(1500, 3, '수수료율 조정 시험') $$, '42501', null, '2단계 인증 전 관리자는 수수료 변경 불가');
select pg_temp.logout();
select pg_temp.login_as(:'a', 'aal2');
select throws_ok($$ select public.admin_set_commission(6000, 3, '너무 높은 수수료') $$, '22023', null, '수수료율 0~50%');
select lives_ok($$ select public.admin_set_commission(1500, 3, '수수료율 조정 시험') $$, '관리자 수수료 변경');
select pg_temp.logout();
select ok(exists (select 1 from public.audit_logs where action = 'settings.commission'), '수수료 변경은 감사 기록');
select is((select commission_amount from public.settlements where booking_id = :'b'), 6000, '지난 결제의 수수료는 그대로(결제 시점에 고정)');

-- 확정: 프로그램 끝나고 7일 뒤부터
select id as st from public.settlements where booking_id = :'b' \gset
select pg_temp.login_as(:'a', 'aal2');
select throws_ok(format($$ select public.admin_advance_settlement(%L, 'confirm', '정산 확정 시험') $$, :'st'), '22023', null, '프로그램 전에는 확정 불가');
select pg_temp.logout();
update public.meetup_sessions set starts_at = now() - interval '10 days', ends_at = now() - interval '10 days' + interval '2 hours' where id = :'s';
select pg_temp.login_as(:'a', 'aal2');
select throws_ok(format($$ select public.admin_advance_settlement(%L, 'paid', '지급 시험 메모') $$, :'st'), '22023', null, '확정 전에는 지급 기록 불가');
select lives_ok(format($$ select public.admin_advance_settlement(%L, 'confirm', '정산 확정 시험') $$, :'st'), '7일 지나면 확정');
select lives_ok(format($$ select public.admin_advance_settlement(%L, 'paid', '11월 1차 지급') $$, :'st'), '지급 완료 기록');
select pg_temp.logout();
select ok(exists (select 1 from public.audit_logs where action = 'settlement.paid'), '지급 기록은 감사 기록');
select ok(exists (select 1 from public.notifications where user_id = :'h' and kind = 'settlement.paid'), '호스트에게 지급 알림');

-- 전액 환불이면 정산 취소
select pg_temp.login_service();
select public.refund_booking(:'b2', :'p', 'cancelled_by_user', '개인 사정');
select pg_temp.logout();
select is((select status::text || '/' || net_amount from public.settlements where booking_id = :'b2'), 'cancelled/0', '전액 환불되면 정산도 취소');

select * from finish();
rollback;
