"use client";
import { useState } from "react";

// A selectable tile that ALWAYS shows a readable label, and a thumbnail when one exists.
// While the thumbnail loads it shows a skeleton shimmer and cross-fades in. When there is no
// thumbnail it shows a clean styled placeholder with the label (never a blank/half card). M3 + MN2.
export function ThumbTile({
  label,
  src,
  media,
  selected,
  onClick,
  width,
}: {
  label: string;
  src?: string | null;
  /** Custom media node (e.g. a SmartImage for private signed objects); overrides src. */
  media?: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  width?: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const showImage = !!src && !errored;

  return (
    <button
      type="button"
      className="thumbtile"
      data-selected={selected}
      onClick={onClick}
      title={label}
      style={{ width }}
    >
      <div className="thumb-media">
        {media ? (
          <div style={{ position: "absolute", inset: 0 }}>{media}</div>
        ) : showImage ? (
          <>
            {!loaded && <div className="skeleton" style={{ position: "absolute", inset: 0 }} />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src!}
              alt={label}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              onError={() => setErrored(true)}
              className={loaded ? "fade-in" : undefined}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: loaded ? 1 : 0 }}
            />
          </>
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              padding: 10,
              textAlign: "center",
              background: "var(--surface-2)",
              color: "var(--fog)",
              fontFamily: "var(--font-display)",
              fontSize: 14,
            }}
          >
            {label}
          </div>
        )}
      </div>
      <div className="thumb-label">{label}</div>
    </button>
  );
}
