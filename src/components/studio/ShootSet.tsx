"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SmartImage } from "@/components/SmartImage";
import { AtelierLoader } from "@/components/ui/AtelierLoader";
import { Button } from "@/components/ui/Button";

interface FrameState {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  resultPath: string | null;
}

// A directed multi-output shoot rendered as one coherent set in the canvas. Polls each frame until
// settled; pending frames show a shimmer, delivered frames are actionable (open / download).
export function ShootSet({ frameIds, onReset }: { frameIds: string[]; onReset: () => void }) {
  const [frames, setFrames] = useState<FrameState[]>(frameIds.map((id) => ({ id, status: "queued", resultPath: null })));

  const poll = useCallback(async () => {
    const next = await Promise.all(
      frameIds.map(async (id) => {
        try {
          const r = await fetch(`/api/jobs/${id}`);
          if (!r.ok) return { id, status: "running" as const, resultPath: null };
          const j = await r.json();
          return { id, status: j.status as FrameState["status"], resultPath: j.resultPath ?? null };
        } catch {
          return { id, status: "running" as const, resultPath: null };
        }
      })
    );
    setFrames(next);
    return next;
  }, [frameIds]);

  useEffect(() => {
    let active = true;
    poll();
    const t = setInterval(async () => {
      const n = await poll();
      if (active && n.every((f) => f.status === "done" || f.status === "failed")) clearInterval(t);
    }, 5000);
    return () => { active = false; clearInterval(t); };
  }, [poll]);

  const done = frames.filter((f) => f.status === "done").length;
  const pending = frames.some((f) => f.status === "queued" || f.status === "running");

  return (
    <div style={{ display: "grid", gap: 16, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p className="panel-eyebrow">The shoot</p>
          <h2 className="display" style={{ fontSize: "var(--step-2)" }}>{frames.length} frames, one look</h2>
        </div>
        <span className="muted" style={{ fontSize: 13 }}>{done} of {frames.length} ready</span>
      </div>

      {pending && done === 0 ? (
        <AtelierLoader title="Directing your shoot" />
      ) : (
        <div className="shotgrid">
          {frames.map((f, i) => (
            <div key={f.id} className="tilecard">
              <div style={{ aspectRatio: "3 / 4", position: "relative", background: "var(--surface-sunken)" }}>
                {f.status === "done" && f.resultPath ? (
                  <Link href={`/app/shots/${f.id}`}>
                    <SmartImage path={f.resultPath} alt={`Frame ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </Link>
                ) : f.status === "failed" ? (
                  <div style={{ display: "grid", placeItems: "center", height: "100%", padding: 12, textAlign: "center" }}>
                    <span className="muted" style={{ fontSize: 12 }}>This frame did not land. It was refunded.</span>
                  </div>
                ) : (
                  <div className="skeleton" style={{ position: "absolute", inset: 0 }} />
                )}
              </div>
              <div style={{ padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>Frame {i + 1}</span>
                {f.status === "done" && <Link href={`/app/shots/${f.id}`} className="mono" style={{ fontSize: 11, color: "var(--accent-default)" }}>Open</Link>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <Button variant="secondary" onClick={onReset}>New shoot</Button>
        <Link href="/app/shots" className="btn btn-ghost">My Shots</Link>
      </div>
    </div>
  );
}
