"use client";
import { useEffect, useState } from "react";
import { STAGES, VIDEO_STAGES, stageIndexForElapsed, lineForElapsed } from "@/lib/shot/loading";

// Staged "studio" loading experience with rotating witty lines, shown while a generation runs.
// Stages advance on a timer and hold on the last stage until the job completes.
export function LoadingStudio({ isVideo }: { isVideo?: boolean }) {
  const stages = isVideo ? VIDEO_STAGES : STAGES;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - start), 500);
    return () => clearInterval(t);
  }, []);

  const active = stageIndexForElapsed(elapsed, stages.length);
  const line = lineForElapsed(elapsed);

  return (
    <div
      className="card"
      style={{ background: "var(--ink)", color: "var(--porcelain)", borderColor: "var(--ink-soft)", display: "grid", gap: 18 }}
    >
      <div>
        <p className="eyebrow" style={{ color: "var(--saffron)" }}>On set</p>
        <h2 style={{ fontSize: 24, color: "var(--porcelain)" }}>
          {isVideo ? "Creating your video" : "Generating your shot"}
        </h2>
      </div>

      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
        {stages.map((s, i) => {
          const done = i < active;
          const now = i === active;
          return (
            <li key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, opacity: i <= active ? 1 : 0.4 }}>
              <span
                aria-hidden
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 11,
                  background: done ? "var(--success)" : now ? "var(--saffron)" : "transparent",
                  border: i <= active ? "none" : "1px solid var(--fog)",
                  color: "#fff",
                }}
              >
                {done ? "✓" : ""}
              </span>
              <span style={{ fontSize: 15, fontWeight: now ? 600 : 400 }}>
                {s.label}
                {now && (
                  <span className="dots" aria-hidden style={{ marginLeft: 2 }} />
                )}
              </span>
            </li>
          );
        })}
      </ol>

      <p aria-live="polite" className="muted" style={{ margin: 0, fontSize: 14, color: "var(--fog)", minHeight: 20 }}>
        {line}
      </p>
    </div>
  );
}
