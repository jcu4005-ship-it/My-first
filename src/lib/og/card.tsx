import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { SYMBOL, WORDMARK } from "@/components/brand/logo-paths";
import { brand } from "@/config/brand";

/**
 * 카톡·문자·SNS 공유 미리보기 카드 (1200×630).
 * 왼쪽 사진(크리에이터·프로그램), 오른쪽 아이보리 면에 제목과 정보 — 메인 "잡지" 디자인과 같은 말투.
 * 글꼴은 Pretendard OTF(OFL)를 함께 배포합니다(woff2는 이미지 생성기가 읽지 못함).
 */
export const OG_SIZE = { width: 1200, height: 630 };

const INK = "#121311";
const PAPER = "#f3f0ea";
const FOREST = "#1c3326";
const EMBER = "#d2522b";
const FOG = "#5c5a54";

let fontCache: Promise<{ name: string; data: Buffer; weight: 500 | 800; style: "normal" }[]> | null = null;
function fonts() {
  fontCache ??= Promise.all([
    readFile(join(process.cwd(), "src/app/fonts/og/Pretendard-Medium.otf")),
    readFile(join(process.cwd(), "src/app/fonts/og/Pretendard-ExtraBold.otf")),
  ]).then(([m, b]) => [
    { name: "Pretendard", data: m, weight: 500 as const, style: "normal" as const },
    { name: "Pretendard", data: b, weight: 800 as const, style: "normal" as const },
  ]);
  return fontCache;
}

/** 사이트 안 사진(/images/…)은 파일을 읽어 넣고, 외부 사진(https)은 주소 그대로 */
async function photoSrc(src: string | null | undefined): Promise<string | null> {
  if (!src) return null;
  if (/^https:\/\//.test(src)) return src;
  if (!/^\/images\/[a-z0-9/_-]+\.(jpe?g|png)$/i.test(src)) return null;
  try {
    const buf = await readFile(join(process.cwd(), "public", src));
    return `data:image/${src.endsWith(".png") ? "png" : "jpeg"};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** 제호: O 자리에 의자 (logo.tsx 의 LogoWordmarkChair 와 같은 배치) */
function Wordmark({ width, color }: { width: number; color: string }) {
  const scale = 375 / 1204;
  const tx = 727.5 - (1114 * scale) / 2 - 24 * scale;
  const ty = 9 - 19 * scale;
  return (
    <svg width={width} height={(width * 464) / 2680} viewBox={WORDMARK.viewBox} fill={color}>
      <g transform={WORDMARK.transform}>
        {WORDMARK.paths.slice(1).map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
        <g transform={SYMBOL.transform}>
          {SYMBOL.paths.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </g>
    </svg>
  );
}

export type OgCardInput = {
  kicker: string; // 예: "PROGRAM · 창작·표현"
  title: string;
  byline?: string | null; // 예: "with 홍지완 · 스피치 강사"
  meta?: string | null; // 예: "11월 20일 (금) 19:00 · 용산 · 30,000원"
  photo?: string | null;
  photoPosition?: string; // 사진 초점 (얼굴이 위쪽이면 "50% 15%")
};

export async function ogCard(input: OgCardInput): Promise<ImageResponse> {
  const [photo, fontList] = await Promise.all([photoSrc(input.photo), fonts()]);
  const title = input.title.length > 34 ? `${input.title.slice(0, 33)}…` : input.title;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: PAPER, fontFamily: "Pretendard" }}>
        {/* 왼쪽 사진 (없으면 숲색 면 + 의자) */}
        <div style={{ width: 470, height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: FOREST, position: "relative" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" width={470} height={630} style={{ width: 470, height: 630, objectFit: "cover", objectPosition: input.photoPosition ?? "50% 20%" }} />
          ) : (
            <svg width={200} height={(200 * 1272) / 1176} viewBox={SYMBOL.viewBox} fill={PAPER}>
              <g transform={SYMBOL.transform}>
                {SYMBOL.paths.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </g>
            </svg>
          )}
        </div>
        {/* 오른쪽 글 */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "52px 60px 48px 56px" }}>
          <Wordmark width={250} color={INK} />
          <div style={{ display: "flex", marginTop: 14, borderTop: `3px solid ${INK}`, paddingTop: 10, fontSize: 19, fontWeight: 800, letterSpacing: 3, color: INK }}>
            {brand.tagline.replace(/\.$/, "")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "flex-end" }}>
            <div style={{ display: "flex", fontSize: 21, fontWeight: 800, letterSpacing: 4, color: EMBER }}>{input.kicker}</div>
            <div style={{ display: "flex", marginTop: 14, fontSize: 58, fontWeight: 800, lineHeight: 1.16, letterSpacing: -2, color: INK, wordBreak: "keep-all" }}>{title}</div>
            {input.byline && <div style={{ display: "flex", marginTop: 18, fontSize: 27, fontWeight: 500, color: INK }}>{input.byline}</div>}
            {input.meta && <div style={{ display: "flex", marginTop: 10, fontSize: 23, fontWeight: 500, color: FOG }}>{input.meta}</div>}
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fontList },
  );
}
