"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Uploader, type UploadedItem } from "./Uploader";
import { SmartImage } from "./SmartImage";
import { BeforeAfter } from "./BeforeAfter";
import { ResultView } from "./ResultView";
import { TierBadge } from "./TierBadge";
import { GalleryPicker, type PickOption } from "./ui/GalleryPicker";
import { ThumbTile } from "./ui/ThumbTile";
import { CATEGORY_LABELS, SUBTYPES } from "@/lib/shot/subtypes";
import { presetsForCategory, getPreset } from "@/lib/shot/presets";
import { FORMATS } from "@/lib/shot/formats";
import { motionsForCategory } from "@/lib/shot/motion";
import { thumbUrl } from "@/lib/shot/thumbnails";
import { TIER_PRESENTATION } from "@/lib/shot/qc";
import type { ProductAnalysis } from "@/lib/director/schema";
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

interface EstimateResp {
  need: string;
  tier: Tier;
  credits: number;
  blocked: string | null;
}

// The new "Looks" / Editorials read on the gorgeous Gemini brand imagery instead of bucket thumbs.
const LOOK_IMG: Record<string, string> = {
  "marketplace-clean": "/looks/catalog.png",
  "festive-editorial": "/looks/heritage.png",
  "quiet-luxury": "/looks/couture.png",
  "bridal-regal": "/looks/gala.png",
  "streetwear-fusion": "/looks/street.png",
  "demi-fine-everyday": "/looks/high-gloss.png",
};

function titleize(s: string) {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
const opts = (values: readonly string[]): PickOption[] => values.map((v) => ({ value: v, label: titleize(v) }));

// Map the director's free-text subtype read onto our taxonomy where it lines up, so the casting
// read pre-selects a real sub-type the user can confirm or change.
function matchSubType(category: Category, raw: string | null): string | null {
  if (!raw) return null;
  const r = raw.toLowerCase();
  const list = SUBTYPES[category];
  return (
    list.find((s) => s.id === r)?.id ??
    list.find((s) => r.includes(s.id) || s.label.toLowerCase().includes(r) || r.includes(s.label.toLowerCase()))?.id ??
    null
  );
}

export function Studio({ savedModels = [] }: { savedModels?: SavedModelOption[] }) {
  // Shared composer state (guided Looks + free controls coexist on the same spec).
  const [products, setProducts] = useState<UploadedItem[]>([]);
  const [vibeRef, setVibeRef] = useState<UploadedItem | null>(null);

  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [category, setCategory] = useState<Category | null>(null);
  const [subType, setSubType] = useState<string | null>(null);

  const [presetId, setPresetId] = useState<string | null>(null);
  const [custom, setCustom] = useState(false); // true once the user fine-tunes off a Look
  const [adv, setAdv] = useState<Partial<ShotSpec>>({ quality: "standard" });
  const [shotTypeOverride, setShotTypeOverride] = useState<ShotType>("on-model-full");

  const [modelId, setModelId] = useState<string | null>(null);
  const [freeBrief, setFreeBrief] = useState("");

  const [videoOn, setVideoOn] = useState(false);
  const [motionPreset, setMotionPreset] = useState<string | undefined>(undefined);
  const [seconds, setSeconds] = useState(5);

  const [estimate, setEstimate] = useState<EstimateResp | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // The in-canvas result: set after a shoot so the whole flow stays on one screen.
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Draft persistence (carried over from the wizard; same key bumped to v3).
  const DRAFT_KEY = "oviya-studio-v3";
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
      if (!d) return;
      if (d.products) setProducts(d.products);
      if (d.vibeRef) setVibeRef(d.vibeRef);
      if (d.analysis) setAnalysis(d.analysis);
      if (d.category) setCategory(d.category);
      if (d.subType) setSubType(d.subType);
      if (d.presetId) setPresetId(d.presetId);
      if (typeof d.custom === "boolean") setCustom(d.custom);
      if (d.adv) setAdv(d.adv);
      if (d.shotTypeOverride) setShotTypeOverride(d.shotTypeOverride);
      if (d.modelId) setModelId(d.modelId);
      if (d.freeBrief) setFreeBrief(d.freeBrief);
      if (typeof d.videoOn === "boolean") setVideoOn(d.videoOn);
      if (d.motionPreset) setMotionPreset(d.motionPreset);
      if (typeof d.seconds === "number") setSeconds(d.seconds);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ products, vibeRef, analysis, category, subType, presetId, custom, adv, shotTypeOverride, modelId, freeBrief, videoOn, motionPreset, seconds })
      );
    } catch {
      /* ignore */
    }
  }, [products, vibeRef, analysis, category, subType, presetId, custom, adv, shotTypeOverride, modelId, freeBrief, videoOn, motionPreset, seconds]);

  const poses = category ? posesForCategory(category) : [];
  const motions = category ? motionsForCategory(category) : [];

  // Keep pose/motion valid for the chosen category (a shirt must never offer an earring pose).
  useEffect(() => {
    if (category && adv.pose && !poses.includes(adv.pose)) setAdv((a) => ({ ...a, pose: undefined }));
    if (category && motionPreset && !motions.some((m) => m.id === motionPreset)) setMotionPreset(motions[0]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // Analyze the product the moment it lands, so the casting read is visible and confirmable.
  async function analyze(path: string) {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path }) });
      const j = await res.json();
      const a = (j?.analysis ?? null) as ProductAnalysis | null;
      setAnalysis(a);
      if (a?.product_category) {
        const cat = a.product_category as Category;
        setCategory((c) => c ?? cat);
        const sub = matchSubType(cat, a.garment_subtype);
        if (sub) setSubType((s) => s ?? sub);
        // Smart default: pre-select a strong Look for the detected category so one click can Shoot.
        setPresetId((p) => p ?? presetsForCategory(cat)[0]?.id ?? null);
      }
    } catch {
      setAnalysis(null);
    } finally {
      setAnalyzing(false);
    }
  }

  const selectedModel = savedModels.find((m) => m.id === modelId);
  const usingLook = !custom && !!presetId;

  const spec = useMemo<ShotSpec | null>(() => {
    if (!category || !subType) return null;
    const presetSpec = usingLook ? getPreset(presetId!)?.spec ?? {} : adv;
    const framing = presetSpec.framing ?? adv.framing;
    const shotType = usingLook ? presetSpec.shotType ?? framingToShotType(framing, "on-model-full") : shotTypeOverride;
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
  }, [category, subType, usingLook, presetId, adv, shotTypeOverride, products, vibeRef, selectedModel, freeBrief, videoOn, motionPreset, seconds]);

  // Live estimate so the action bar can show "Shoot . N credits" and the readiness tier.
  useEffect(() => {
    if (!spec || !category || !subType || products.length === 0) {
      setEstimate(null);
      return;
    }
    let cancelled = false;
    setEstimating(true);
    const t = setTimeout(() => {
      fetch("/api/estimate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })
        .then((r) => r.json())
        .then((j) => !cancelled && setEstimate(j))
        .catch(() => !cancelled && setEstimate(null))
        .finally(() => !cancelled && setEstimating(false));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [spec, category, subType, products.length]);

  // Fine-tuning a Look seeds Advanced from that Look (so guided work is never discarded).
  function startCustom() {
    if (custom) return;
    if (presetId) {
      const ps = getPreset(presetId)?.spec ?? {};
      setAdv((a) => ({ ...ps, ...a, quality: a.quality ?? ps.quality ?? "standard" }));
      if (ps.shotType) setShotTypeOverride(ps.shotType);
    }
    setCustom(true);
  }

  const setM = (patch: Partial<ShotSpec>) => setAdv((a) => ({ ...a, ...patch }));

  async function shoot() {
    if (!spec) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/shots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) });
      const json = await res.json();
      if (res.status === 402) {
        setSubmitError("You do not have enough credits for this shoot. Top up to continue.");
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "The shoot could not start");
      setActiveJobId(json.jobId);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "The shoot could not start");
    } finally {
      setSubmitting(false);
    }
  }

  const canShoot = !!spec && products.length > 0 && !submitting;

  // ---- Render ----
  return (
    <div className="studio">
      {/* LEFT: persistent control panel */}
      <div className="studio-panel">
        <div>
          <p className="eyebrow" style={{ marginBottom: 4 }}>On set</p>
          <h1 style={{ fontSize: 30 }}>The Studio</h1>
        </div>

        {/* 1. Product + casting read */}
        <section className="studio-sec">
          <span className="label">Your product</span>
          {products.length === 0 ? (
            <Uploader label="Drop your product, or tap to browse" hint="PNG, JPG or WEBP, up to 25MB" onUploaded={(item) => { setProducts([item]); analyze(item.path); }} />
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {products.map((p) => (
                <div key={p.path} style={{ position: "relative" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="product" style={{ width: 88, height: 112, objectFit: "cover", borderRadius: 10, border: "1px solid var(--line)" }} />
                  <button className="chip" style={{ position: "absolute", top: 4, right: 4, padding: "2px 8px", cursor: "pointer" }} onClick={() => { setProducts((arr) => arr.filter((x) => x.path !== p.path)); if (products.length <= 1) setAnalysis(null); }}>
                    Remove
                  </button>
                </div>
              ))}
              <Uploader label="Add another angle" onUploaded={(item) => setProducts((arr) => [...arr, item])} />
            </div>
          )}

          {products.length > 0 && (
            <div className="card" style={{ padding: 14, display: "grid", gap: 8 }}>
              {analyzing ? (
                <span className="muted" style={{ fontSize: 13 }}>Reading your piece<span className="dots" /></span>
              ) : analysis ? (
                <>
                  <div style={{ fontSize: 13 }}>
                    <strong style={{ fontFamily: "var(--font-display)" }}>We see </strong>
                    {[analysis.primary_color_name, analysis.fabric, analysis.garment_subtype ?? subType]
                      .filter(Boolean)
                      .map((x) => titleize(String(x)))
                      .join(", ") || "your product"}
                    .
                  </div>
                  <span className="muted" style={{ fontSize: 12 }}>This stays the anchor for every shoot. We enhance and place it, we never reinvent it.</span>
                </>
              ) : (
                <span className="muted" style={{ fontSize: 12 }}>Tell us what this is below, then pick a Look. Your product stays the anchor.</span>
              )}

              {/* Confirmable category + sub-type */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                  <button key={c} className="chip" style={{ cursor: "pointer", borderColor: category === c ? "var(--accent)" : undefined, color: category === c ? "var(--accent)" : undefined }} onClick={() => { setCategory(c); setSubType(null); setPresetId(presetsForCategory(c)[0]?.id ?? null); }}>
                    {CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
              {category && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {SUBTYPES[category].map((s) => (
                    <button key={s.id} className="chip" style={{ cursor: "pointer", fontSize: 11, borderColor: subType === s.id ? "var(--accent)" : undefined, color: subType === s.id ? "var(--accent)" : undefined }} onClick={() => setSubType(s.id)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {category && (
          <>
            {/* 2. Editorials / Looks */}
            <section className="studio-sec">
              <span className="label">Editorials</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {presetsForCategory(category).map((p) => (
                  <LookCard
                    key={p.id}
                    label={p.label}
                    src={LOOK_IMG[p.id] ?? null}
                    selected={usingLook && presetId === p.id}
                    onClick={() => { setPresetId(p.id); setCustom(false); }}
                  />
                ))}
              </div>
              {usingLook ? (
                <button className="btn btn-ghost" style={{ width: "fit-content", fontSize: 13, padding: "8px 14px" }} onClick={startCustom}>Fine-tune this look</button>
              ) : (
                <span className="chip chip-amber" style={{ width: "fit-content" }}>Custom direction</span>
              )}
            </section>

            {/* 3. Casting (muses) */}
            {savedModels.length > 0 && (
              <section className="studio-sec">
                <span className="label">Casting</span>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <ThumbTile label="Open casting" src={null} selected={modelId === null} onClick={() => setModelId(null)} width={88} />
                  {savedModels.map((m) => (
                    <ThumbTile
                      key={m.id}
                      label={m.name}
                      media={m.image_paths[0] ? <SmartImage path={m.image_paths[0]} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : undefined}
                      selected={modelId === m.id}
                      onClick={() => setModelId(m.id)}
                      width={88}
                    />
                  ))}
                </div>
                {selectedModel && <span className="muted" style={{ fontSize: 12 }}>{selectedModel.name} is cast. Your muse anchors the face and body; set, posing and light still apply.</span>}
              </section>
            )}

            {/* 4. Direction: posing, set, light (the cinematic trio, contextual by product) */}
            {custom && (
              <>
                <section className="studio-sec">
                  <span className="label">Posing</span>
                  <GalleryPicker
                    options={poses.map((p) => ({ value: p, label: titleize(p), thumb: thumbUrl("poses", p) }))}
                    value={adv.pose}
                    onChange={(v) => setM({ pose: v as ShotSpec["pose"] })}
                  />
                </section>
                <section className="studio-sec">
                  <span className="label">Location / Set</span>
                  <GalleryPicker
                    options={BACKGROUNDS.map((b) => ({ value: b, label: titleize(b), thumb: thumbUrl("sets", b) }))}
                    value={adv.background}
                    onChange={(v) => setM({ background: v as ShotSpec["background"] })}
                  />
                </section>
                <section className="studio-sec">
                  <span className="label">Light</span>
                  <GalleryPicker
                    options={LIGHTING.map((l) => ({ value: l, label: titleize(l), thumb: thumbUrl("lighting", l) }))}
                    value={adv.lighting}
                    onChange={(v) => setM({ lighting: v as ShotSpec["lighting"] })}
                  />
                </section>

                {/* 5. Fine-tune: model (contextual: hidden when a muse is cast), styling, framing, format, quality */}
                <details className="studio-sec">
                  <summary className="label" style={{ cursor: "pointer" }}>More direction</summary>
                  <div style={{ display: "grid", gap: 20, marginTop: 12 }}>
                    {!selectedModel && (
                      <>
                        <div className="studio-sec">
                          <span className="label">Casting look</span>
                          <GalleryPicker options={opts(ETHNICITIES)} value={adv.model?.ethnicity} onChange={(v) => setM({ model: { ...adv.model, ethnicity: v as Ethnicity | undefined } })} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                          <div className="studio-sec">
                            <span className="label">Body</span>
                            <GalleryPicker options={opts(BODIES)} value={adv.model?.body} onChange={(v) => setM({ model: { ...adv.model, body: v as Body | undefined } })} allowCustom={false} tileWidth={80} />
                          </div>
                          <div className="studio-sec">
                            <span className="label">Who</span>
                            <GalleryPicker options={opts(GENDERS)} value={adv.model?.gender} onChange={(v) => setM({ model: { ...adv.model, gender: v as Gender | undefined } })} allowCustom={false} tileWidth={80} />
                          </div>
                        </div>
                        <div className="studio-sec">
                          <span className="label">Makeup</span>
                          <GalleryPicker options={MAKEUP.map((x) => ({ value: x, label: titleize(x), thumb: thumbUrl("makeup", x) }))} value={adv.makeup} onChange={(v) => setM({ makeup: v as ShotSpec["makeup"] })} />
                        </div>
                        <div className="studio-sec">
                          <span className="label">Hair</span>
                          <GalleryPicker options={HAIR.map((x) => ({ value: x, label: titleize(x), thumb: thumbUrl("hair", x) }))} value={adv.hair} onChange={(v) => setM({ hair: v as ShotSpec["hair"] })} />
                        </div>
                      </>
                    )}
                    <div className="studio-sec">
                      <span className="label">Framing</span>
                      <GalleryPicker options={opts(FRAMINGS)} value={adv.framing} onChange={(v) => setM({ framing: v as ShotSpec["framing"] })} allowCustom={false} tileWidth={84} />
                    </div>
                    <div className="studio-sec">
                      <span className="label">Mood</span>
                      <GalleryPicker options={opts(VIBES)} value={adv.vibe} onChange={(v) => setM({ vibe: v as ShotSpec["vibe"] })} />
                    </div>
                    <div className="studio-sec">
                      <span className="label">Format</span>
                      <GalleryPicker options={FORMATS.map((f) => ({ value: f.id, label: f.label }))} value={adv.format} onChange={(v) => setM({ format: v })} allowCustom={false} tileWidth={84} />
                    </div>
                  </div>
                </details>
              </>
            )}

            {/* Quality applies to both Looks and custom. */}
            <section className="studio-sec">
              <span className="label">Quality</span>
              <div style={{ display: "flex", gap: 10 }}>
                <ThumbTile label="Standard" src={null} selected={(adv.quality ?? "standard") === "standard"} onClick={() => setM({ quality: "standard" })} width={120} />
                <ThumbTile label="Hero (max fidelity)" src={null} selected={adv.quality === "hero"} onClick={() => setM({ quality: "hero" })} width={120} />
              </div>
              <span className="muted" style={{ fontSize: 12 }}>
                Standard is great for most shoots. Hero uses a premium engine for maximum fidelity at a higher credit cost.
                {category === "jewellery" ? " Jewellery hero detail is enhanced and placed, not fabricated." : ""}
              </span>
            </section>

            {/* Note to the director (free brief) + the casting read's own suggestions. */}
            <section className="studio-sec">
              <span className="label">A note to the director</span>
              <textarea className="input" rows={2} value={freeBrief} onChange={(e) => setFreeBrief(e.target.value)} placeholder="e.g. festive Diwali campaign, warm tones, rooftop at golden hour" />
              {analysis?.recommended_looks?.length ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {analysis.recommended_looks.slice(0, 3).map((l) => (
                    <button key={l.label} className="chip" style={{ cursor: "pointer", fontSize: 11 }} title={l.one_line_brief} onClick={() => setFreeBrief(l.one_line_brief)}>
                      {l.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            {/* Mood reference (persistent reference slot). */}
            <section className="studio-sec">
              <span className="label">Mood reference (optional)</span>
              {vibeRef ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={vibeRef.url} alt="mood reference" style={{ width: 56, height: 70, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
                  <button className="btn btn-ghost" style={{ fontSize: 13, padding: "8px 14px" }} onClick={() => setVibeRef(null)}>Remove</button>
                </div>
              ) : (
                <Uploader label="Add a vibe reference" onUploaded={setVibeRef} />
              )}
            </section>

            {/* Motion (Beta, honest). */}
            <section className="studio-sec">
              <label className="tile" style={{ display: "flex", alignItems: "center", gap: 10 }} data-selected={videoOn}>
                <input type="checkbox" checked={videoOn} onChange={(e) => setVideoOn(e.target.checked)} />
                <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                  Bring it to life <span className="chip" style={{ fontSize: 10 }}>Beta</span>
                </span>
              </label>
              {videoOn && (
                <div style={{ display: "grid", gap: 10 }}>
                  <span className="muted" style={{ fontSize: 12 }}>You shoot the still first, then create the clip from it. The product stays locked as the first frame.</span>
                  <GalleryPicker options={motions.map((m) => ({ value: m.id, label: m.label }))} value={motionPreset} onChange={(v) => setMotionPreset(v)} allowCustom={false} tileWidth={96} />
                  <span className="muted" style={{ fontSize: 12 }}>Clip length: {seconds}s</span>
                  <input type="range" min={5} max={8} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} style={{ width: "100%" }} />
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* RIGHT: canvas + action bar */}
      <div className="studio-canvas">
        <div className="actionbar">
          {estimate?.tier && <TierBadge tier={estimate.tier} />}
          <div style={{ display: "grid", lineHeight: 1.2 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {estimating ? "Pricing the shoot..." : estimate ? `${estimate.credits} credits` : "Upload a product to begin"}
            </span>
            {estimate?.tier && estimate.tier !== "green" && (
              <span className="muted" style={{ fontSize: 11 }}>{TIER_PRESENTATION[estimate.tier].badge}</span>
            )}
          </div>
          <button className="btn btn-primary" disabled={!canShoot} onClick={shoot} style={{ marginLeft: "auto", minWidth: 150 }}>
            {submitting ? "Calling action..." : `Shoot${estimate ? ` · ${estimate.credits}` : ""}`}
          </button>
        </div>

        {submitError && <div className="card" style={{ borderColor: "var(--danger)", color: "#f08c82", fontSize: 14 }}>{submitError}</div>}

        {estimate?.blocked && !activeJobId && (
          <div className="card" style={{ borderColor: "var(--danger)" }}>
            <strong style={{ color: "#f08c82" }}>Heads up</strong>
            <p style={{ margin: "6px 0 0", fontSize: 14 }}>{estimate.blocked}</p>
            <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>If you shoot anyway, no credits are charged: we reserve and immediately refund.</p>
          </div>
        )}

        <div className="canvas-frame">
          {activeJobId ? (
            <div style={{ width: "100%", padding: 20 }}>
              <ResultView id={activeJobId} onJob={setActiveJobId} onReset={() => setActiveJobId(null)} />
            </div>
          ) : products.length > 0 ? (
            <div style={{ width: "100%", display: "grid", placeItems: "center", padding: 24 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={products[0].url} alt="your product" style={{ maxWidth: "100%", maxHeight: 460, objectFit: "contain", borderRadius: 12, boxShadow: "var(--shadow-2)" }} />
              <p className="muted" style={{ fontSize: 13, marginTop: 16, textAlign: "center", maxWidth: "40ch" }}>
                {usingLook && presetId ? `${getPreset(presetId)?.label} is set. ` : "Direct your shoot on the left. "}
                Press Shoot when you are ready.
              </p>
            </div>
          ) : (
            <EmptyCanvas />
          )}
        </div>
      </div>
    </div>
  );
}

function LookCard({ label, src, selected, onClick }: { label: string; src: string | null; selected: boolean; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <button className="thumbtile" data-selected={selected} onClick={onClick} title={label} style={{ padding: 0 }}>
      <div className="thumb-media" style={{ aspectRatio: "3 / 4" }}>
        {src ? (
          <>
            {!loaded && <div className="skeleton" style={{ position: "absolute", inset: 0 }} />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={label} loading="lazy" onLoad={() => setLoaded(true)} className={loaded ? "fade-in" : undefined} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: loaded ? 1 : 0 }} />
          </>
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "var(--surface-2)", color: "var(--fog)", fontFamily: "var(--font-display)", fontSize: 14 }}>{label}</div>
        )}
      </div>
      <div className="thumb-label">{label}</div>
    </button>
  );
}

function EmptyCanvas() {
  const [example, setExample] = useState(false);
  return (
    <div style={{ display: "grid", placeItems: "center", padding: 32, textAlign: "center", position: "relative", width: "100%" }}>
      {example ? (
        <div style={{ width: "100%", maxWidth: 360 }}>
          <BeforeAfter before="/before-after/1-before.png" after="/before-after/1-after.png" alt="example shoot" />
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
            A flat-lay kurta, placed on a muse with the exact colour and chikankari intact. Drag to reveal.
          </p>
          <button className="btn btn-ghost" style={{ marginTop: 12, fontSize: 13, padding: "8px 16px" }} onClick={() => setExample(false)}>Back</button>
        </div>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/empty/studio.png" alt="" style={{ width: "100%", maxWidth: 360, borderRadius: 14, opacity: 0.85, marginBottom: 18 }} />
          <h2 style={{ fontSize: 24 }}>The set is ready</h2>
          <p className="muted" style={{ maxWidth: "34ch", marginTop: 6 }}>Upload your product to step on set. Your piece stays the anchor for every shoot.</p>
          <button className="btn btn-ghost" style={{ marginTop: 16, fontSize: 13, padding: "9px 18px" }} onClick={() => setExample(true)}>See an example shoot</button>
        </>
      )}
    </div>
  );
}
