-- 자리 수 계산 무작위 시험: 신청·결제 확정·취소·결제 시간 만료·정리 작업을 무작위로 400번 섞어 돌려도
-- (1) 예약된 자리 수 = 살아 있는 신청(확정+결제 대기)의 인원 합계, (2) 정원을 넘지 않음, (3) 음수가 되지 않음 이 항상 맞아야 한다.
-- 무작위 순서는 고정(setseed)이라 실패하면 같은 순서로 다시 재현된다.
begin;
\ir _helpers.psql
select plan(3);

select pg_temp.create_member('fz_h@test.local', 'fzHost') as h \gset
select pg_temp.create_member('fz_a@test.local', 'fzA') as a \gset
select pg_temp.create_member('fz_b@test.local', 'fzB') as b \gset
select pg_temp.create_member('fz_c@test.local', 'fzC') as c \gset
select pg_temp.create_member('fz_d@test.local', 'fzD') as d \gset
select pg_temp.create_member('fz_e@test.local', 'fzE') as e \gset
select set_config('t.sid', pg_temp.published_session(:'h', 20000, 5, 2)::text, false);
select set_config('t.users', array_to_string(array[:'a', :'b', :'c', :'d', :'e'], ','), false);
select setseed(0.42);

create or replace function pg_temp.fuzz(p_rounds int) returns text language plpgsql as $$
declare
  v_sid uuid := current_setting('t.sid')::uuid;
  v_users uuid[] := string_to_array(current_setting('t.users'), ',')::uuid[];
  v_user uuid; v_op int; v_bid uuid; v_amount int; v_i int;
  v_reserved int; v_alive int; v_cap int;
  v_log text := '';
begin
  for v_i in 1..p_rounds loop
    v_user := v_users[1 + floor(random() * 5)::int];
    v_op := floor(random() * 6)::int;
    begin
      if v_op in (0, 1) then          -- 신청 (1~2명)
        perform pg_temp.login_as(v_user);
        perform public.book_session(v_sid, 1 + floor(random() * 2)::int);
      elsif v_op = 2 then             -- 결제 확정 (서버)
        select id, total_price into v_bid, v_amount from public.bookings
         where session_id = v_sid and status = 'pending_payment' order by random() limit 1;
        if v_bid is not null then
          perform pg_temp.login_service();
          perform public.confirm_payment(v_bid, 'mock', 'fz' || v_i, v_amount);
        end if;
      elsif v_op = 3 then             -- 취소 (본인 신청 중 하나)
        select id into v_bid from public.bookings
         where session_id = v_sid and user_id = v_user and status in ('pending_payment', 'confirmed') limit 1;
        if v_bid is not null then
          perform pg_temp.login_as(v_user);
          perform public.cancel_booking(v_bid);
        end if;
      elsif v_op = 4 then             -- 결제 시간이 지나 버림 (소유자 권한으로 만료 시각만 과거로)
        perform pg_temp.logout();
        update public.bookings set hold_expires_at = now() - interval '1 minute'
         where id = (select id from public.bookings where session_id = v_sid and status = 'pending_payment' order by random() limit 1);
      else                            -- 정리 작업 (매분 도는 예약 작업과 같은 함수)
        perform pg_temp.logout();
        perform private.expire_all_holds();
      end if;
    exception when others then
      null; -- 규칙상 거부(자리 부족·이미 신청 등)는 정상
    end;
    perform pg_temp.logout();
    select reserved_count, capacity into v_reserved, v_cap from public.meetup_sessions where id = v_sid;
    select coalesce(sum(quantity), 0) into v_alive from public.bookings where session_id = v_sid and status in ('confirmed', 'pending_payment');
    v_log := right(v_log || v_op, 60);
    if v_reserved <> v_alive or v_reserved < 0 or v_reserved > v_cap then
      return format('라운드 %s 에서 어긋남: reserved=%s, 살아있는 신청=%s, 정원=%s, 최근 동작=%s', v_i, v_reserved, v_alive, v_cap, v_log);
    end if;
  end loop;
  return 'ok';
end $$;

select is(pg_temp.fuzz(400), 'ok', '무작위 400번: 예약된 자리 수는 언제나 살아 있는 신청의 인원 합과 같고 정원을 넘지 않는다');
select is((select count(*)::int from public.bookings where session_id = current_setting('t.sid')::uuid and status = 'confirmed' and total_price > 0 and not exists (select 1 from public.payments p where p.booking_id = bookings.id and p.status = 'paid')), 0, '확정된 유료 신청에는 반드시 결제 완료 기록이 있다');
select is((select count(*)::int from public.payments p join public.bookings b on b.id = p.booking_id where b.session_id = current_setting('t.sid')::uuid and p.status = 'ready' and b.status <> 'pending_payment'), 0, '결제 대기가 아닌 신청에 결제 준비 상태가 남아 있지 않다');

select * from finish();
rollback;
