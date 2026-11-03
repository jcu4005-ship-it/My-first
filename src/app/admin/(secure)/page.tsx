import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "관리자" };

// 권한 확인이 끝나기 전에는 응답을 시작하지 않음 → 권한 없으면 HTTP 403
export const instant = false;

export default async function Page() {
  const admin = await requireAdmin("/admin");
  return (
    <div data-testid="admin-dashboard">
      <h1 className="font-display text-3xl font-bold">관리자 대시보드</h1>
      <p className="mt-3 text-muted-foreground">{admin.nickname}님 · 2단계 인증 완료</p>
      <ul className="mt-8 grid gap-3 text-sm sm:grid-cols-2">
        <li className="rounded-xl border p-5">
          <p className="font-medium">회원 관리</p>
          <p className="mt-1 text-muted-foreground">회원 조회, 역할(호스트·관리자) 부여·회수, 이용 정지</p>
        </li>
        <li className="rounded-xl border p-5">
          <p className="font-medium">감사 기록</p>
          <p className="mt-1 text-muted-foreground">관리자 작업 이력 — 수정·삭제할 수 없습니다</p>
        </li>
      </ul>
      <p className="mt-8 text-xs text-muted-foreground">호스트 승인·모임 검수·거래·정산 메뉴는 이후 단계에서 추가됩니다.</p>
    </div>
  );
}
