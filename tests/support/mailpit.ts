import { testEnv } from "./env";

type MailpitSearch = { messages: { ID: string; Subject: string }[] };

/** 로컬 테스트 메일함(Mailpit)에서 해당 주소로 온 최신 메일의 인증 링크를 찾습니다. */
export async function latestAuthLink(email: string, kind: "email" | "recovery", timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${testEnv.mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    if (res.ok) {
      const { messages } = (await res.json()) as MailpitSearch;
      for (const m of messages) {
        const detail = (await (await fetch(`${testEnv.mailpitUrl}/api/v1/message/${m.ID}`)).json()) as { HTML: string };
        const match = detail.HTML.match(/href="([^"]*\/auth\/confirm\?[^"]*)"/);
        if (match) {
          const link = match[1].replace(/&amp;/g, "&");
          if (new URL(link).searchParams.get("type") === kind) return link;
        }
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`메일을 찾지 못했습니다: ${email} (${kind})`);
}
