"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

// The atelier-process loader: staged craft steps narrated in mono, the way a studio actually works
// a shoot. Stages advance on a timer and hold on the last until the real job completes. Dual-mode,
// witty, premium. Replaces the old generic loader (wired into the studio in a later phase).
const STEPS = [
  "Reading the garment",
  "Preserving fabric and drape",
  "Casting the model",
  "Setting the light",
  "Composing the frame",
  "Final retouch",
];
const ASIDES = [
  "Hand us the garment. We'll handle the drama.",
  "Good light is patient. So are we.",
  "Every thread accounted for.",
  "The muse is almost ready.",
];

export function AtelierLoader({ title = "Styling the shoot", holdMs = 2600 }: { title?: string; holdMs?: number }) {
  const [active, setActive] = useState(0);
  const [aside, setAside] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActive((i) => Math.min(i + 1, STEPS.length - 1)), holdMs);
    const a = setInterval(() => setAside((i) => (i + 1) % ASIDES.length), holdMs * 1.6);
    return () => {
      clearInterval(t);
      clearInterval(a);
    };
  }, [holdMs]);

  return (
    <div style={{ display: "grid", gap: 20, padding: 28, borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--surface-raised)", boxShadow: "var(--shadow-2)" }}>
      <div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--accent-default)", margin: 0 }}>The atelier</p>
        <h3 className="display" style={{ fontSize: "var(--step-2)", margin: "4px 0 0", color: "var(--text-primary)" }}>{title}</h3>
      </div>

      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 11 }}>
        {STEPS.map((s, i) => {
          const done = i < active;
          const now = i === active;
          return (
            <li key={s} style={{ display: "flex", alignItems: "center", gap: 12, opacity: i <= active ? 1 : 0.38, transition: "opacity var(--dur) var(--ease-out)" }}>
              <span aria-hidden style={{ width: 16, height: 16, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 10, flexShrink: 0, background: done ? "var(--accent-default)" : "transparent", border: now ? "1px solid var(--accent-default)" : i < active ? "none" : "1px solid var(--border-strong)", color: "var(--accent-contrast)" }}>
                {done ? "✓" : ""}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.01em", color: now ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: now ? 500 : 400 }}>
                {s}
                {now && <span className="dots" aria-hidden style={{ marginLeft: 1 }} />}
              </span>
            </li>
          );
        })}
      </ol>

      <motion.p key={aside} initial={{ opacity: 0 }} animate={{ opacity: 1 }} aria-live="polite" className="serif-italic" style={{ margin: 0, fontSize: 15, color: "var(--text-muted)", minHeight: 22 }}>
        {ASIDES[aside]}
      </motion.p>
    </div>
  );
}
