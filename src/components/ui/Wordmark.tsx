"use client";

/* Oviya Studio wordmark + monogram. The brand signature: a serif display wordmark with a single
 * gold accent mark. "Oviya" (Tamil ஓவியா) means "one who is artistic / a work of art". */

export function Monogram({ size = 28 }: { size?: number }) {
  // A gold ring with a serif O, the "lens"/"work of art" mark.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle cx="20" cy="20" r="18.5" stroke="var(--accent)" strokeWidth="1.5" opacity="0.9" />
      <circle cx="20" cy="20" r="13" stroke="var(--accent)" strokeWidth="0.75" opacity="0.4" />
      <text
        x="20"
        y="27"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontSize="20"
        fontStyle="italic"
        fill="var(--accent)"
      >
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
  const fs = size === "lg" ? 30 : size === "sm" ? 17 : 22;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, lineHeight: 1 }}>
      {withMark && <Monogram size={fs * 1.25} />}
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 7 }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: fs,
            letterSpacing: "0.01em",
            color: "var(--porcelain)",
          }}
        >
          Oviya
        </span>
        {withStudio && (
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontWeight: 500,
              fontSize: fs * 0.42,
              letterSpacing: "0.34em",
              textTransform: "uppercase",
              color: "var(--accent)",
            }}
          >
            Studio
          </span>
        )}
      </span>
    </span>
  );
}
