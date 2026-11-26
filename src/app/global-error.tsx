"use client";

/**
 * 화면 전체 틀(layout)에서 오류가 났을 때의 마지막 안내 화면.
 * 이 파일은 사이트 스타일 없이 그려지므로 필요한 최소한의 스타일을 직접 넣습니다.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, background: "#f7f7f3", color: "#252b33", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "96px 20px" }} data-testid="global-error-page">
          <title>잠시 문제가 생겼어요</title>
          <h1 style={{ fontSize: 30, fontWeight: 300, lineHeight: 1.3, margin: 0 }}>잠시 문제가 생겼어요.</h1>
          <p style={{ marginTop: 20, lineHeight: 1.7, color: "#5b6470" }}>화면을 불러오다가 오류가 났어요. 잠시 뒤에 다시 시도해 주세요.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 28, padding: "12px 24px", background: "#193b63", color: "#fff", border: 0, fontSize: 16, cursor: "pointer" }}
          >
            다시 시도
          </button>
          {error.digest && <p style={{ marginTop: 28, fontSize: 12, color: "#5b6470" }}>접수 번호: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
