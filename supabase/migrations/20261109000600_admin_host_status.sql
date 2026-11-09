-- ============================================================================
-- 호스트 생태계 7단계: 관리자 호스트 활동 중지 / 재개
--  - 중지: 승인된 호스트 → suspended. 호스트 페이지·프로그램·저널 글이 공개 화면에서 사라짐(RLS)
--    프로그램·글의 상태 자체는 바꾸지 않으므로, 재개하면 그대로 다시 보임
--  - 예정된 참가 신청이 있으면 중지할 수 없음 (참가자 예약을 깨지 않기 위해 — 먼저 일정 정리)
--  - 탈퇴한 호스트는 재개 불가
--  - 사유 필수, 감사 기록, 호스트에게 알림
-- ============================================================================

create function public.admin_set_host_active(p_user_id uuid, p_active boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  h record;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_active_bookings int;
begin
  if not private.is_admin() then
    raise exception 'forbidden: 관리자(2단계 인증) 권한이 필요합니다' using errcode = '42501';
  end if;
  if char_length(coalesce(v_reason, '')) < 5 then
    raise exception '사유를 5자 이상 입력하세요' using errcode = '22023';
  end if;
  select hp.user_id, hp.status, hp.display_name, p.status as member_status
    into h
    from public.host_profiles hp join public.profiles p on p.id = hp.user_id
   where hp.user_id = p_user_id
   for update of hp;
  if not found then
    raise exception '호스트를 찾을 수 없습니다' using errcode = 'P0002';
  end if;

  if p_active then
    if h.status <> 'suspended' then
      raise exception '활동 중지된 호스트만 다시 활성화할 수 있습니다' using errcode = '22023';
    end if;
    if h.member_status <> 'active' or h.display_name = '탈퇴한 호스트' then
      raise exception '탈퇴했거나 이용이 제한된 회원은 다시 활성화할 수 없습니다' using errcode = '22023';
    end if;
    update public.host_profiles set status = 'approved' where user_id = p_user_id;
  else
    if h.status <> 'approved' then
      raise exception '승인된 호스트만 활동을 중지할 수 있습니다' using errcode = '22023';
    end if;
    select count(*) into v_active_bookings
      from public.bookings b
      join public.meetup_sessions s on s.id = b.session_id
      join public.meetups m on m.id = s.meetup_id
     where m.host_id = p_user_id and b.status in ('confirmed', 'pending_payment') and s.starts_at > now();
    if v_active_bookings > 0 then
      raise exception '예정된 참가 신청이 %건 있어요. 일정 취소·환불을 먼저 정리한 뒤 중지할 수 있습니다', v_active_bookings
        using errcode = '22023';
    end if;
    update public.host_profiles set status = 'suspended', is_featured = false, featured_order = null where user_id = p_user_id;
  end if;

  insert into public.audit_logs (actor_id, actor_kind, action, target_type, target_id, before, after, reason)
  values (auth.uid(), 'admin', case when p_active then 'host.reactivate' else 'host.deactivate' end, 'host', p_user_id,
          jsonb_build_object('status', h.status), jsonb_build_object('status', case when p_active then 'approved' else 'suspended' end), v_reason);

  perform private.notify(
    p_user_id,
    case when p_active then 'host.reactivated' else 'host.deactivated' end,
    case when p_active then '호스트 활동이 다시 시작되었어요' else '호스트 활동이 일시 중지되었어요' end,
    v_reason,
    case when p_active then '/host' else '/me' end
  );
end;
$$;
revoke all on function public.admin_set_host_active(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_host_active(uuid, boolean, text) to authenticated;
