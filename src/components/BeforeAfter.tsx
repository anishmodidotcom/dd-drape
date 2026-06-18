"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// The before -> after reveal (brand motif). Draggable split slider over the original upload and
// the generated shot.
//
// Accepts EITHER direct URLs (before/after - used on the public landing) OR storage paths
// (beforePath/afterPath - used in the studio). When given paths it resolves short-lived signed
// URLs via /api/media and auto-refreshes them on load error, so a long-open result page never
// shows a broken preview (audit item 5).

function useSignedSrc(path?: string | null, directUrl?: string): [string | null, () => void] {
  const [url, setUrl] = useState<string | null>(directUrl ?? null);
  const refresh = useCallback(async () => {
    if (!path) {
      setUrl(directUrl ?? null);
      return;
    }
    try {
      const res = await fetch(`/api/media?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json();
      setUrl(j.url as string);
    } catch {
      setUrl(null);
    }
  }, [path, directUrl]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return [url, refresh];
}

export function BeforeAfter({
  before,
  after,
  beforePath,
  afterPath,
  alt,
}: {
  before?: string;
  after?: string;
  beforePath?: string | null;
  afterPath?: string | null;
  alt: string;
}) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const [beforeSrc, refreshBefore] = useSignedSrc(beforePath, before);
  const [afterSrc, refreshAfter] = useSignedSrc(afterPath, after);

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
      {afterSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={afterSrc} alt={`${alt}, generated`} onError={() => refreshAfter()} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      )}
      {/* before (clipped) */}
      <div style={{ position: "absolute", inset: 0, width: `${pos}%`, overflow: "hidden" }}>
        {beforeSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={beforeSrc} alt={`${alt}, original`} onError={() => refreshBefore()} style={{ width: `${(100 / pos) * 100}%`, height: "100%", objectFit: "cover", maxWidth: "none" }} />
        )}
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
