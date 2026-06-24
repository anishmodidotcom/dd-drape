"use client";

// The "alive gradient" background surface. This phase ships the token-driven, GPU-cheap CSS
// scaffold (slow-drifting luminous oxblood/indigo washes over the base surface); the real WebGL
// gradient lands in the later motion phase by swapping the inner layer. Honors reduced-motion via
// the CSS (the drift animation is disabled under prefers-reduced-motion globally).
export function AliveBackground({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div aria-hidden className={className} style={{ position: "absolute", inset: 0, overflow: "hidden", background: "var(--surface-base)", ...style }}>
      <div className="alive-wash alive-a" />
      <div className="alive-wash alive-b" />
    </div>
  );
}
