"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Uploader, type UploadedItem } from "./Uploader";
import { SmartImage } from "./SmartImage";
import { TierBadge } from "./TierBadge";
import { LoadingStudio } from "./LoadingStudio";
import { CustomSelect, type Option } from "./ui/CustomSelect";
import { ThumbTile } from "./ui/ThumbTile";
import { CATEGORY_LABELS, SUBTYPES } from "@/lib/shot/subtypes";
import { presetsForCategory } from "@/lib/shot/presets";
import { FORMATS } from "@/lib/shot/formats";
import { motionsForCategory } from "@/lib/shot/motion";
import { thumbUrl } from "@/lib/shot/thumbnails";
import { TIER_PRESENTATION } from "@/lib/shot/qc";
import {
  ETHNICITIES,
  BODIES,
  GENDERS,
  MAKEUP,
  HAIR,
  BACKGROUNDS,
  LIGHTING,
  FRAMINGS,
  VIBES,
  posesForCategory,
  framingToShotType,
  type Category,
  type ShotSpec,
  type ShotType,
  type Ethnicity,
  type Body,
  type Gender,
} from "@/lib/shot/spec";
import type { Tier } from "@/lib/engine/tier";

export interface SavedModelOption {
  id: string;
  name: string;
  image_paths: string[];
}

type Mode = "presets" | "advanced";

interface EstimateResp {
  need: string;
  tier: Tier;
  credits: number;
  blocked: string | null;
}

const STEPS = ["Upload", "What is it", "Choose your shot", "Video", "Review"];

function titleize(s: string) {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
const opts = (values: readonly string[]): Option[] => values.map((v) => ({ value: v, label: titleize(v) }));

export function NewShotWizard({ savedModels = [] }: { savedModels?: SavedModelOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [modelId, setModelId] = useState<string | null>(null);
  const [freeBrief, setFreeBrief] = useState("");

  const [products, setProducts] = useState<UploadedItem[]>([]);
  const [vibeRef, setVibeRef] = useState<UploadedItem | null>(null);

  const [category, setCategory] = useState<Category | null>(null);
  const [subType, setSubType] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("presets");
  const [presetId, setPresetId] = useState<string | null>(null);
  const [adv, setAdv] = useState<Partial<ShotSpec>>({ quality: "standard" }); // P3: standard default
  const [shotTypeOverride, setShotTypeOverride] = useState<ShotType>("on-model-full");

  const [videoOn, setVideoOn] = useState(false);
  const [motionPreset, setMotionPreset] = useState<string | undefined>(undefined);
  const [seconds, setSeconds] = useState(5);

  const [estimate, setEstimate] = useState<EstimateResp | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const goStep = (s: number) => {
    setStep(s);
    setMaxStep((m) => Math.max(m, s));
  };

  // Draft persistence.
  const DRAFT_KEY = "drape-draft-v2";
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
      if (!d) return;
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
      if (typeof d.step === "number") {
        setStep(d.step);
        setMaxStep(d.step);
      }
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ products, vibeRef, category, subType, mode, presetId, adv, shotTypeOverride, videoOn, motionPreset, seconds, modelId, freeBrief, step }));
    } catch {
      /* ignore */
    }
  }, [products, vibeRef, category, subType, mode, presetId, adv, shotTypeOverride, videoOn, motionPreset, seconds, modelId, freeBrief, step]);

  // M4: keep pose/motion valid for the chosen category.
  const poses = category ? posesForCategory(category) : [];
  const motions = category ? motionsForCategory(category) : [];
  useEffect(() => {
    if (category && adv.pose && !poses.includes(adv.pose)) {
      setAdv((a) => ({ ...a, pose: undefined }));
    }
    if (category && motionPreset && !motions.some((m) => m.id === motionPreset)) {
      setMotionPreset(motions[0]?.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const spec = useMemo<ShotSpec | null>(() => {
    if (!category || !subType) return null;
    const presetSpec = mode === "presets" && presetId ? presetsForCategory(category).find((p) => p.id === presetId)?.spec ?? {} : adv;
    const framing = presetSpec.framing ?? adv.framing;
    const shotType = mode === "presets" ? presetSpec.shotType ?? framingToShotType(framing, "on-model-full") : shotTypeOverride;
    const selectedModel = savedModels.find((m) => m.id === modelId);
    return {
      ...presetSpec,
      category,
      subType,
      shotType,
      referenceImagePaths: products.map((p) => p.path),
      vibeReferencePath: vibeRef?.path,
      modelImagePaths: selectedModel?.image_paths,
      freeBrief: freeBrief.trim() || undefined,
      video: videoOn ? { enabled: true, motionPreset, seconds } : undefined,
    } as ShotSpec;
  }, [category, subType, mode, presetId, adv, shotTypeOverride, products, vibeRef, videoOn, motionPreset, seconds, modelId, savedModels, freeBrief]);

  useEffect(() => {
    if (step !== 4 || !spec) return;
    let cancelled = false;
    setEstimating(true);
    setEstimate(null);
    fetch("/api/estimate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })
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

  // MN3: "Suggest a look" ENRICHES Advanced (does not bounce to Presets or discard work).
  function suggestLook() {
    if (!category) return;
    const combos: Record<Category, { adv: Partial<ShotSpec>; shotType: ShotType }> = {
      apparel: {
        adv: { model: { ethnicity: "south-asian-medium", body: "mid-size" }, makeup: "natural-fresh", hair: "open", pose: "s-curve", background: "light-grey", lighting: "soft-two-zone", framing: "full-length", vibe: "quiet-luxury", quality: adv.quality ?? "standard" },
        shotType: "on-model-full",
      },
      jewellery: {
        adv: { model: { ethnicity: "south-asian-fair" }, makeup: "natural-fresh", hair: "updo", pose: "neck-decollete-crop", background: "light-grey", lighting: "diffused-tent-sparkle", framing: "close-up-portrait", vibe: "demi-fine-everyday", quality: adv.quality ?? "standard" },
        shotType: "detail-macro",
      },
      accessory: {
        adv: { model: { ethnicity: "mixed", body: "slim" }, makeup: "natural-fresh", hair: "sleek", pose: "s-curve", background: "light-grey", lighting: "soft-two-zone", framing: "three-quarter", vibe: "quiet-luxury", quality: adv.quality ?? "standard" },
        shotType: "lifestyle",
      },
    };
    const c = combos[category];
    setAdv((a) => ({ ...a, ...c.adv })); // enrich, keep free brief + quality
    setShotTypeOverride(c.shotType);
    setMode("advanced");
  }

  async function submit() {
    if (!spec) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/shots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) });
      const json = await res.json();
      if (res.status === 402) {
        setSubmitError("You do not have enough credits for this shot. Top up to continue.");
        setSubmitting(false);
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "Generation failed");
      try {
        localStorage.removeItem(DRAFT_KEY);
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
      {/* MN7: clickable stepper for visited steps; future steps disabled. */}
      <nav className="stepper" aria-label="Steps">
        {STEPS.map((label, i) => {
          const state = i === step ? "current" : i <= maxStep ? "done" : "todo";
          return (
            <button key={label} className="step" data-state={state} disabled={state === "todo"} onClick={() => state !== "todo" && setStep(i)}>
              {i + 1}. {label}
            </button>
          );
        })}
      </nav>

      {products.length > 0 && step > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 10, marginBottom: 20, background: "var(--surface)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={products[0].url} alt="your product" style={{ width: 40, height: 50, objectFit: "cover", borderRadius: 6 }} />
          <div style={{ fontSize: 13 }}>
            <strong>This is your product.</strong> <span className="muted">It stays the anchor for every shot. We never reinvent it.</span>
          </div>
        </div>
      )}

      {step === 0 && (
        <section style={{ display: "grid", gap: 20 }}>
          <h2 style={{ fontSize: 28 }}>Upload your product</h2>
          <p className="muted">A product photo, flat-lay, ghost mannequin, or hanger shot. We keep every detail of the real piece.</p>
          <Uploader label="Drop your product photo, or tap to browse" hint="PNG, JPG or WEBP, up to 25MB" onUploaded={(item) => setProducts((p) => [...p, item])} />
          {products.length > 0 && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {products.map((p) => (
                <div key={p.path} style={{ position: "relative" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="product" style={{ width: 96, height: 120, objectFit: "cover", borderRadius: 10, border: "1px solid var(--line)" }} />
                  <button className="chip" style={{ position: "absolute", top: 4, right: 4, padding: "2px 8px", cursor: "pointer" }} onClick={() => setProducts((arr) => arr.filter((x) => x.path !== p.path))}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <details>
            <summary className="muted" style={{ cursor: "pointer" }}>Add a reference image (the vibe you want), optional</summary>
            <div style={{ marginTop: 12 }}>
              {vibeRef ? <span className="chip">Vibe reference added</span> : <Uploader label="Add a vibe reference" onUploaded={setVibeRef} />}
            </div>
          </details>
        </section>
      )}

      {step === 1 && (
        <section style={{ display: "grid", gap: 20 }}>
          <h2 style={{ fontSize: 28 }}>What is it?</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
              <button key={c} className="tile" data-selected={category === c} onClick={() => { setCategory(c); setSubType(null); setPresetId(null); }} style={{ textAlign: "center", padding: 22 }}>
                <div style={{ fontWeight: 600, fontFamily: "var(--font-display)", fontSize: 18 }}>{CATEGORY_LABELS[c]}</div>
              </button>
            ))}
          </div>
          {category && (
            <div>
              <label className="label">Sub-type</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SUBTYPES[category].map((s) => (
                  <button key={s.id} className="chip" style={{ cursor: "pointer", borderColor: subType === s.id ? "var(--saffron)" : undefined, boxShadow: subType === s.id ? "0 0 0 1px var(--saffron)" : undefined, color: subType === s.id ? "var(--saffron)" : undefined }} onClick={() => setSubType(s.id)}>
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
            <button className={`btn ${mode === "presets" ? "btn-solid" : "btn-ghost"}`} onClick={() => setMode("presets")}>Presets</button>
            <button className={`btn ${mode === "advanced" ? "btn-solid" : "btn-ghost"}`} onClick={() => setMode("advanced")}>Advanced</button>
            <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={suggestLook} title="Pre-fills the Advanced controls with a strong art-directed combination">
              Suggest a look
            </button>
          </div>

          {mode === "presets" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {presetsForCategory(category).map((p) => (
                <PresetCard key={p.id} id={p.id} label={p.label} description={p.description} src={thumbUrl("presets", p.id)} selected={presetId === p.id} onClick={() => setPresetId(p.id)} />
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              {savedModels.length > 0 && (
                <div>
                  <label className="label">Use a saved model (your face across the catalog)</label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <ThumbTile label="None (describe)" src={null} selected={modelId === null} onClick={() => setModelId(null)} width={110} />
                    {savedModels.map((m) => (
                      <ThumbTile
                        key={m.id}
                        label={m.name}
                        media={m.image_paths[0] ? <SmartImage path={m.image_paths[0]} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : undefined}
                        selected={modelId === m.id}
                        onClick={() => setModelId(m.id)}
                        width={110}
                      />
                    ))}
                  </div>
                </div>
              )}

              {modelId === null ? (
                <AdvancedControls adv={adv} setAdv={setAdv} shotType={shotTypeOverride} setShotType={setShotTypeOverride} poses={poses} category={category} />
              ) : (
                <p className="muted" style={{ fontSize: 13 }}>Using a saved model anchors the face and body. Set, lighting and framing still apply below.</p>
              )}

              <div>
                <label className="label">Free brief (optional, we map it across your shot)</label>
                <textarea className="input" rows={2} value={freeBrief} onChange={(e) => setFreeBrief(e.target.value)} placeholder="e.g. festive Diwali campaign, warm tones, rooftop at golden hour" />
              </div>
            </div>
          )}
        </section>
      )}

      {step === 3 && (
        <section style={{ display: "grid", gap: 18 }}>
          <h2 style={{ fontSize: 28, display: "flex", alignItems: "center", gap: 10 }}>
            Add motion? <span className="chip" style={{ fontSize: 11 }}>Beta</span>
          </h2>
          <p className="muted">Animate the finished still into a short clip. Video anchors to your generated shot as the first frame, so the product stays locked. Video costs more credits and is in beta.</p>
          <label className="tile" style={{ display: "flex", alignItems: "center", gap: 12 }} data-selected={videoOn}>
            <input type="checkbox" checked={videoOn} onChange={(e) => setVideoOn(e.target.checked)} />
            <span style={{ fontWeight: 600 }}>Generate a video from this shot</span>
          </label>
          {videoOn && (
            <div style={{ display: "grid", gap: 14, maxWidth: 420 }}>
              <div>
                <label className="label">Motion</label>
                <CustomSelect value={motionPreset} options={motions.map((m) => ({ value: m.id, label: m.label }))} onChange={(v) => setMotionPreset(v)} placeholder="Choose a motion" />
              </div>
              <div>
                <label className="label">Clip length: {seconds}s</label>
                <input type="range" min={5} max={8} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} style={{ width: "100%" }} />
              </div>
              <p className="muted" style={{ fontSize: 13 }}>You will generate the still first, then create the video from it on the next screen.</p>
            </div>
          )}
        </section>
      )}

      {step === 4 && submitting && (
        <section style={{ display: "grid", gap: 18 }}>
          <LoadingStudio />
        </section>
      )}

      {step === 4 && !submitting && (
        <section style={{ display: "grid", gap: 18 }}>
          <h2 style={{ fontSize: 28 }}>Review and generate</h2>
          <div className="card" style={{ display: "grid", gap: 10 }}>
            <SummaryRow k="Product" v={`${category ? CATEGORY_LABELS[category] : ""}, ${subType ? titleize(subType) : ""}`} />
            <SummaryRow k="Shot" v={mode === "presets" && presetId ? titleize(presetId) : "Custom (advanced)"} />
            {videoOn && <SummaryRow k="Video" v={`${motionPreset ? titleize(motionPreset) : "Motion"}, ${seconds}s (next step)`} />}
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
              <span className="muted">Readiness</span>
              {estimate?.tier ? <TierBadge tier={estimate.tier} /> : <span className="muted">...</span>}
            </div>
            {/* MN1: explain the readiness flag only when it is amber/red. */}
            {estimate?.tier && estimate.tier !== "green" && (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>{TIER_PRESENTATION[estimate.tier].body}</p>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
              <span className="muted">Estimated cost</span>
              <strong>{estimating ? "Estimating..." : estimate ? `${estimate.credits} credits` : "n/a"}</strong>
            </div>
          </div>

          {estimate?.blocked && (
            <div className="card" style={{ borderColor: "var(--danger)" }}>
              <strong style={{ color: "#f08c82" }}>Heads up</strong>
              <p style={{ margin: "6px 0 0" }}>{estimate.blocked}</p>
              <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>If you continue, no credits are charged: we reserve and immediately refund.</p>
            </div>
          )}

          {submitError && <p style={{ color: "#f08c82" }}>{submitError}</p>}

          <button className="btn btn-primary" disabled={submitting || !spec} onClick={submit} style={{ minWidth: 160 }}>
            {submitting ? <Spinner label="Generating" /> : "Generate"}
          </button>
        </section>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28 }}>
        <button className="btn btn-ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</button>
        {step < 4 && <button className="btn btn-solid" disabled={!canNext} onClick={() => goStep(step + 1)}>Continue</button>}
      </div>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "drape-spin 0.7s linear infinite" }} />
      {label}
      <style>{`@keyframes drape-spin{to{transform:rotate(360deg)}}`}</style>
    </span>
  );
}

// Preset card with a skeleton-then-crossfade image (MN2) and always-present label + description (M3).
function PresetCard({ label, description, src, selected, onClick }: { id: string; label: string; description: string; src: string | null; selected: boolean; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <button className="tile" data-selected={selected} onClick={onClick} style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ aspectRatio: "4/5", position: "relative", background: "var(--surface-2)" }}>
        {src && <div className="skeleton" style={{ position: "absolute", inset: 0, opacity: loaded ? 0 : 1, transition: "opacity 0.3s" }} />}
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={label} loading="lazy" onLoad={() => setLoaded(true)} className={loaded ? "fade-in" : undefined} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: loaded ? 1 : 0 }} />
        )}
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontWeight: 600, fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 4 }}>{label}</div>
        <div className="muted" style={{ fontSize: 13 }}>{description}</div>
      </div>
    </button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function AdvancedControls({
  adv,
  setAdv,
  shotType,
  setShotType,
  poses,
  category,
}: {
  adv: Partial<ShotSpec>;
  setAdv: React.Dispatch<React.SetStateAction<Partial<ShotSpec>>>;
  shotType: ShotType;
  setShotType: (s: ShotType) => void;
  poses: ReturnType<typeof posesForCategory>;
  category: Category;
}) {
  const set = (patch: Partial<ShotSpec>) => setAdv((a) => ({ ...a, ...patch }));
  const SHOT_TYPES: ShotType[] = ["background-swap", "flat-lay", "colour-variant", "on-model-full", "detail-macro", "lifestyle"];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
      <Field label="Shot type">
        <CustomSelect value={shotType} options={opts(SHOT_TYPES)} onChange={(v) => v && setShotType(v as ShotType)} placeholder="Shot type" />
      </Field>
      <Field label="Model ethnicity">
        <CustomSelect value={adv.model?.ethnicity} options={opts(ETHNICITIES)} onChange={(v) => set({ model: { ...adv.model, ethnicity: v as Ethnicity | undefined } })} creatable />
      </Field>
      <Field label="Body">
        <CustomSelect value={adv.model?.body} options={opts(BODIES)} onChange={(v) => set({ model: { ...adv.model, body: v as Body | undefined } })} />
      </Field>
      <Field label="Gender">
        <CustomSelect value={adv.model?.gender} options={opts(GENDERS)} onChange={(v) => set({ model: { ...adv.model, gender: v as Gender | undefined } })} />
      </Field>
      <Field label="Makeup">
        <CustomSelect value={adv.makeup} options={opts(MAKEUP)} onChange={(v) => set({ makeup: v as typeof adv.makeup })} creatable />
      </Field>
      <Field label="Hair">
        <CustomSelect value={adv.hair} options={opts(HAIR)} onChange={(v) => set({ hair: v as typeof adv.hair })} creatable />
      </Field>

      {/* M3 + M4: pose gallery, every tile shows thumbnail OR labelled placeholder, filtered by category. */}
      <div style={{ gridColumn: "1 / -1" }}>
        <label className="label">Pose</label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {poses.map((pose) => (
            <ThumbTile key={pose} label={titleize(pose)} src={thumbUrl("poses", pose)} selected={adv.pose === pose} onClick={() => set({ pose: adv.pose === pose ? undefined : pose })} width={96} />
          ))}
          {poses.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No poses for this category.</p>}
        </div>
      </div>

      <Field label="Background">
        <CustomSelect value={adv.background} options={opts(BACKGROUNDS)} onChange={(v) => set({ background: v as typeof adv.background })} creatable />
      </Field>
      <Field label="Lighting">
        <CustomSelect value={adv.lighting} options={opts(LIGHTING)} onChange={(v) => set({ lighting: v as typeof adv.lighting })} creatable />
      </Field>
      <Field label="Framing">
        <CustomSelect value={adv.framing} options={opts(FRAMINGS)} onChange={(v) => set({ framing: v as typeof adv.framing })} />
      </Field>
      <Field label="Vibe">
        <CustomSelect value={adv.vibe} options={opts(VIBES)} onChange={(v) => set({ vibe: v as typeof adv.vibe })} creatable />
      </Field>
      <Field label="Output format">
        <CustomSelect value={adv.format} options={FORMATS.map((f) => ({ value: f.id, label: f.label }))} onChange={(v) => set({ format: v })} placeholder="Default (Portrait 3:4)" />
      </Field>
      <Field label="Quality">
        <CustomSelect
          value={adv.quality ?? "standard"}
          options={[
            { value: "standard", label: "Standard (faster, cheaper)" },
            { value: "hero", label: "Hero (max fidelity, more credits)" },
          ]}
          onChange={(v) => set({ quality: (v as "standard" | "hero") ?? "standard" })}
        />
      </Field>
      <p className="muted" style={{ gridColumn: "1 / -1", fontSize: 12, margin: 0 }}>
        Standard is great for most shots. Hero uses a premium model for maximum fidelity at a higher credit cost. {category === "jewellery" ? "Jewellery hero detail is enhanced and placed, not fabricated." : ""}
      </p>
    </div>
  );
}
