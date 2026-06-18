"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BeforeAfter } from "./BeforeAfter";
import { LoadingStudio } from "./LoadingStudio";
import { SmartImage } from "./SmartImage";
import { TierBadge } from "./TierBadge";
import { CustomSelect } from "./ui/CustomSelect";
import { useToast } from "./ui/Toast";
import { TIER_PRESENTATION, QC_CHECKLIST } from "@/lib/shot/qc";
import { motionsForCategory, MOTION_PRESETS } from "@/lib/shot/motion";
import type { Category } from "@/lib/shot/spec";
import type { Tier } from "@/lib/engine/tier";

interface JobView {
  id: string;
  type: string;
  status: "queued" | "running" | "done" | "failed";
  tier: Tier | null;
  qcStatus: "none" | "pending" | "approved";
  fidelity: "verified" | "unverified" | "failed" | null;
  resultPath: string | null;
  beforePath: string | null;
  blocked: string | null;
  failed: boolean;
  failureReason: string | null;
  refunded: boolean;
  aiLabel: boolean;
  format: string | null;
  category: string | null;
  parentJobId: string | null;
}

const MEDIA_MAX = 560;

export function ResultView({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [job, setJob] = useState<JobView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [showLabel, setShowLabel] = useState(true);
  const [motion, setMotion] = useState<string | undefined>(undefined);

  const isVideo = job?.type?.startsWith("video/");
  const tick = useRef(0);

  const load = useCallback(async () => {
    const res = await fetch(`/api/jobs/${id}`);
    if (!res.ok) {
      setError("This shot could not be found.");
      return null;
    }
    const j = (await res.json()) as JobView;
    setJob(j);
    setShowLabel(j.aiLabel);
    return j;
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // B2: while a job is in flight, poll. For async (video) jobs, the poll also drives the
  // reconciler so a failed/stale job resolves ON ITS OWN (no hidden button needed).
  useEffect(() => {
    if (!job || (job.status !== "queued" && job.status !== "running")) return;
    const async = job.type.startsWith("video/");
    const t = setInterval(async () => {
      tick.current += 1;
      if (async && tick.current % 2 === 0) {
        // reconcile every other tick (~10s): finalizes completed/failed jobs server-side.
        await fetch(`/api/jobs/${id}/retry`, { method: "POST" }).catch(() => {});
      }
      await load();
    }, 5000);
    return () => clearInterval(t);
  }, [job, load, id]);

  async function regenerate() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/jobs/${id}/regenerate`, { method: "POST" });
    const j = await res.json();
    setBusy(false);
    if (res.status === 402) return toast("Not enough credits to regenerate.", "error");
    if (!res.ok) return toast("Regeneration failed.", "error");
    router.push(`/app/shots/${j.jobId}`);
  }

  async function recover() {
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs/${id}/retry`, { method: "POST" });
      const j = await res.json();
      if (res.ok && j.status === "pending") toast(j.message ?? "Still rendering.", "info");
      await load();
    } catch {
      toast("Could not check status.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true);
    await fetch(`/api/jobs/${id}/qc`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "approve" }) });
    await load();
    setBusy(false);
    toast("Approved. Ready to download.", "success");
  }

  async function makeVideo() {
    setBusy(true);
    const res = await fetch(`/api/jobs/${id}/video`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ motionPreset: motion }) });
    const j = await res.json();
    setBusy(false);
    if (res.status === 402) return toast("Not enough credits for video.", "error");
    if (res.status === 503) return toast(j.message ?? "Video is in beta and temporarily unavailable.", "info");
    if (!res.ok) return toast("Could not start video.", "error");
    router.push(`/app/shots/${j.jobId}`);
  }

  // MN8: trigger a real file download (not open-in-tab) via blob. Resolves a FRESH signed URL at
  // click time (via /api/media) so a long-open page still downloads (audit item 5).
  async function download() {
    if (!job?.resultPath) return;
    setDownloading(true);
    try {
      const media = await fetch(`/api/media?path=${encodeURIComponent(job.resultPath)}`);
      if (!media.ok) throw new Error("expired");
      const { url: signed } = await media.json();
      const res = await fetch(signed);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `drape-${job.id}.${isVideo ? "mp4" : "png"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast("Download failed. Try again.", "error");
    } finally {
      setDownloading(false);
    }
  }

  if (error) return <div className="card" style={{ borderColor: "var(--danger)" }}>{error}</div>;
  if (!job) {
    return <div className="skeleton" style={{ height: 360, borderRadius: 14 }} aria-busy="true" />;
  }

  // Processing (B2): studio loader only renders while genuinely in flight. Auto-reconcile drives
  // it to a real outcome; the manual check is a secondary affordance.
  if (job.status === "queued" || job.status === "running") {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <LoadingStudio isVideo={isVideo} />
        <button className="btn btn-ghost" disabled={busy} onClick={recover} style={{ width: "fit-content" }}>
          {busy ? "Checking..." : "Check status now"}
        </button>
      </div>
    );
  }

  // RED block: honest message, single refund line.
  if (job.blocked) {
    return (
      <div className="fade-up" style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <TierBadge tier="red" />
          <h2 style={{ fontSize: 24 }}>We did not generate this one</h2>
        </div>
        <div className="card" style={{ borderColor: "var(--danger)" }}>
          <p style={{ margin: 0 }}>{job.blocked}</p>
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>No credits were charged.</p>
        </div>
        <button className="btn btn-solid" style={{ width: "fit-content" }} onClick={() => router.push("/app/new")}>Try a different shot</button>
      </div>
    );
  }

  // Failure: single clear reason + single refund confirmation (MN9 / B2).
  if (job.status === "failed") {
    return (
      <div className="fade-up" style={{ display: "grid", gap: 16 }}>
        <h2 style={{ fontSize: 24 }}>{isVideo ? "Video failed" : "Generation failed"}</h2>
        <div className="card" style={{ borderColor: "var(--caution)" }}>
          <p style={{ margin: 0 }}>{job.failureReason ?? "Something went wrong."}</p>
          {job.refunded && (
            <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Your credits were refunded.</p>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-primary" disabled={busy} onClick={regenerate}>Try again</button>
          <button className="btn btn-ghost" onClick={() => router.push("/app/new")}>New shot</button>
        </div>
      </div>
    );
  }

  // Done
  const tier = job.tier ?? "green";
  const present = TIER_PRESENTATION[tier];
  const motions = job.category ? motionsForCategory(job.category as Category) : MOTION_PRESETS;

  return (
    <div className="fade-up" style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <TierBadge tier={tier} />
        <h2 style={{ fontSize: 26 }}>{present.headline}</h2>
      </div>
      <p className="muted" style={{ marginTop: -8 }}>{present.body}</p>

      {/* B1: large media, real dimensions. Item 5: rendered from paths via SmartImage / smart
          BeforeAfter so signed URLs auto-refresh and never break on expiry. */}
      <div style={{ position: "relative", width: "100%", maxWidth: MEDIA_MAX }}>
        {isVideo ? (
          job.resultPath && (
            <SmartImage path={job.resultPath} alt="generated video" isVideo style={{ width: "100%", display: "block", borderRadius: 14, border: "1px solid var(--line)" }} />
          )
        ) : job.beforePath && job.resultPath ? (
          <BeforeAfter beforePath={job.beforePath} afterPath={job.resultPath} alt="your product" />
        ) : (
          job.resultPath && (
            <SmartImage path={job.resultPath} alt="generated shot" style={{ width: "100%", display: "block", borderRadius: 14, border: "1px solid var(--line)" }} />
          )
        )}
        {showLabel && job.resultPath && (
          <span className="chip" style={{ position: "absolute", bottom: 12, left: 12, background: "rgba(0,0,0,0.62)", color: "#fff", borderColor: "transparent" }}>
            Created with AI
          </span>
        )}
      </div>

      {/* Item 4: be honest about fidelity verification status. */}
      {job.fidelity === "unverified" && (
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Fidelity check did not run on this shot, so it is unverified. Please review the product
          details against your original before publishing.
        </p>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        <input type="checkbox" checked={showLabel} onChange={(e) => setShowLabel(e.target.checked)} />
        Show the &quot;Created with AI&quot; label on this image
      </label>

      {/* AMBER QC (only amber surfaces the checklist; green is simply Ready). */}
      {tier === "amber" && job.qcStatus !== "approved" && (
        <div className="card" style={{ borderColor: "var(--caution)" }}>
          <strong>Quick review</strong>
          <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>Check these before you publish.</p>
          <div style={{ display: "grid", gap: 8, margin: "12px 0" }}>
            {QC_CHECKLIST.map((c) => (
              <label key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                <input type="checkbox" checked={!!checks[c.id]} onChange={(e) => setChecks((s) => ({ ...s, [c.id]: e.target.checked }))} />
                {c.label}
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" disabled={busy || QC_CHECKLIST.some((c) => !checks[c.id])} onClick={approve}>Approve</button>
            <button className="btn btn-ghost" disabled={busy} onClick={regenerate}>Regenerate</button>
          </div>
        </div>
      )}
      {tier === "amber" && job.qcStatus === "approved" && <span className="chip chip-green" style={{ width: "fit-content" }}>Approved</span>}

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-solid" disabled={downloading || !job.resultPath} onClick={download}>
          {downloading ? "Preparing..." : "Download"}
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={regenerate}>Regenerate</button>
        <button className="btn btn-ghost" onClick={() => router.push("/app/shots")}>My shots</button>
      </div>

      {/* Generate video from this still */}
      {!isVideo && (
        <div className="card" style={{ display: "grid", gap: 12 }}>
          <strong style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Bring it to life <span className="chip" style={{ fontSize: 11 }}>Beta</span>
          </strong>
          <p className="muted" style={{ fontSize: 14, margin: 0 }}>Animate this shot into a short clip. The product stays locked as the first frame.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ minWidth: 240 }}>
              <CustomSelect value={motion} options={motions.map((m) => ({ value: m.id, label: m.label }))} onChange={(v) => setMotion(v)} placeholder="Choose a motion" />
            </div>
            <button className="btn btn-primary" disabled={busy} onClick={makeVideo}>Generate video</button>
          </div>
        </div>
      )}
    </div>
  );
}
