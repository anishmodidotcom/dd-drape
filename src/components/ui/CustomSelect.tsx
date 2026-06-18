"use client";
import { useEffect, useRef, useState } from "react";

export interface Option {
  value: string;
  label: string;
}

// Branded custom select (no native OS control). Supports an optional "type your own" entry.
export function CustomSelect({
  value,
  options,
  onChange,
  placeholder = "Default",
  creatable = false,
  ariaLabel,
}: {
  value?: string;
  options: Option[];
  onChange: (v: string | undefined) => void;
  placeholder?: string;
  creatable?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? (value || placeholder);

  function pick(v: string | undefined) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div className="cs" ref={ref}>
      <button
        type="button"
        className="cs-trigger"
        data-placeholder={!value}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        {display}
      </button>
      {open && (
        <div className="cs-menu" role="listbox">
          <div className="cs-opt" data-selected={!value} onClick={() => pick(undefined)}>
            {placeholder}
          </div>
          {options.map((o) => (
            <div
              key={o.value}
              className="cs-opt"
              role="option"
              aria-selected={o.value === value}
              data-selected={o.value === value}
              onClick={() => pick(o.value)}
            >
              {o.label}
            </div>
          ))}
          {creatable && (
            <div style={{ padding: 6, borderTop: "1px solid var(--line-soft)", marginTop: 4 }}>
              <input
                className="input"
                style={{ fontSize: 14, padding: "9px 11px" }}
                placeholder="Type your own, then Enter"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && custom.trim()) {
                    e.preventDefault();
                    pick(custom.trim());
                    setCustom("");
                  }
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
