"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Uploader, type UploadedItem } from "./Uploader";
import { SmartImage } from "./SmartImage";
import { TierBadge } from "./TierBadge";

export interface SavedModelOption {
  id: string;
  name: string;
  image_paths: string[];
}
import { CATEGORY_LABELS, SUBTYPES } from "@/lib/shot/subtypes";
import { presetsForCategory } from "@/lib/shot/presets";
import { FORMATS } from "@/lib/shot/formats";
import { MOTION_PRESETS } from "@/lib/shot/motion";
import { thumbUrl } from "@/lib/shot/thumbnails";
import {
  ETHNICITIES,
  BODIES,
  GENDERS,
  MAKEUP,
  HAIR,
  POSES,
  BACKGROUNDS,
  LIGHTING,
  FRAMINGS,
  VIBES,
  framingToShotType,
  type Category,
  type ShotSpec,
  type ShotType,
} from "@/lib/shot/spec";
import type { Tier } from "@/lib/engine/tier";

type Mode = "presets" | "advanced";

interface EstimateResp {
  need: string;
  tier: Tier;
  credits: number;
  blocked: string | null;
}

const STEPS = ["Upload", "What is it?", "Choose your shot", "Video", "Review"];

function titleize(s: string) {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function NewShotWizard({ savedModels = [] }: { savedModels?: SavedModelOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [modelId, setModelId] = useState<string | null>(null);
  const [freeBrief, setFreeBrief] = useState("");

  // Step 1: uploads
  const [products, setProducts] = useState<UploadedItem[]>([]);
  const [vibeRef, setVibeRef] = useState<UploadedItem | null>(null);

  // Step 2: category + subtype
  const [category, setCategory] = useState<Category | null>(null);
  const [subType, setSubType] = useState<string | null>(null);

  // Step 3: shot
  const [mode, setMode] = useState<Mode>("presets");
  const [presetId, setPresetId] = useState<string | null>(null);
  const [adv, setAdv] = useState<Partial<ShotSpec>>({ quality: "hero" });
  const [shotTypeOverride, setShotTypeOverride] = useState<ShotType>("on-model-full");

  // Step 4: video
  const [videoOn, setVideoOn] = useState(false);
  const [motionPreset, setMotionPreset] = useState(MOTION_PRESETS[0].id);
  const [seconds, setSeconds] = useState(5);

  // Step 5: estimate + submit
  const [estimate, setEstimate] = useState<EstimateResp | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Draft persistence: keep the whole flow in localStorage so a refresh never loses work.
  const DRAFT_KEY = "drape-draft-v2";
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.products) setProducts(d.products);
      if (d.vibeRef) setVibeRef(d.vibeRef);
      if (d.category) setCategory(d.category);
      if (d.subType) setSubType(d.subType);
      if (d.mode) setMode(d.mode);
      if (d.presetId) setPresetId(d.presetId);
      if (d.adv) setAdv(d.adv);
      if (d.shotTypeOverride) setShotTypeOverride(d.shotTypeOverride);
      if (typeof d.videoOn === "boolean") setVideoOn(d.videoOn);
      if (d.motionPreset) setMotionPreset(d.motionPreset);
      if (typeof d.seconds === "number") setSeconds(d.seconds);
      if (d.modelId) setModelId(d.modelId);
      if (d.freeBrief) setFreeBrief(d.freeBrief);
      if (typeof d.step === "number") setStep(d.step);
    } catch {
      /* ignore corrupt draft */
    }
  }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    const d = { products, vibeRef, category, subType, mode, presetId, adv, shotTypeOverride, videoOn, motionPreset, seconds, modelId, freeBrief, step };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {
      /* quota / private mode */
    }
  }, [products, vibeRef, category, subType, mode, presetId, adv, shotTypeOverride, videoOn, motionPreset, seconds, modelId, freeBrief, step]);

  const spec = useMemo<ShotSpec | null>(() => {
    if (!category || !subType) return null;
    const presetSpec =
      mode === "presets" && presetId
        ? presetsForCategory(category).find((p) => p.id === presetId)?.spec ?? {}
        : adv;
    const framing = presetSpec.framing ?? adv.framing;
    const shotType =
      mode === "presets"
        ? presetSpec.shotType ?? framingToShotType(framing, "on-model-full")
        : shotTypeOverride;
    const selectedModel = savedModels.find((m) => m.id === modelId);
    return {
      ...presetSpec,
      category,
      subType,
      shotType, // canonical for tiering; not overwritten by the preset spread
      referenceImagePaths: products.map((p) => p.path),
      vibeReferencePath: vibeRef?.path,
      modelImagePaths: selectedModel?.image_paths,
      freeBrief: freeBrief.trim() || undefined,
      video: videoOn ? { enabled: true, motionPreset, seconds } : undefined,
    } as ShotSpec;
  }, [category, subType, mode, presetId, adv, shotTypeOverride, products, vibeRef, videoOn, motionPreset, seconds, modelId, savedModels, freeBrief]);

  // Fetch estimate when entering review.
  useEffect(() => {
    if (step !== 4 || !spec) return;
    let cancelled = false;
    setEstimating(true);
    setEstimate(null);
    fetch("/api/estimate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ spec }),
    })
      .then((r) => r.json())
      .then((j) => !cancelled && setEstimate(j))
      .catch(() => !cancelled && setEstimate(null))
      .finally(() => !cancelled && setEstimating(false));
    return () => {
      cancelled = true;
    };
  }, [step, spec]);

  const canNext = useMemo(() => {
    if (step === 0) return products.length > 0;
    if (step === 1) return !!category && !!subType;
    if (step === 2) return mode === "presets" ? !!presetId : true;
    return true;
  }, [step, products, category, subType, mode, presetId]);

  async function submit() {
    if (!spec) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/shots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spec }),
      });
      const json = await res.json();
      if (res.status === 402) {
        setSubmitError("You do not have enough credits for this shot. Top up to continue.");
        setSubmitting(false);
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "Generation failed");
      try {
        localStorage.removeItem("drape-draft-v2");
      } catch {
        /* ignore */
      }
      router.push(`/app/shots/${json.jobId}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Generation failed");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Stepper step={step} />

      {products.length > 0 && step > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            border: "1px solid var(--line)",
            borderRadius: 10,
            marginBottom: 20,
            background: "#fff",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={products[0].url} alt="your product" style={{ width: 40, height: 50, objectFit: "cover", borderRadius: 6 }} />
          <div style={{ fontSize: 13 }}>
            <strong>This is your product.</strong>{" "}
            <span className="muted">It stays the anchor for every shot. We never reinvent it.</span>
          </div>
        </div>
      )}

      {step === 0 && (
        <section style={{ display: "grid", gap: 20 }}>
          <h2 style={{ fontSize: 28 }}>Upload your product</h2>
          <p className="muted">
            A product photo, flat-lay, ghost mannequin, or hanger shot. We keep every detail of the
            real piece.
          </p>
          <Uploader
            label="Drop your product photo, or tap to browse"
            hint="PNG, JPG or WEBP, up to 25MB"
            onUploaded={(item) => setProducts((p) => [...p, item])}
          />
          {products.length > 0 && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {products.map((p) => (
                <div key={p.path} style={{ position: "relative" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt="product"
                    style={{ width: 96, height: 120, objectFit: "cover", borderRadius: 10, border: "1px solid var(--line)" }}
                  />
                  <button
                    className="chip"
                    style={{ position: "absolute", top: 4, right: 4, padding: "2px 8px", cursor: "pointer" }}
                    onClick={() => setProducts((arr) => arr.filter((x) => x.path !== p.path))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <details>
            <summary className="muted" style={{ cursor: "pointer" }}>
              Add a reference image or video (the vibe you want), optional
            </summary>
            <div style={{ marginTop: 12 }}>
              {vibeRef ? (
                <span className="chip">Vibe reference added</span>
              ) : (
                <Uploader label="Add a vibe reference" onUploaded={setVibeRef} />
              )}
            </div>
          </details>
        </section>
      )}

      {step === 1 && (
        <section style={{ display: "grid", gap: 20 }}>
          <h2 style={{ fontSize: 28 }}>What is it?</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
              <button
                key={c}
                className="tile"
                data-selected={category === c}
                onClick={() => {
                  setCategory(c);
                  setSubType(null);
                  setPresetId(null);
                }}
                style={{ textAlign: "center", padding: 22 }}
              >
                <div style={{ fontWeight: 600, fontFamily: "var(--font-display)", fontSize: 18 }}>
                  {CATEGORY_LABELS[c]}
                </div>
              </button>
            ))}
          </div>
          {category && (
            <div>
              <label className="label">Sub-type</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SUBTYPES[category].map((s) => (
                  <button
                    key={s.id}
                    className="chip"
                    data-selected={subType === s.id}
                    style={{
                      cursor: "pointer",
                      borderColor: subType === s.id ? "var(--saffron)" : undefined,
                      boxShadow: subType === s.id ? "0 0 0 1px var(--saffron)" : undefined,
                    }}
                    onClick={() => setSubType(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {step === 2 && category && (
        <section style={{ display: "grid", gap: 18 }}>
          <h2 style={{ fontSize: 28 }}>Choose your shot</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className={`btn ${mode === "presets" ? "btn-solid" : "btn-ghost"}`} onClick={() => setMode("presets")}>
              Presets
            </button>
            <button className={`btn ${mode === "advanced" ? "btn-solid" : "btn-ghost"}`} onClick={() => setMode("advanced")}>
              Advanced
            </button>
            <button
              className="btn btn-primary"
              style={{ marginLeft: "auto" }}
              onClick={() => {
                const pick =
                  category === "jewellery"
                    ? "demi-fine-everyday"
                    : category === "accessory"
                    ? "quiet-luxury"
                    : "marketplace-clean";
                setMode("presets");
                setPresetId(presetsForCategory(category).find((p) => p.id === pick)?.id ?? presetsForCategory(category)[0]?.id ?? null);
              }}
            >
              Art director&rsquo;s pick
            </button>
          </div>

          {mode === "presets" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {presetsForCategory(category).map((p) => {
                const thumb = thumbUrl("presets", p.id);
                return (
                  <button key={p.id} className="tile" data-selected={presetId === p.id} onClick={() => setPresetId(p.id)} style={{ padding: thumb ? 0 : 16, overflow: "hidden" }}>
                    {thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt={p.label} loading="lazy" style={{ width: "100%", aspectRatio: "4/5", objectFit: "cover", display: "block" }} />
                    )}
                    <div style={{ padding: thumb ? "12px 14px" : 0 }}>
                      <div style={{ fontWeight: 600, fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 4 }}>
                        {p.label}
                      </div>
                      <div className="muted" style={{ fontSize: 13 }}>{p.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              {savedModels.length > 0 && (
                <div>
                  <label className="label">Use a saved model (your face across the catalog)</label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      className="tile"
                      data-selected={modelId === null}
                      style={{ width: 110, padding: 10, textAlign: "center" }}
                      onClick={() => setModelId(null)}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600 }}>None</div>
                      <div className="muted" style={{ fontSize: 11 }}>describe instead</div>
                    </button>
                    {savedModels.map((m) => (
                      <button
                        key={m.id}
                        className="tile"
                        data-selected={modelId === m.id}
                        style={{ width: 110, padding: 0, overflow: "hidden" }}
                        onClick={() => setModelId(m.id)}
                      >
                        <div style={{ aspectRatio: "3/4", background: "var(--ink)" }}>
                          {m.image_paths[0] && (
                            <SmartImage path={m.image_paths[0]} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          )}
                        </div>
                        <div style={{ fontSize: 12, padding: "6px 8px" }}>{m.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {modelId === null && (
                <AdvancedControls
                  adv={adv}
                  setAdv={setAdv}
                  shotType={shotTypeOverride}
                  setShotType={setShotTypeOverride}
                />
              )}
              {modelId !== null && (
                <p className="muted" style={{ fontSize: 13 }}>
                  Using a saved model anchors the face and body. Shot type, set, lighting and framing
                  still apply.
                </p>
              )}

              <div>
                <label className="label">Free brief (optional, Claude maps it across the shot)</label>
                <textarea
                  className="input"
                  rows={2}
                  value={freeBrief}
                  onChange={(e) => setFreeBrief(e.target.value)}
                  placeholder="e.g. festive Diwali campaign, warm tones, rooftop at golden hour"
                />
              </div>
            </div>
          )}
        </section>
      )}

      {step === 3 && (
        <section style={{ display: "grid", gap: 18 }}>
          <h2 style={{ fontSize: 28 }}>Add motion?</h2>
          <p className="muted">
            Animate the finished still into a short clip. Video anchors to your generated shot as the
            first frame, so the product stays locked. Video costs more credits.
          </p>
          <label className="tile" style={{ display: "flex", alignItems: "center", gap: 12 }} data-selected={videoOn}>
            <input type="checkbox" checked={videoOn} onChange={(e) => setVideoOn(e.target.checked)} />
            <span style={{ fontWeight: 600 }}>Generate a video from this shot</span>
          </label>
          {videoOn && (
            <div style={{ display: "grid", gap: 14, maxWidth: 420 }}>
              <div>
                <label className="label">Motion</label>
                <select className="select" value={motionPreset} onChange={(e) => setMotionPreset(e.target.value)}>
                  {MOTION_PRESETS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Clip length: {seconds}s</label>
                <input type="range" min={5} max={8} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} style={{ width: "100%" }} />
              </div>
              <p className="muted" style={{ fontSize: 13 }}>
                You will generate the still first, then create the video from it on the next screen.
              </p>
            </div>
          )}
        </section>
      )}

      {step === 4 && (
        <section style={{ display: "grid", gap: 18 }}>
          <h2 style={{ fontSize: 28 }}>Review and generate</h2>
          <div className="card" style={{ display: "grid", gap: 10 }}>
            <SummaryRow k="Product" v={`${category ? CATEGORY_LABELS[category] : ""}, ${subType ? titleize(subType) : ""}`} />
            <SummaryRow k="Shot" v={mode === "presets" && presetId ? titleize(presetId) : "Custom (advanced)"} />
            {videoOn && <SummaryRow k="Video" v={`${titleize(motionPreset)}, ${seconds}s (next step)`} />}
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
              <span className="muted">Readiness</span>
              {estimate?.tier ? <TierBadge tier={estimate.tier} /> : <span className="muted">...</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
              <span className="muted">Estimated cost</span>
              <strong>{estimating ? "Estimating..." : estimate ? `${estimate.credits} credits` : "n/a"}</strong>
            </div>
          </div>

          {estimate?.blocked && (
            <div className="card" style={{ borderColor: "var(--danger)", background: "color-mix(in srgb, var(--danger) 6%, white)" }}>
              <strong style={{ color: "var(--danger)" }}>Heads up</strong>
              <p style={{ margin: "6px 0 0" }}>{estimate.blocked}</p>
              <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                If you continue, no credits are charged: we reserve and immediately refund.
              </p>
            </div>
          )}

          {submitError && <p style={{ color: "var(--danger)" }}>{submitError}</p>}

          <button className="btn btn-primary" disabled={submitting || !spec} onClick={submit}>
            {submitting ? "Generating..." : "Generate"}
          </button>
        </section>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28 }}>
        <button className="btn btn-ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          Back
        </button>
        {step < 4 && (
          <button className="btn btn-solid" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
      {STEPS.map((label, i) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className="chip"
            style={{
              borderColor: i === step ? "var(--saffron)" : undefined,
              color: i <= step ? "var(--ink)" : "var(--fog)",
              boxShadow: i === step ? "0 0 0 1px var(--saffron)" : undefined,
            }}
          >
            {i + 1}. {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span className="muted">{k}</span>
      <span style={{ textAlign: "right" }}>{v}</span>
    </div>
  );
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  none = "Default",
}: {
  label: string;
  value: T | undefined;
  options: readonly T[];
  onChange: (v: T | undefined) => void;
  none?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select
        className="select"
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}
      >
        <option value="">{none}</option>
        {options.map((o) => (
          <option key={o} value={o}>{titleize(o)}</option>
        ))}
      </select>
    </div>
  );
}

function AdvancedControls({
  adv,
  setAdv,
  shotType,
  setShotType,
}: {
  adv: Partial<ShotSpec>;
  setAdv: (s: Partial<ShotSpec>) => void;
  shotType: ShotType;
  setShotType: (s: ShotType) => void;
}) {
  const set = (patch: Partial<ShotSpec>) => setAdv({ ...adv, ...patch });
  const SHOT_TYPES: ShotType[] = [
    "background-swap",
    "flat-lay",
    "colour-variant",
    "on-model-full",
    "detail-macro",
    "lifestyle",
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
      <div>
        <label className="label">Shot type</label>
        <select className="select" value={shotType} onChange={(e) => setShotType(e.target.value as ShotType)}>
          {SHOT_TYPES.map((s) => (
            <option key={s} value={s}>{titleize(s)}</option>
          ))}
        </select>
      </div>
      <Select label="Model ethnicity" value={adv.model?.ethnicity} options={ETHNICITIES} onChange={(v) => set({ model: { ...adv.model, ethnicity: v } })} />
      <Select label="Body" value={adv.model?.body} options={BODIES} onChange={(v) => set({ model: { ...adv.model, body: v } })} />
      <Select label="Gender" value={adv.model?.gender} options={GENDERS} onChange={(v) => set({ model: { ...adv.model, gender: v } })} />
      <Select label="Makeup" value={adv.makeup} options={MAKEUP} onChange={(v) => set({ makeup: v })} />
      <Select label="Hair" value={adv.hair} options={HAIR} onChange={(v) => set({ hair: v })} />
      <div style={{ gridColumn: "1 / -1" }}>
        <label className="label">Pose</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {POSES.map((pose) => {
            const thumb = thumbUrl("poses", pose);
            const selected = adv.pose === pose;
            return (
              <button
                key={pose}
                type="button"
                className="tile"
                data-selected={selected}
                onClick={() => set({ pose: selected ? undefined : pose })}
                style={{ width: 92, padding: thumb ? 0 : 8, overflow: "hidden" }}
                title={titleize(pose)}
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt={titleize(pose)} loading="lazy" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ fontSize: 12 }}>{titleize(pose)}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <Select label="Background" value={adv.background} options={BACKGROUNDS} onChange={(v) => set({ background: v })} />
      <Select label="Lighting" value={adv.lighting} options={LIGHTING} onChange={(v) => set({ lighting: v })} />
      <Select label="Framing" value={adv.framing} options={FRAMINGS} onChange={(v) => set({ framing: v })} />
      <Select label="Vibe" value={adv.vibe} options={VIBES} onChange={(v) => set({ vibe: v })} />
      <div>
        <label className="label">Output format</label>
        <select className="select" value={adv.format ?? ""} onChange={(e) => set({ format: e.target.value || undefined })}>
          <option value="">Default</option>
          {FORMATS.map((f) => (
            <option key={f.id} value={f.id}>{f.label} ({f.ratio})</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Quality</label>
        <select className="select" value={adv.quality ?? "hero"} onChange={(e) => set({ quality: e.target.value as "standard" | "hero" })}>
          <option value="hero">Hero (max fidelity)</option>
          <option value="standard">Standard (faster, cheaper)</option>
        </select>
      </div>
    </div>
  );
}
