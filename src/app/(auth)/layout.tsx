import Link from "next/link";

import { displayName } from "@/config/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10 sm:py-16">
      <Link href="/" className="mb-10 font-display text-xl font-bold tracking-tight">
        {displayName()}
      </Link>
      {children}
    </main>
  );
}
