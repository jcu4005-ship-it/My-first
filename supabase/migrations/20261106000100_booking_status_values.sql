-- 결제 대기·만료 상태 추가 (새 값은 다음 마이그레이션부터 사용)
alter type public.booking_status add value if not exists 'pending_payment';
alter type public.booking_status add value if not exists 'expired';
