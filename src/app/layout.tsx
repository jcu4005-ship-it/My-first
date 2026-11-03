import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Noto_Serif_KR } from "next/font/google";

import { brand, displayName } from "@/config/brand";
import { assertValidEnv } from "@/config/env";
import { EnvironmentBanner } from "@/components/environment-banner";
import "./globals.css";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "45 920",
});

const displaySerif = Noto_Serif_KR({
  variable: "--font-display-serif",
  weight: ["500", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: displayName(), template: `%s · ${displayName()}` },
  description: brand.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const env = assertValidEnv(process.env);

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} ${displaySerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <EnvironmentBanner
          appEnv={env.NEXT_PUBLIC_APP_ENV}
          paymentMode={env.NEXT_PUBLIC_PAYMENT_MODE}
        />
        {children}
      </body>
    </html>
  );
}
