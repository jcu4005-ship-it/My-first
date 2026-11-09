import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * 사진 자리. src가 있으면 사진을 꽉 채워 보여 주고, 없으면 fallback(타이포그래피 표지)을 보여 줍니다.
 * - 원격 사진(프로그램 대표 사진 https 주소)은 최적화 서버를 거치지 않고 그대로 표시합니다.
 * - 부모 요소가 크기(aspect-*, h-*)를 정해야 합니다.
 */
export function Photo({
  src,
  alt,
  fallback,
  priority = false,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  className,
}: {
  src?: string | null;
  alt: string;
  fallback: React.ReactNode;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  if (!src) return <>{fallback}</>;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      unoptimized={/^https?:\/\//.test(src)}
      className={cn("object-cover", className)}
    />
  );
}
