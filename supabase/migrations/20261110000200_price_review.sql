-- ============================================================================
-- 참가비 공동 결정: 호스트가 제안(가격 근거 포함) → 운영팀 검수에서 승인
--  - price_rationale: 가격 근거 (시간·재료비·정원·결과물). 유료 프로그램은 검수 요청 때 10자 이상 필수
--  - 공개된 프로그램의 참가비를 "올리면" 자동으로 검수 대기로 돌아감 (내리는 것은 바로 반영)
--    감사 기록을 남김. 확정 신청이 있으면 참가비 변경 자체가 막힘 (기존 규칙 유지)
-- ============================================================================

alter table public.meetups
  add column price_rationale text not null default '' check (char_length(price_rationale) <= 500);
grant select (price_rationale) on public.meetups to authenticated;
grant insert (price_rationale) on public.meetups to authenticated;
grant update (price_rationale) on public.meetups to authenticated;

create or replace function private.guard_meetup_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.price is distinct from old.price and exists (
    select 1 from public.bookings b join public.meetup_sessions s on s.id = b.session_id
    where s.meetup_id = old.id and b.status = 'confirmed'
  ) then
    raise exception '확정된 신청이 있어 참가비를 바꿀 수 없습니다' using errcode = '22023';
  end if;
  -- 공개 중 참가비 인상 → 다시 검수 (공개 목록에서 내려감)
  if old.status = 'published' and new.status = 'published' and new.price > old.price then
    new.status := 'pending_review';
    insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after)
    values (auth.uid(), 'member', 'meetup.price_increase', 'meetup', old.id,
            jsonb_build_object('price', old.price, 'status', old.status),
            jsonb_build_object('price', new.price, 'status', 'pending_review'));
  end if;
  return new;
end;
$$;
revoke all on function private.guard_meetup_update() from public, anon, authenticated;

create or replace function public.host_set_meetup_status(p_meetup_id uuid, p_action text)
returns public.meetup_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  v_next public.meetup_status;
begin
  if not private.is_approved_host() then
    raise exception '승인된 호스트만 할 수 있습니다' using errcode = '42501';
  end if;
  select * into m from public.meetups where id = p_meetup_id and host_id = auth.uid() for update;
  if not found then
    raise exception '모임을 찾을 수 없습니다' using errcode = 'P0002';
  end if;

  if p_action = 'submit' and m.status in ('draft', 'rejected') then
    if m.meetup_type = 'alcohol' then
      raise exception '주류가 포함된 모임은 운영 검토가 끝난 뒤 열 수 있습니다' using errcode = '22023';
    end if;
    if not exists (select 1 from public.meetup_sessions where meetup_id = m.id and status = 'open' and starts_at > now()) then
      raise exception '앞으로 열릴 일정을 하나 이상 추가해 주세요' using errcode = '22023';
    end if;
    if m.price > 0 and char_length(trim(m.price_rationale)) < 10 then
      raise exception '유료 프로그램은 가격 근거를 10자 이상 적어 주세요' using errcode = '22023';
    end if;
    v_next := 'pending_review';
  elsif p_action = 'withdraw' and m.status = 'pending_review' then
    v_next := 'draft';
  elsif p_action = 'close' and m.status = 'published' then
    v_next := 'archived';
  else
    raise exception '지금 상태(%)에서는 할 수 없는 작업입니다', m.status using errcode = '22023';
  end if;

  update public.meetups set status = v_next where id = m.id;
  return v_next;
end;
$$;
