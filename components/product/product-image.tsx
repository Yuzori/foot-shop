"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface ProductImageProps {
  src: string | null;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
}

/**
 * Image wrapper with a graceful fallback. When the back office provides no
 * image (or it fails to load) we render a neutral placeholder — never a fake
 * product photo.
 */
export function ProductImage({
  src,
  alt,
  sizes = "(max-width: 768px) 50vw, 25vw",
  className,
  priority,
}: ProductImageProps) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-paper-soft",
          className,
        )}
        aria-label={alt}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-ink/15"
          aria-hidden
        >
          <path d="M3 7l9-4 9 4-9 4-9-4z" />
          <path d="M3 7v10l9 4 9-4V7" />
        </svg>
      </div>
    );
  }

  // Our own proxy (`/api/images/...`) already serves an optimized, cached image
  // with the right auth. Skip Next's optimizer for it: it's faster and removes a
  // failure point (the double-fetch through /_next/image).
  const unoptimized = src.startsWith("/api/");

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={unoptimized}
      onError={() => setErrored(true)}
      className={cn("object-cover", className)}
    />
  );
}
