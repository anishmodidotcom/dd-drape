"use client";

import { useState } from "react";
import { ThumbTile } from "./ThumbTile";

export interface PickOption {
  value: string;
  label: string;
  thumb?: string | null;
  media?: React.ReactNode;
}

/* Every Studio control is a visual gallery, never a native dropdown. Renders selectable thumbnail
 * tiles plus a "Describe your own" escape hatch that lets the user type a value the engine still
 * honors. A custom value (one not in options) renders as its own selected tile. */
export function GalleryPicker({
  options,
  value,
  onChange,
  allowCustom = true,
  customPlaceholder = "Describe it, then Enter",
  tileWidth = 92,
}: {
  options: PickOption[];
  value?: string;
  onChange: (v: string | undefined) => void;
  allowCustom?: boolean;
  customPlaceholder?: string;
  tileWidth?: number;
}) {
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const isCustom = value != null && value !== "" && !options.some((o) => o.value === value);

  function commit() {
    const v = text.trim();
    if (v) onChange(v);
    setText("");
    setTyping(false);
  }

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {options.map((o) => (
        <ThumbTile
          key={o.value}
          label={o.label}
          src={o.thumb ?? null}
          media={o.media}
          selected={value === o.value}
          onClick={() => onChange(value === o.value ? undefined : o.value)}
          width={tileWidth}
        />
      ))}

      {isCustom && (
        <ThumbTile label={value!} src={null} selected onClick={() => onChange(undefined)} width={tileWidth} />
      )}

      {allowCustom &&
        (typing ? (
          <div style={{ width: tileWidth * 1.6 }}>
            <input
              autoFocus
              className="input"
              style={{ fontSize: 13, padding: "9px 10px" }}
              placeholder={customPlaceholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
                if (e.key === "Escape") {
                  setText("");
                  setTyping(false);
                }
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setTyping(true)}
            title="Describe your own"
            style={{
              width: tileWidth,
              minHeight: tileWidth * 1.33 + 33,
              borderRadius: "var(--radius)",
              border: "1px dashed var(--line)",
              background: "transparent",
              color: "var(--fog)",
              cursor: "pointer",
              fontFamily: "var(--font-ui)",
              fontSize: 13,
              display: "grid",
              placeItems: "center",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
            Describe
          </button>
        ))}
    </div>
  );
}
