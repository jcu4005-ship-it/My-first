import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16" data-testid="not-found">
      <p className="text-sm tracking-[0.2em] text-accent">404</p>
      <h1 className="mt-3 font-display text-3xl font-bold">페이지를 찾을 수 없어요</h1>
      <p className="mt-4 text-muted-foreground">모임이 종료되었거나 주소가 바뀌었을 수 있습니다.</p>
      <Link href="/meetups" className="mt-8 text-sm underline underline-offset-4">
        다른 모임 둘러보기
      </Link>
    </main>
  );
}
