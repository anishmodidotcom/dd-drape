"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { motion, useReducedMotion } from "framer-motion";
import { spring } from "@/lib/motion";

// The one-click light/dark switch. A single track with a sliding knob; the icon crossfades. Mounted
// guard avoids a hydration flash. Tasteful, not gimmicky.
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  const toggle = () => setTheme(isDark ? "light" : "dark");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle theme"}
      className={className}
      style={{
        position: "relative",
        width: 60,
        height: 32,
        borderRadius: 999,
        border: "1px solid var(--border-subtle)",
        background: "var(--surface-sunken)",
        cursor: "pointer",
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      <motion.span
        aria-hidden
        animate={{ x: mounted && isDark ? 30 : 2 }}
        transition={reduce ? { duration: 0 } : spring}
        style={{
          position: "absolute",
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "var(--accent-default)",
          boxShadow: "var(--shadow-1)",
          display: "grid",
          placeItems: "center",
          color: "var(--accent-contrast)",
          fontSize: 13,
        }}
      >
        {mounted ? (isDark ? "☾" : "☀") : ""}
      </motion.span>
    </button>
  );
}
