-- ============================================================================
-- 수수료는 항상 20%: 승인 후 0% 기간을 없앰 (2026-11-27 대표 결정)
--  - 표 구조는 바꾸지 않고 "설정값"만 바꿈: 기본 0% 기간을 6개월 → 0개월, 현재 값도 0개월·수수료율 20%로 맞춤
--  - 이미 만들어진 정산(settlements)은 결제 당시의 비율이 그대로 남음(소급 변경 없음)
--  - 0% 기간 기능 자체는 남겨 둠: 관리자 정산 화면에서 다시 바꿀 수 있음(되돌리기 쉬움)
-- ============================================================================
alter table public.app_settings alter column commission_free_months set default 0;
update public.app_settings set commission_free_months = 0, commission_rate_bp = 2000 where id;
