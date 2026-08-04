"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionStyle,
} from "framer-motion";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

interface ScrollFloatImageProps {
  src: string;
  alt?: string;
  className?: string;
  imageClassName?: string;
  parallax?: number;
  "aria-hidden"?: boolean;
}

/**
 * Image décorative avec entrée au scroll + léger parallax.
 * Masquée automatiquement si le fichier est introuvable.
 */
export function ScrollFloatImage({
  src,
  alt = "",
  className,
  imageClassName,
  parallax = 36,
  "aria-hidden": ariaHidden,
}: ScrollFloatImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [hidden, setHidden] = useState(false);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(
    scrollYProgress,
    [0, 1],
    reduced ? [0, 0] : [parallax, -parallax],
  );
  const rotate = useTransform(
    scrollYProgress,
    [0, 1],
    reduced ? [0, 0] : [-3, 3],
  );

  if (!src || hidden) return null;

  const motionStyle: MotionStyle = reduced
    ? {}
    : {
        y,
        rotate,
      };

  return (
    <motion.div
      ref={ref}
      className={cn("pointer-events-none select-none", className)}
      initial={reduced ? false : { opacity: 0, scale: 0.92 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-12%" }}
      transition={{ duration: 0.9, ease }}
    >
      <motion.img
        src={src}
        alt={alt}
        draggable={false}
        aria-hidden={ariaHidden}
        onError={() => setHidden(true)}
        style={motionStyle}
        className={cn(
          "h-auto w-full max-w-none object-contain drop-shadow-[0_24px_48px_rgba(0,0,0,0.45)]",
          imageClassName,
        )}
      />
    </motion.div>
  );
}
