import Link from "next/link";

/** 403 — 권한이 없는 화면에 접근했을 때 */
export default function Forbidden() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16" data-testid="forbidden">
      <p className="text-sm tracking-[0.2em] text-accent">403</p>
      <h1 className="mt-3 font-display text-3xl font-bold">접근 권한이 없습니다</h1>
      <p className="mt-4 text-muted-foreground">이 화면을 볼 수 있는 권한이 없거나, 이용이 제한된 계정입니다.</p>
      <Link href="/" className="mt-8 text-sm underline underline-offset-4">
        홈으로
      </Link>
    </main>
  );
}
