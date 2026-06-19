"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { fadeUp } from "@/lib/motion";

/* Entrance reveal. Fades + lifts children into view on mount (transform + opacity only).
 * Honors prefers-reduced-motion: when reduced, content appears instantly with no transform. */
export function Reveal({
  children,
  delay = 0,
  variants = fadeUp,
  className,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  variants?: Variants;
  className?: string;
  style?: React.CSSProperties;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      style={style}
      variants={variants}
      initial="hidden"
      animate="show"
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}
