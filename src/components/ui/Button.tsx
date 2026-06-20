"use client";

import { motion, useReducedMotion } from "framer-motion";
import { spring } from "@/lib/motion";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

/* The Oviya action button. Flat or hairline-bordered, never glassy-gradient. One accent-fill
 * variant rationed to the single primary action; the rest are quiet. Tactile press, a soft accent
 * glow bloom on hover for the primary, inline loading. Dual-mode via semantic tokens. */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel = "Styling",
  block = false,
  className = "",
  children,
  style,
  ...props
}: {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  loadingLabel?: string;
  block?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const reduce = useReducedMotion();
  const pad = size === "lg" ? "15px 28px" : size === "sm" ? "8px 14px" : "12px 20px";
  const fontSize = size === "lg" ? 16 : size === "sm" ? 13 : 15;

  const base: React.CSSProperties = {
    fontFamily: "var(--font-ui)",
    fontWeight: 500,
    fontSize,
    padding: pad,
    borderRadius: "var(--radius-sm)",
    cursor: loading || props.disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    lineHeight: 1,
    width: block ? "100%" : undefined,
    border: "1px solid transparent",
    transition: "background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur) var(--ease-out)",
    opacity: props.disabled ? 0.5 : 1,
    ...style,
  };
  const variants: Record<Variant, React.CSSProperties> = {
    primary: { background: "var(--accent-default)", color: "var(--accent-contrast)" },
    secondary: { background: "transparent", color: "var(--text-primary)", borderColor: "var(--border-strong)" },
    ghost: { background: "transparent", color: "var(--text-secondary)" },
  };

  const interactive = !loading && !props.disabled;
  const hover = reduce || !interactive
    ? undefined
    : variant === "primary"
      ? { scale: 1.02, boxShadow: "0 0 0 1px var(--accent-default), 0 8px 30px var(--glow-accent)" }
      : variant === "secondary"
        ? { scale: 1.02, borderColor: "var(--accent-default)" }
        : { scale: 1.02, backgroundColor: "color-mix(in oklab, var(--text-primary) 6%, transparent)" };

  return (
    <motion.button
      {...(props as React.ComponentProps<typeof motion.button>)}
      disabled={loading || props.disabled}
      aria-busy={loading}
      style={{ ...base, ...variants[variant] }}
      className={className}
      whileHover={hover}
      whileTap={interactive && !reduce ? { scale: 0.98 } : undefined}
      transition={spring}
    >
      {loading && <Spinner />}
      {loading ? `${loadingLabel}...` : children}
    </motion.button>
  );
}

function Spinner() {
  return (
    <motion.span
      aria-hidden
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
      style={{
        width: 13,
        height: 13,
        borderRadius: "50%",
        border: "2px solid color-mix(in oklab, currentColor 35%, transparent)",
        borderTopColor: "currentColor",
        display: "inline-block",
      }}
    />
  );
}
