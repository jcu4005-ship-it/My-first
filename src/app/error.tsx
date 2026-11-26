"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { businessInfoRows } from "@/config/business";

/**
 * 예상하지 못한 오류가 났을 때 보이는 안내 화면 (이게 없으면 기본 영문 오류 화면이 나와 사용자가 당황함).
 * 오류 내용(기술 정보)은 화면에 보이지 않게 하고, 다시 시도·홈으로 가기·문의 방법만 안내합니다.
 * 접수 번호(digest)는 운영자가 서버 기록에서 같은 오류를 찾는 데 씁니다.
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error); // 서버·브라우저 기록에 남김 (개인정보는 오류 문구에 담지 않음)
  }, [error]);
  const email = businessInfoRows().find((r) => r.key === "csEmail")?.value;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-20" data-testid="error-page">
      <p className="cap text-[12px] font-semibold text-brand">Something went wrong</p>
      <h1 className="font-display mt-3 text-[30px] leading-[1.3] font-light break-keep sm:text-[40px]">잠시 문제가 생겼어요.</h1>
      <p className="mt-5 leading-relaxed text-muted-foreground">
        화면을 불러오다가 오류가 났어요. 입력하신 내용은 저장되지 않았을 수 있어요. 잠시 뒤에 다시 시도해 주세요.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button type="button" size="lg" onClick={() => retry()}>다시 시도</Button>
        <Link href="/" className="text-[15px] font-semibold underline underline-offset-4">홈으로 가기</Link>
      </div>
      {error.digest && <p className="mt-8 text-xs text-muted-foreground">문의하실 때 접수 번호를 알려 주세요: <span className="font-mono">{error.digest}</span></p>}
      {email && <p className="mt-2 text-xs text-muted-foreground">문의: {email}</p>}
    </main>
  );
}
