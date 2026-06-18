"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BeforeAfter } from "./BeforeAfter";
import { LoadingStudio } from "./LoadingStudio";
import { TierBadge } from "./TierBadge";
import { TIER_PRESENTATION, QC_CHECKLIST } from "@/lib/shot/qc";
import { MOTION_PRESETS } from "@/lib/shot/motion";
import type { Tier } from "@/lib/engine/tier";

interface JobView {
  id: string;
  type: string;
  status: "queued" | "running" | "done" | "failed";
  tier: Tier | null;
  qcStatus: "none" | "pending" | "approved";
  resultUrl: string | null;
  beforeUrl: string | null;
  blocked: string | null;
  failed: string | null;
  aiLabel: boolean;
  format: string | null;
  parentJobId: string | null;
}

export function ResultView({ id }: { id: string }) {
  const router = useRouter();
  const [job, setJob] = useState<JobView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [showLabel, setShowLabel] = useState(true);
  const [motion, setMotion] = useState(MOTION_PRESETS[0].id);

  const isVideo = job?.type?.startsWith("video/");

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

  // Poll while processing.
  useEffect(() => {
    if (!job || (job.status !== "queued" && job.status !== "running")) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [job, load]);

  async function regenerate() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/jobs/${id}/regenerate`, { method: "POST" });
    const j = await res.json();
    setBusy(false);
    if (res.status === 402) return setError("Not enough credits to regenerate.");
    if (!res.ok) return setError("Regeneration failed.");
    router.push(`/app/shots/${j.jobId}`);
  }

  async function recover() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${id}/retry`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) {
        setError("Could not check status. Try again in a moment.");
      } else if (j.status === "pending") {
        setError(j.message ?? "Still rendering.");
      }
      await load();
    } catch {
      setError("Could not check status.");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true);
    await fetch(`/api/jobs/${id}/qc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    await load();
    setBusy(false);
  }

  async function makeVideo() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/jobs/${id}/video`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ motionPreset: motion }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.status === 402) return setError("Not enough credits for video.");
    if (!res.ok) return setError("Could not start video.");
    router.push(`/app/shots/${j.jobId}`);
  }

  if (error) return <p style={{ color: "var(--danger)" }}>{error}</p>;
  if (!job) return <p className="muted">Loading...</p>;

  // Processing: staged studio loading experience (Phase E) + user-facing recovery (always
  // recoverable, even if the worker/webhook never lands).
  if (job.status === "queued" || job.status === "running") {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <LoadingStudio isVideo={isVideo} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" disabled={busy} onClick={recover}>
            {busy ? "Checking..." : "Taking too long? Check status"}
          </button>
          {error && <span className="muted" style={{ fontSize: 13 }}>{error}</span>}
        </div>
      </div>
    );
  }

  // RED block (no silent dead-ends): honest message, credits refunded.
  if (job.blocked) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <TierBadge tier="red" />
          <h2 style={{ fontSize: 24 }}>We did not generate this one</h2>
        </div>
        <div className="card" style={{ borderColor: "var(--danger)" }}>
          <p style={{ margin: 0 }}>{job.blocked}</p>
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            No credits were charged. We reserved and immediately refunded them.
          </p>
        </div>
        <div>
          <button className="btn btn-solid" onClick={() => router.push("/app/new")}>
            Try a different shot
          </button>
        </div>
      </div>
    );
  }

  // Failure (refunded)
  if (job.status === "failed") {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <h2 style={{ fontSize: 24 }}>Generation failed</h2>
        <div className="card" style={{ borderColor: "var(--caution)" }}>
          <p style={{ margin: 0 }}>{job.failed ?? "Something went wrong."}</p>
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Your credits were refunded.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" disabled={busy} onClick={regenerate}>Try again</button>
          <button className="btn btn-ghost" onClick={() => router.push("/app/new")}>New shot</button>
        </div>
      </div>
    );
  }

  // Done
  const tier = job.tier ?? "green";
  const present = TIER_PRESENTATION[tier];
  const downloadName = `drape-${job.id}.${isVideo ? "mp4" : "png"}`;

  return (
    <div className="fade-up" style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <TierBadge tier={tier} />
        <h2 style={{ fontSize: 26 }}>{present.headline}</h2>
      </div>
      <p className="muted" style={{ marginTop: -8 }}>{present.body}</p>

      <div style={{ position: "relative", width: "fit-content" }}>
        {isVideo ? (
          job.resultUrl && (
            <video src={job.resultUrl} controls style={{ maxWidth: 520, width: "100%", borderRadius: 14, border: "1px solid var(--line)" }} />
          )
        ) : job.beforeUrl && job.resultUrl ? (
          <BeforeAfter before={job.beforeUrl} after={job.resultUrl} alt="your product" />
        ) : (
          job.resultUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={job.resultUrl} alt="generated shot" style={{ maxWidth: 520, width: "100%", borderRadius: 14, border: "1px solid var(--line)" }} />
          )
        )}
        {showLabel && (
          <span className="chip" style={{ position: "absolute", bottom: 12, left: 12, background: "rgba(22,22,22,0.7)", color: "#fff", borderColor: "transparent" }}>
            Created with AI
          </span>
        )}
      </div>

      {/* Provenance toggle (Section 10) */}
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        <input type="checkbox" checked={showLabel} onChange={(e) => setShowLabel(e.target.checked)} />
        Show the &quot;Created with AI&quot; label on this image
      </label>

      {/* AMBER QC */}
      {tier === "amber" && job.qcStatus !== "approved" && (
        <div className="card" style={{ borderColor: "var(--caution)" }}>
          <strong>Quick review</strong>
          <div style={{ display: "grid", gap: 8, margin: "12px 0" }}>
            {QC_CHECKLIST.map((c) => (
              <label key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                <input type="checkbox" checked={!!checks[c.id]} onChange={(e) => setChecks((s) => ({ ...s, [c.id]: e.target.checked }))} />
                {c.label}
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" disabled={busy || QC_CHECKLIST.some((c) => !checks[c.id])} onClick={approve}>
              Approve
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={regenerate}>Regenerate</button>
          </div>
        </div>
      )}
      {tier === "amber" && job.qcStatus === "approved" && (
        <span className="chip chip-green" style={{ width: "fit-content" }}>Approved</span>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {job.resultUrl && (
          <a className="btn btn-solid" href={job.resultUrl} download={downloadName} target="_blank" rel="noreferrer">
            Download
          </a>
        )}
        <button className="btn btn-ghost" disabled={busy} onClick={regenerate}>Regenerate</button>
        <button className="btn btn-ghost" onClick={() => router.push("/app/shots")}>My shots</button>
      </div>

      {/* Generate video from this still */}
      {!isVideo && (
        <div className="card" style={{ display: "grid", gap: 12 }}>
          <strong>Bring it to life</strong>
          <p className="muted" style={{ fontSize: 14, margin: 0 }}>
            Animate this shot into a short clip. The product stays locked as the first frame.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select className="select" style={{ maxWidth: 240 }} value={motion} onChange={(e) => setMotion(e.target.value)}>
              {MOTION_PRESETS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <button className="btn btn-primary" disabled={busy} onClick={makeVideo}>Generate video</button>
          </div>
        </div>
      )}
    </div>
  );
}
