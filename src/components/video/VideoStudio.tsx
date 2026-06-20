"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SmartImage } from "@/components/SmartImage";
import { Uploader, type UploadedItem } from "@/components/Uploader";
import { GalleryPicker } from "@/components/ui/GalleryPicker";
import { Slider } from "@/components/ui/Slider";
import { Button } from "@/components/ui/Button";
import { RequestControl } from "@/components/ui/RequestControl";
import { useToast } from "@/components/ui/Toast";
import { parseJsonSafe } from "@/lib/http";
import { MOTION_PRESETS } from "@/lib/shot/motion";

export interface VideoShot { id: string; result_ref: string | null }

const ASPECTS = [
  { value: "portrait-4-5", label: "Portrait 4:5" },
  { value: "story-9-16", label: "Story 9:16" },
  { value: "square", label: "Square 1:1" },
  { value: "landscape-16-9", label: "Landscape 16:9" },
];

export function VideoStudio({ shots }: { shots: VideoShot[] }) {
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const presetShot = params.get("shot");

  const [source, setSource] = useState<"shot" | "upload">(presetShot ? "shot" : "shot");
  const [shotId, setShotId] = useState<string | null>(presetShot);
  const [uploaded, setUploaded] = useState<UploadedItem | null>(null);
  const [seconds, setSeconds] = useState(5);
  const [motion, setMotion] = useState<string | undefined>(MOTION_PRESETS[0]?.id);
  const [intensity, setIntensity] = useState(40);
  const [aspect, setAspect] = useState<string | undefined>("portrait-4-5");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (presetShot) { setSource("shot"); setShotId(presetShot); } }, [presetShot]);

  const credits = useMemo(() => Math.ceil(seconds * 11.2), [seconds]);
  const ready = source === "shot" ? !!shotId : !!uploaded;

  async function animate() {
    setBusy(true);
    try {
      const intensityWord = intensity < 33 ? "gentle slow motion" : intensity > 66 ? "lively, energetic motion" : "natural motion";
      const aspectLabel = ASPECTS.find((a) => a.value === aspect)?.label;
      const res = await fetch("/api/video", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceShotId: source === "shot" ? shotId : undefined,
          sourcePath: source === "upload" ? uploaded?.path : undefined,
          seconds, motionPreset: motion, motionIntensity: intensityWord,
          brief: [aspectLabel, brief].filter(Boolean).join(", "),
        }),
      });
      const parsed = await parseJsonSafe<{ jobId: string }>(res);
      if (res.status === 503) { toast(parsed.error ?? "Video is in beta and switched off.", "info"); return; }
      if (res.status === 402) { toast("Not enough credits for video.", "error"); return; }
      if (!parsed.ok || !parsed.data?.jobId) { toast(parsed.error ?? "Could not start the video.", "error"); return; }
      router.push(`/app/shots/${parsed.data.jobId}`);
    } finally { setBusy(false); }
  }

  return (
    <div style={{ display: "grid", gap: 24, gridTemplateColumns: "1fr", maxWidth: 1000, margin: "0 auto" }}>
      <header>
        <p className="panel-eyebrow">Motion</p>
        <h1 className="display" style={{ fontSize: "var(--step-3)" }}>Video <span className="chip" style={{ fontSize: 12, verticalAlign: "middle" }}>Beta</span></h1>
        <p className="muted" style={{ maxWidth: "56ch", marginTop: 6 }}>Bring a shot to life. Your product stays the locked anchor across every frame. Video is in beta; if it cannot run you are never charged.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 24 }} className="hero-grid">
        {/* Source */}
        <section style={{ display: "grid", gap: 14 }}>
          <div className="seg" style={{ width: "fit-content" }}>
            <button data-on={source === "shot"} onClick={() => setSource("shot")}>From a shot</button>
            <button data-on={source === "upload"} onClick={() => setSource("upload")}>From a new image</button>
          </div>
          {source === "shot" ? (
            shots.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>No shots yet. Create one in the studio first, or upload an image.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10, maxHeight: 420, overflowY: "auto" }}>
                {shots.map((s) => s.result_ref && (
                  <button key={s.id} className="tilecard" onClick={() => setShotId(s.id)} style={{ padding: 0, cursor: "pointer", border: shotId === s.id ? "1px solid var(--accent-default)" : "1px solid var(--border-subtle)", boxShadow: shotId === s.id ? "0 0 0 1px var(--accent-default)" : undefined }}>
                    <div style={{ aspectRatio: "3 / 4" }}><SmartImage path={s.result_ref} alt="shot" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /></div>
                  </button>
                ))}
              </div>
            )
          ) : uploaded ? (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={uploaded.url} alt="source" style={{ width: 120, height: 150, objectFit: "cover", borderRadius: 12, border: "1px solid var(--border-subtle)" }} />
              <Button variant="ghost" size="sm" onClick={() => setUploaded(null)}>Replace</Button>
            </div>
          ) : (
            <Uploader label="Upload an image to animate" onUploaded={setUploaded} />
          )}
        </section>

        {/* Options */}
        <section style={{ display: "grid", gap: 16 }}>
          <div>
            <span className="label">Length</span>
            <div className="seg">{[5, 6, 7, 8].map((n) => <button key={n} data-on={seconds === n} onClick={() => setSeconds(n)}>{n}s</button>)}</div>
          </div>
          <div className="studio-sec">
            <span className="label">Motion</span>
            <GalleryPicker options={MOTION_PRESETS.map((m) => ({ value: m.id, label: m.label }))} value={motion} onChange={(v) => setMotion(v)} allowCustom tileWidth={96} />
          </div>
          <Slider value={intensity} min={0} max={100} onChange={setIntensity} leftLabel="Slow motion" rightLabel="Energetic" label="Motion intensity" />
          <div className="studio-sec">
            <span className="label">Aspect</span>
            <GalleryPicker options={ASPECTS} value={aspect} onChange={(v) => setAspect(v)} allowCustom={false} tileWidth={92} />
          </div>
          <div>
            <span className="label">A note to the director</span>
            <textarea className="input" rows={2} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. a slow turn toward camera, hair catching the breeze" />
          </div>
          <RequestControl context="video" />
        </section>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", position: "sticky", bottom: 16 }}>
        <Button variant="primary" size="lg" disabled={!ready} loading={busy} loadingLabel="Rolling" onClick={animate}>Animate, {credits} credits</Button>
        <span className="muted" style={{ fontSize: 12 }}>The product stays locked across frames.</span>
      </div>
    </div>
  );
}
