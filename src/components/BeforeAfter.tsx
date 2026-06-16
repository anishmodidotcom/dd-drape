"use client";
import { useRef, useState } from "react";

// The before -> after reveal (brand motif). Draggable split slider over the original upload and
// the generated shot.
export function BeforeAfter({ before, after, alt }: { before: string; after: string; alt: string }) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);

  function onMove(clientX: number) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, pct)));
  }

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "3 / 4",
        maxWidth: 520,
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid var(--line)",
        userSelect: "none",
        background: "var(--ink)",
      }}
      onMouseMove={(e) => e.buttons === 1 && onMove(e.clientX)}
      onClick={(e) => onMove(e.clientX)}
      onTouchMove={(e) => onMove(e.touches[0].clientX)}
    >
      {/* after (full) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt={`${alt}, generated`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      {/* before (clipped) */}
      <div style={{ position: "absolute", inset: 0, width: `${pos}%`, overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt={`${alt}, original`} style={{ width: `${(100 / pos) * 100}%`, height: "100%", objectFit: "cover", maxWidth: "none" }} />
        <span className="chip" style={{ position: "absolute", top: 10, left: 10, fontSize: 11 }}>Original</span>
      </div>
      <span className="chip" style={{ position: "absolute", top: 10, right: 10, fontSize: 11 }}>Generated</span>
      {/* handle */}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pos}%`, width: 2, background: "#fff", transform: "translateX(-1px)" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 32, height: 32, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
          <span style={{ color: "var(--ink)", fontSize: 13 }}>&#8596;</span>
        </div>
      </div>
    </div>
  );
}
