-- 스테이징 전용: 자동 검증이 가입·유료 신청 흐름을 시험할 수 있도록 시험용 값으로 맞춤
-- (운영 DB에는 실행하지 않음. 운영 기본값은 초대제 켬·유료 신청 막음)
update public.app_settings set invite_only = false, paid_bookings_enabled = true where id;
