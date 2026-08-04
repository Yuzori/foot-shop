"use client";

import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
} from "framer-motion";
import { type ReactNode } from "react";

interface RevealProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  delay?: number;
  y?: number;
  once?: boolean;
}

const ease = [0.16, 1, 0.3, 1] as const;

/** Fade + rise into view on scroll. Subtle, premium, never excessive. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  once = true,
  ...props
}: RevealProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once, margin: "-60px" }}
      transition={{ duration: 0.7, ease, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
