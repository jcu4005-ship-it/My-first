#!/usr/bin/env bash
# 로컬/CI의 일회용 Supabase 값을 테스트용 환경변수로 출력합니다.
#   사용: eval "$(bash scripts/test-env.sh)"
set -euo pipefail
eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY|DB_URL|MAILPIT_URL)=')"
echo "export TEST_SUPABASE_URL=${API_URL}"
echo "export TEST_SUPABASE_PUBLISHABLE_KEY=${PUBLISHABLE_KEY}"
echo "export TEST_SUPABASE_SECRET_KEY=${SECRET_KEY}"
echo "export TEST_DB_URL=${DB_URL}"
echo "export TEST_MAILPIT_URL=${MAILPIT_URL:-http://127.0.0.1:54324}"
echo "export NEXT_PUBLIC_SUPABASE_URL=${API_URL}"
echo "export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${PUBLISHABLE_KEY}"
echo "export SUPABASE_SECRET_KEY=${SECRET_KEY}"
