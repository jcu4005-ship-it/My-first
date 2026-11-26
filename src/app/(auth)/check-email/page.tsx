import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "메일을 확인해 주세요" };

export default function CheckEmailPage() {
  return (
    <section data-testid="check-email">
      <h1 className="font-display text-3xl font-bold">메일을 확인해 주세요</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        입력하신 주소로 안내 메일을 보냈습니다. 메일의 링크를 눌러 다음 단계를 진행해 주세요.
        메일이 보이지 않으면 스팸함을 확인해 주세요.
      </p>
      <p className="mt-8 text-sm">
        <Link href="/login" className="underline underline-offset-4">
          로그인 화면으로
        </Link>
      </p>
    </section>
  );
}
