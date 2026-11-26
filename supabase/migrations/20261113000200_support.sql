-- ============================================================================
-- 고객센터: 1:1 문의
--  - 회원만 문의 (본인 문의만 조회, 관리자는 2단계 인증 후 전체)
--  - 문의 → 운영팀 답변(알림) → 회원 추가 질문(다시 대기) → 해결 처리
--  - 내 신청 건을 함께 붙일 수 있음 (본인 신청만)
--  - 표에 직접 쓰기 없음, 모두 함수로만. 관리자 답변·상태 변경은 감사 기록
--  - 보관: 전자상거래법상 소비자 불만·분쟁처리 기록 보관 기간(3년) 동안 유지 → 탈퇴해도 삭제하지 않음
--    (처리방침 초안에 명시, 법률 검토에서 확정)
-- ============================================================================

create type public.support_category as enum ('booking', 'refund', 'hosting', 'account', 'safety', 'other');
create type public.support_status as enum ('open', 'answered', 'closed');

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  category public.support_category not null,
  subject text not null check (char_length(subject) between 2 and 80),
  booking_id uuid references public.bookings (id) on delete set null,
  status public.support_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index support_tickets_user_idx on public.support_tickets (user_id, created_at desc);
create index support_tickets_status_idx on public.support_tickets (status, last_message_at desc);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  from_staff boolean not null default false,
  body text not null check (char_length(body) between 5 and 2000),
  created_at timestamptz not null default now()
);
create index support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

revoke all on public.support_tickets from anon, authenticated;
revoke all on public.support_messages from anon, authenticated;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
grant select on public.support_tickets to authenticated;
grant select on public.support_messages to authenticated;

create policy support_tickets_read on public.support_tickets for select to authenticated
  using (user_id = auth.uid() or private.is_admin());
create policy support_messages_read on public.support_messages for select to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or private.is_admin())));

-- 회원: 문의 남기기 ----------------------------------------------------------
create function public.create_support_ticket(p_category public.support_category, p_subject text, p_body text, p_booking_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_subject text := btrim(coalesce(p_subject, ''));
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_user is null or not private.is_active_member() then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if p_category is null then
    raise exception '문의 분야를 골라 주세요' using errcode = '22023';
  end if;
  if char_length(v_subject) < 2 or char_length(v_subject) > 80 then
    raise exception '제목은 2~80자로 적어 주세요' using errcode = '22023';
  end if;
  if char_length(v_body) < 5 or char_length(v_body) > 2000 then
    raise exception '내용은 5~2000자로 적어 주세요' using errcode = '22023';
  end if;
  if p_booking_id is not null and not exists (select 1 from public.bookings where id = p_booking_id and user_id = v_user) then
    raise exception '내 신청 건만 연결할 수 있어요' using errcode = '22023';
  end if;
  -- 도배 방지: 하루 5건
  if (select count(*) from public.support_tickets where user_id = v_user and created_at > now() - interval '1 day') >= 5 then
    raise exception '문의는 하루 5건까지 남길 수 있어요. 기존 문의에 이어서 적어 주세요' using errcode = '22023';
  end if;
  insert into public.support_tickets (user_id, category, subject, booking_id)
  values (v_user, p_category, v_subject, p_booking_id) returning id into v_id;
  insert into public.support_messages (ticket_id, author_id, from_staff, body) values (v_id, v_user, false, v_body);
  return v_id;
end;
$$;
revoke all on function public.create_support_ticket(public.support_category, text, text, uuid) from public, anon;
grant execute on function public.create_support_ticket(public.support_category, text, text, uuid) to authenticated;

-- 회원: 내 문의에 이어서 적기 (해결된 문의도 다시 열림)
create function public.add_support_message(p_ticket_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_user is null or not private.is_active_member() then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if not exists (select 1 from public.support_tickets where id = p_ticket_id and user_id = v_user) then
    raise exception '문의를 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if char_length(v_body) < 5 or char_length(v_body) > 2000 then
    raise exception '내용은 5~2000자로 적어 주세요' using errcode = '22023';
  end if;
  insert into public.support_messages (ticket_id, author_id, from_staff, body) values (p_ticket_id, v_user, false, v_body);
  update public.support_tickets set status = 'open', updated_at = now(), last_message_at = now() where id = p_ticket_id;
end;
$$;
revoke all on function public.add_support_message(uuid, text) from public, anon;
grant execute on function public.add_support_message(uuid, text) to authenticated;

-- 관리자: 답변 (회원에게 알림, 감사 기록) --------------------------------------
create function public.admin_reply_support(p_ticket_id uuid, p_body text, p_close boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket record;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  select * into v_ticket from public.support_tickets where id = p_ticket_id for update;
  if not found then
    raise exception '문의를 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if char_length(v_body) < 5 or char_length(v_body) > 2000 then
    raise exception '답변은 5~2000자로 적어 주세요' using errcode = '22023';
  end if;
  insert into public.support_messages (ticket_id, author_id, from_staff, body) values (p_ticket_id, auth.uid(), true, v_body);
  update public.support_tickets
     set status = case when coalesce(p_close, false) then 'closed'::public.support_status else 'answered'::public.support_status end,
         updated_at = now(), last_message_at = now()
   where id = p_ticket_id;
  perform private.notify(v_ticket.user_id, 'support_reply', '문의에 답변이 도착했어요', v_ticket.subject, '/me/support/' || p_ticket_id);
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, after)
  values (auth.uid(), 'admin', 'support.reply', 'support_ticket', p_ticket_id, jsonb_build_object('close', coalesce(p_close, false)));
end;
$$;
revoke all on function public.admin_reply_support(uuid, text, boolean) from public, anon;
grant execute on function public.admin_reply_support(uuid, text, boolean) to authenticated;

create function public.admin_set_support_status(p_ticket_id uuid, p_status public.support_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.support_status;
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  select status into v_before from public.support_tickets where id = p_ticket_id for update;
  if not found then
    raise exception '문의를 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if p_status is null then
    raise exception '상태를 골라 주세요' using errcode = '22023';
  end if;
  update public.support_tickets set status = p_status, updated_at = now() where id = p_ticket_id;
  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after)
  values (auth.uid(), 'admin', 'support.status', 'support_ticket', p_ticket_id,
          jsonb_build_object('status', v_before), jsonb_build_object('status', p_status));
end;
$$;
revoke all on function public.admin_set_support_status(uuid, public.support_status) from public, anon;
grant execute on function public.admin_set_support_status(uuid, public.support_status) to authenticated;
