"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { SmartImage } from "@/components/SmartImage";
import { TierBadge } from "@/components/TierBadge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { resolveMedia } from "@/lib/mediaCache";
import type { Tier } from "@/lib/engine/tier";

export interface ShotCard {
  id: string;
  result_ref: string | null;
  type: string;
  status: string;
  tier: Tier | null;
  created_at: string;
}

type Filter = "all" | "image" | "video";
type Sort = "newest" | "oldest";

export function ShotsGallery({ shots }: { shots: ShotCard[] }) {
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const view = useMemo(() => {
    let v = shots.filter((s) => (filter === "all" ? true : filter === "video" ? s.type.startsWith("video/") : !s.type.startsWith("video/")));
    v = v.slice().sort((a, b) => (sort === "newest" ? +new Date(b.created_at) - +new Date(a.created_at) : +new Date(a.created_at) - +new Date(b.created_at)));
    return v;
  }, [shots, filter, sort]);

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function downloadSelected() {
    const targets = view.filter((s) => selected.has(s.id) && s.result_ref);
    if (!targets.length) return;
    toast(`Preparing ${targets.length} download${targets.length > 1 ? "s" : ""}...`, "info");
    for (const s of targets) {
      try {
        const url = await resolveMedia(s.result_ref!);
        const blob = await (await fetch(url)).blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `oviya-${s.id}.${s.type.startsWith("video/") ? "mp4" : "png"}`;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
      } catch { /* skip */ }
    }
  }

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p className="panel-eyebrow">Lookbook</p>
          <h1 className="display" style={{ fontSize: "var(--step-3)" }}>My Shots</h1>
        </div>
        <Link href="/app/new" className="btn btn-primary">New shoot</Link>
      </header>

      {/* Toolbar: filter, sort, select */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div className="seg">
          {(["all", "image", "video"] as Filter[]).map((f) => (
            <button key={f} data-on={filter === f} onClick={() => setFilter(f)}>{f === "all" ? "All" : f === "image" ? "Images" : "Video"}</button>
          ))}
        </div>
        <div className="seg">
          {(["newest", "oldest"] as Sort[]).map((s) => (
            <button key={s} data-on={sort === s} onClick={() => setSort(s)}>{s === "newest" ? "Newest" : "Oldest"}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {selecting && selected.size > 0 && <Button variant="secondary" size="sm" onClick={downloadSelected}>Download {selected.size}</Button>}
          <Button variant="ghost" size="sm" onClick={() => { setSelecting((s) => !s); setSelected(new Set()); }}>{selecting ? "Done" : "Select"}</Button>
        </div>
      </div>

      {view.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <p className="display" style={{ fontSize: 20 }}>Nothing here yet</p>
          <p className="muted" style={{ marginBottom: 16 }}>Upload a product and shoot your first look.</p>
          <Link href="/app/new" className="btn btn-primary">Enter the studio</Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 16 }}>
          {view.map((s) => {
            const inner = (
              <>
                <div style={{ aspectRatio: "3 / 4", background: "var(--surface-sunken)", position: "relative" }}>
                  {s.result_ref ? (
                    <SmartImage path={s.result_ref} alt="shot" isVideo={s.type.startsWith("video/")} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ display: "grid", placeItems: "center", height: "100%" }}><span className="muted" style={{ fontSize: 12 }}>{s.status === "failed" ? "Refunded" : "Processing"}</span></div>
                  )}
                  {selecting && (
                    <span style={{ position: "absolute", top: 8, left: 8, width: 22, height: 22, borderRadius: "50%", border: "2px solid #fff", background: selected.has(s.id) ? "var(--accent-default)" : "rgba(0,0,0,0.35)", display: "grid", placeItems: "center", color: "#fff", fontSize: 12 }}>{selected.has(s.id) ? "✓" : ""}</span>
                  )}
                  {s.type.startsWith("video/") && <span className="chip glass" style={{ position: "absolute", top: 8, right: 8, fontSize: 10, color: "#fff", borderColor: "transparent" }}>Video</span>}
                </div>
                <div style={{ padding: "9px 11px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>{new Date(s.created_at).toLocaleDateString()}</span>
                  {s.tier && s.tier !== "green" && s.status === "done" && <TierBadge tier={s.tier} />}
                </div>
              </>
            );
            return selecting ? (
              <button key={s.id} className="tilecard" onClick={() => toggle(s.id)} style={{ padding: 0, cursor: "pointer", textAlign: "left" }}>{inner}</button>
            ) : (
              <Link key={s.id} href={`/app/shots/${s.id}`} className="tilecard" style={{ display: "block" }}>{inner}</Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
