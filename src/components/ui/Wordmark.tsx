"use client";

/* Oviya wordmark + monogram. Editorial serif "Oviya" with an "Atelier" mono lockup. The monogram is
 * a fine-stippled ring around a serif O bisected by a single vertical hairline, a quiet nod to the
 * verticality of Indic scripts, set in the antique-gold support hue. Dual-mode via semantic tokens. */

export function Monogram({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true" style={{ display: "block" }}>
      <circle cx="20" cy="20" r="18.5" stroke="var(--accent-default)" strokeWidth="1.4" opacity="0.95" />
      <circle cx="20" cy="20" r="13.5" stroke="var(--gold)" strokeWidth="0.6" strokeDasharray="0.4 2.2" opacity="0.8" />
      <line x1="20" y1="3" x2="20" y2="37" stroke="var(--gold)" strokeWidth="0.6" opacity="0.45" />
      <text x="20" y="27.5" textAnchor="middle" fontFamily="var(--font-display)" fontSize="21" fontStyle="italic" fill="var(--text-primary)">
        O
      </text>
    </svg>
  );
}

export function Wordmark({
  size = "md",
  withStudio = true,
  withMark = true,
}: {
  size?: "sm" | "md" | "lg";
  withStudio?: boolean;
  withMark?: boolean;
}) {
  const fs = size === "lg" ? 32 : size === "sm" ? 18 : 23;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 11, lineHeight: 1 }}>
      {withMark && <Monogram size={fs * 1.28} />}
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: fs, letterSpacing: "0.005em", color: "var(--text-primary)" }}>Oviya</span>
        {withStudio && (
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: fs * 0.36, letterSpacing: "0.32em", textTransform: "uppercase", color: "var(--accent-default)" }}>Studio</span>
        )}
      </span>
    </span>
  );
}
