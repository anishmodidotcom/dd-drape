"use client";
import { useId } from "react";

// A semantic slider: labeled ends (e.g. "Soft" to "Hard"), an accent-filled track, a crafted knob.
// Dual-mode via tokens. Built on a native range input for accessibility, fully restyled.
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  leftLabel,
  rightLabel,
  label,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  leftLabel?: string;
  rightLabel?: string;
  label?: string;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {label && (
        <label htmlFor={id} className="label" style={{ marginBottom: 0 }}>
          {label}
        </label>
      )}
      <input
        id={id}
        className="oviya-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--pct" as string]: `${pct}%` }}
      />
      {(leftLabel || rightLabel) && (
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em", color: "var(--text-muted)", textTransform: "uppercase" }}>
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}
