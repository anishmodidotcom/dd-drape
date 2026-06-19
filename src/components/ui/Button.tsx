"use client";

import { motion, useReducedMotion } from "framer-motion";
import { spring } from "@/lib/motion";

type Variant = "primary" | "solid" | "ghost" | "ghost-dark";

/* The Oviya action button: existing .btn token styling + spring press motion (hover <=1.04,
 * tap 0.97). Reduced-motion users get the static button. */
export function Button({
  variant = "primary",
  block = false,
  className = "",
  children,
  ...props
}: {
  variant?: Variant;
  block?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const reduce = useReducedMotion();
  const cls = `btn btn-${variant}${block ? " btn-block" : ""}${className ? ` ${className}` : ""}`;
  if (reduce) {
    return (
      <button className={cls} {...props}>
        {children}
      </button>
    );
  }
  return (
    <motion.button
      className={cls}
      whileHover={props.disabled ? undefined : { scale: 1.04 }}
      whileTap={props.disabled ? undefined : { scale: 0.97 }}
      transition={spring}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}
