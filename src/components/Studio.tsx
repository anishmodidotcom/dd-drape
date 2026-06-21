"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Uploader, type UploadedItem } from "./Uploader";
import { ResultView } from "./ResultView";
import { BeforeAfter } from "./BeforeAfter";
import { TierBadge } from "./TierBadge";
import { Button } from "./ui/Button";
import { Sheet } from "./ui/Sheet";
import { Monogram } from "./ui/Wordmark";
import { Controls, type SavedModelOption } from "./studio/Controls";
import { ShootSet } from "./studio/ShootSet";
import { CATEGORY_LABELS, SUBTYPES } from "@/lib/shot/subtypes";
import { presetsForCategory, getPreset } from "@/lib/shot/presets";
import { TIER_PRESENTATION } from "@/lib/shot/qc";
import { parseJsonSafe } from "@/lib/http";
import type { ProductAnalysis } from "@/lib/director/schema";
import { framingToShotType, MAX_PRODUCTS, type Category, type ShotSpec, type ShotType } from "@/lib/shot/spec";
import type { Tier } from "@/lib/engine/tier";

interface EstimateResp { need: string; tier: Tier; credits: number; count: number; blocked: string | null }

const titleize = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
function matchSubType(category: Category, raw: string | null): string | null {
  if (!raw) return null;
  const r = raw.toLowerCase();
  const list = SUBTYPES[category];
  return list.find((s) => s.id === r)?.id ?? list.find((s) => r.includes(s.id) || s.label.toLowerCase().includes(r))?.id ?? null;
}

export function Studio({ savedModels: initialModels = [] }: { savedModels?: SavedModelOption[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"basic" | "advanced">("basic");
  const [quality, setQuality] = useState<"standard" | "hero">("standard");

  const [products, setProducts] = useState<UploadedItem[]>([]);
  const [vibeRef] = useState<UploadedItem | null>(null);
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [category, setCategory] = useState<Category | null>(null);
  const [subType, setSubType] = useState<string | null>(null);
  const [override, setOverride] = useState(false);
  const [saveProduct, setSaveProduct] = useState(true); // auto-save default (item 11)

  const [presetId, setPresetId] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const [adv, setAdv] = useState<Partial<ShotSpec>>({});
  const [shotTypeOverride, setShotTypeOverride] = useState<ShotType>("on-model-full");
  const [freeTextMap, setFreeTextMap] = useState<Record<string, string>>({});
  const [latitude, setLatitude] = useState(85);
  const [outputCount, setOutputCount] = useState(1);
  const [variateModel, setVariateModel] = useState(false);

  const [modelId, setModelId] = useState<string | null>(null);
  const [savedModels, setSavedModels] = useState<SavedModelOption[]>(initialModels);
  const [freeBrief, setFreeBrief] = useState("");

  const [estimate, setEstimate] = useState<EstimateResp | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [shootIds, setShootIds] = useState<string[] | null>(null);
  const [railOpen, setRailOpen] = useState(false);

  // Draft persistence.
  const DRAFT_KEY = "oviya-studio-v4";
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
      if (!d) return;
      setMode(d.mode ?? "basic"); setQuality(d.quality ?? "standard");
      if (d.products) setProducts(d.products);
      if (d.analysis) setAnalysis(d.analysis);
      if (d.category) setCategory(d.category);
      if (d.subType) setSubType(d.subType);
      if (d.presetId) setPresetId(d.presetId);
      if (typeof d.custom === "boolean") setCustom(d.custom);
      if (d.adv) setAdv(d.adv);
      if (d.freeTextMap) setFreeTextMap(d.freeTextMap);
      if (typeof d.latitude === "number") setLatitude(d.latitude);
      if (typeof d.outputCount === "number") setOutputCount(d.outputCount);
      if (d.modelId) setModelId(d.modelId);
      if (d.freeBrief) setFreeBrief(d.freeBrief);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ mode, quality, products, analysis, category, subType, presetId, custom, adv, freeTextMap, latitude, outputCount, modelId, freeBrief }));
    } catch { /* ignore */ }
  }, [mode, quality, products, analysis, category, subType, presetId, custom, adv, freeTextMap, latitude, outputCount, modelId, freeBrief]);

  async function refreshModels() {
    try {
      const r = await fetch("/api/models");
      const j = await parseJsonSafe<{ models: SavedModelOption[] }>(r);
      if (j.ok && j.data?.models) setSavedModels(j.data.models);
    } catch { /* ignore */ }
  }

  async function analyze(path: string) {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path }) });
      const parsed = await parseJsonSafe<{ analysis: ProductAnalysis | null }>(res);
      const a = (parsed.ok ? parsed.data?.analysis : null) ?? null;
      setAnalysis((prev) => prev ?? a);
      if (a?.product_category) {
        const cat = a.product_category as Category;
        setCategory((c) => c ?? cat);
        const sub = matchSubType(cat, a.garment_subtype);
        if (sub) setSubType((s) => s ?? sub);
        setPresetId((pp) => pp ?? presetsForCategory(cat)[0]?.id ?? null);
      } else { setOverride(true); }
    } catch { setOverride(true); } finally { setAnalyzing(false); }
  }

  const setFreeText = (k: string, v: string | undefined) =>
    setFreeTextMap((s) => { const n = { ...s }; if (v && v.trim()) n[k] = v.trim(); else delete n[k]; return n; });

  const selectedModel = savedModels.find((s) => s.id === modelId);
  const usingLook = !custom && !!presetId;

  const spec = useMemo<ShotSpec | null>(() => {
    if (!category || !subType) return null;
    const presetSpec = usingLook ? getPreset(presetId!)?.spec ?? {} : adv;
    const framing = presetSpec.framing ?? adv.framing;
    const shotType = usingLook ? presetSpec.shotType ?? framingToShotType(framing, "on-model-full") : framingToShotType(adv.framing, shotTypeOverride);
    const ft = { ...freeTextMap, latitude: `keep the product about ${latitude} percent strict (lower means more creative latitude)` };
    return {
      ...presetSpec,
      category, subType, shotType,
      referenceImagePaths: products.map((pp) => pp.path),
      vibeReferencePath: vibeRef?.path,
      modelImagePaths: selectedModel?.image_paths,
      freeBrief: freeBrief.trim() || undefined,
      freeText: Object.keys(ft).length ? ft : undefined,
      quality,
      outputCount,
      variateModel: outputCount > 1 ? variateModel : undefined,
      saveProduct,
    } as ShotSpec;
  }, [category, subType, usingLook, presetId, adv, shotTypeOverride, products, vibeRef, selectedModel, freeBrief, freeTextMap, latitude, quality, outputCount, variateModel, saveProduct]);

  useEffect(() => {
    if (!spec || !category || !subType || products.length === 0) { setEstimate(null); return; }
    let cancelled = false; setEstimating(true);
    const t = setTimeout(() => {
      fetch("/api/estimate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })
        .then((r) => r.json()).then((j) => !cancelled && setEstimate(j)).catch(() => !cancelled && setEstimate(null))
        .finally(() => !cancelled && setEstimating(false));
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [spec, category, subType, products.length]);

  function startCustom() {
    if (custom) return;
    if (presetId) {
      const ps = getPreset(presetId)?.spec ?? {};
      setAdv((a) => ({ ...ps, ...a }));
      if (ps.shotType) setShotTypeOverride(ps.shotType);
    }
    setCustom(true);
    setMode("advanced");
  }
  function pickLook(id: string) { setPresetId(id); setCustom(false); }

  async function shoot() {
    if (!spec) return;
    setSubmitting(true); setSubmitError(null); setRailOpen(false);
    try {
      const res = await fetch("/api/shots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) });
      const parsed = await parseJsonSafe<{ jobId: string; count?: number; frames?: { jobId: string }[] }>(res);
      if (res.status === 402) { setSubmitError("You do not have enough credits for this shoot. Top up to continue."); return; }
      if (!parsed.ok || !parsed.data?.jobId) throw new Error(parsed.error ?? "The shoot could not start");
      if (parsed.data.frames && parsed.data.frames.length > 1) setShootIds(parsed.data.frames.map((f) => f.jobId));
      else setActiveJobId(parsed.data.jobId);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "The shoot could not start");
    } finally { setSubmitting(false); }
  }
  function reset() { setActiveJobId(null); setShootIds(null); }

  const [sampling, setSampling] = useState(false);
  async function loadSample() {
    setSampling(true);
    try {
      const res = await fetch("/api/uploads/sample", { method: "POST" });
      const parsed = await parseJsonSafe<UploadedItem>(res);
      if (parsed.ok && parsed.data) { setProducts([parsed.data]); analyze(parsed.data.path); }
    } finally { setSampling(false); }
  }

  const canShoot = !!spec && products.length > 0 && !submitting;
  const showResult = activeJobId || shootIds;

  const railContent = category ? (
    <Controls
      mode={mode} category={category} adv={adv} setAdv={setAdv} freeText={freeTextMap} setFreeText={setFreeText}
      presetId={presetId} onPickLook={pickLook} usingLook={usingLook} onFineTune={startCustom}
      savedModels={savedModels} modelId={modelId} setModelId={setModelId} onModelsChanged={refreshModels}
      outputCount={outputCount} setOutputCount={setOutputCount} variateModel={variateModel} setVariateModel={setVariateModel}
      latitude={latitude} setLatitude={setLatitude}
    />
  ) : (
    <p className="muted" style={{ fontSize: 13 }}>Upload a product to begin directing.</p>
  );

  return (
    <div className="studio3">
      {/* CANVAS (hero) */}
      <div className="studio3-canvas">
        {/* Action bar */}
        <div className="actionbar3">
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div className="seg">
              <button data-on={mode === "basic"} onClick={() => setMode("basic")}>Basic</button>
              <button data-on={mode === "advanced"} onClick={() => setMode("advanced")}>Advanced</button>
            </div>
            <div className="seg">
              <button data-on={quality === "standard"} onClick={() => setQuality("standard")}>Draft</button>
              <button data-on={quality === "hero"} onClick={() => setQuality("hero")}>Hero</button>
            </div>
            {estimate?.tier && <TierBadge tier={estimate.tier} />}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button className="btn btn-ghost shoot-direct-mobile" onClick={() => setRailOpen(true)} style={{ display: "none" }}>Direct</button>
              <Button variant="primary" disabled={!canShoot} loading={submitting} loadingLabel="Styling" onClick={shoot}>
                {estimate ? `Shoot, ${estimate.credits} credits` : "Shoot"}
              </Button>
            </div>
          </div>
          <textarea
            className="input"
            rows={1}
            value={freeBrief}
            onChange={(e) => setFreeBrief(e.target.value)}
            placeholder="Describe the shoot in your own words, or just press Shoot. The director listens."
            style={{ resize: "none", minHeight: 44 }}
          />
          {(products.length > 0 || estimate) && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {products.length > 0 && <span className="chip">{products.length} product{products.length > 1 ? "s" : ""}</span>}
              {selectedModel && <span className="chip">Model: {selectedModel.name}</span>}
              {usingLook && presetId && <span className="chip">{getPreset(presetId)?.label}</span>}
              {outputCount > 1 && <span className="chip">{outputCount} frames</span>}
              {estimate?.tier && estimate.tier !== "green" && <span className="chip chip-amber">{TIER_PRESENTATION[estimate.tier].badge}</span>}
              {estimating && <span className="muted" style={{ fontSize: 12 }}>Pricing the shoot...</span>}
            </div>
          )}
          {submitError && <p style={{ color: "#f08c82", fontSize: 13, margin: 0 }}>{submitError}</p>}
          {estimate?.blocked && !showResult && <p className="muted" style={{ fontSize: 12, margin: 0 }}>{estimate.blocked} If you shoot anyway, no credits are charged: we reserve and immediately refund.</p>}
        </div>

        {/* Canvas */}
        <div className="canvas3">
          {shootIds ? (
            <div style={{ width: "100%", padding: 22 }}><ShootSet frameIds={shootIds} onReset={reset} /></div>
          ) : activeJobId ? (
            <div style={{ width: "100%", padding: 22, maxWidth: 720 }}><ResultView id={activeJobId} onJob={setActiveJobId} onReset={reset} /></div>
          ) : products.length > 0 ? (
            <div style={{ width: "100%", display: "grid", placeItems: "center", padding: 24 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={products[0].url} alt="your product" style={{ maxWidth: "100%", maxHeight: 480, objectFit: "contain", borderRadius: 14, boxShadow: "var(--shadow-2)" }} />
              <p className="serif-italic" style={{ marginTop: 16, color: "var(--text-secondary)", textAlign: "center", maxWidth: "40ch" }}>
                {usingLook && presetId ? `${getPreset(presetId)?.label} is set. ` : "Direct on the right, then "}Press Shoot when you are ready.
              </p>
            </div>
          ) : (
            <EmptyInvite onSample={loadSample} sampling={sampling} />
          )}
        </div>
      </div>

      {/* RIGHT RAIL (controls) */}
      <aside className="studio3-rail">
        <div className="studio3-railscroll">
          <section style={{ display: "grid", gap: 12 }}>
            <p className="panel-eyebrow">The piece</p>
            {products.length === 0 ? (
              <Uploader label="Drop your product, or tap to browse" hint="PNG, JPG or WEBP, any size" onUploaded={(item) => { setProducts([item]); analyze(item.path); }} />
            ) : (
              <>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {products.map((pp) => (
                    <div key={pp.path} style={{ position: "relative" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={pp.url} alt="product" style={{ width: 70, height: 88, objectFit: "cover", borderRadius: 9, border: "1px solid var(--border-subtle)" }} />
                      <button className="chip" style={{ position: "absolute", top: 3, right: 3, padding: "1px 7px", cursor: "pointer", fontSize: 10 }} onClick={() => { setProducts((arr) => arr.filter((x) => x.path !== pp.path)); if (products.length <= 1) setAnalysis(null); }}>×</button>
                    </div>
                  ))}
                  {products.length < MAX_PRODUCTS && (
                    <div style={{ width: 70 }}>
                      <Uploader label="+ Add" onUploaded={(item) => setProducts((arr) => [...arr, item])} />
                    </div>
                  )}
                </div>
                {products.find((pp) => pp.warning) && <span className="chip chip-amber" style={{ width: "fit-content" }}>{products.find((pp) => pp.warning)?.warning}</span>}

                {/* Confirmable read + hidden pills */}
                <div className="panel" style={{ padding: 12, display: "grid", gap: 8 }}>
                  {analyzing ? (
                    <span className="muted" style={{ fontSize: 13 }}>Identifying your piece<span className="dots" /></span>
                  ) : analysis ? (
                    <span style={{ fontSize: 13 }}>
                      <strong className="display">We see </strong>
                      {[analysis.primary_color_name, analysis.fabric, analysis.garment_subtype ?? subType].filter(Boolean).map((x) => titleize(String(x))).join(", ") || "your product"}
                      {products.length > 1 ? `, and ${products.length - 1} more` : ""}.
                    </span>
                  ) : (
                    <span className="muted" style={{ fontSize: 12 }}>Tell us what this is below.</span>
                  )}
                  {!override ? (
                    <button onClick={() => setOverride(true)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--text-muted)", textDecoration: "underline", textUnderlineOffset: 3, width: "fit-content" }}>Not quite? Tell us what it is</button>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                          <button key={c} className="chip" style={{ cursor: "pointer", borderColor: category === c ? "var(--accent-default)" : undefined, color: category === c ? "var(--accent-default)" : undefined }} onClick={() => { setCategory(c); setSubType(null); setPresetId(presetsForCategory(c)[0]?.id ?? null); }}>{CATEGORY_LABELS[c]}</button>
                        ))}
                      </div>
                      {category && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {SUBTYPES[category].map((s) => (
                            <button key={s.id} className="chip" style={{ cursor: "pointer", fontSize: 11, borderColor: subType === s.id ? "var(--accent-default)" : undefined, color: subType === s.id ? "var(--accent-default)" : undefined }} onClick={() => setSubType(s.id)}>{s.label}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
                    <input type="checkbox" checked={saveProduct} onChange={(e) => setSaveProduct(e.target.checked)} /> Save this product to my collection
                  </label>
                </div>
              </>
            )}
          </section>

          {railContent}
        </div>
      </aside>

      {/* Mobile: rail as a bottom sheet */}
      <Sheet open={railOpen} onClose={() => setRailOpen(false)} side="bottom">
        <div style={{ display: "grid", gap: 16 }}>
          <h3 className="display" style={{ fontSize: "var(--step-2)" }}>Direct the shoot</h3>
          {category ? railContent : <p className="muted">Upload a product first.</p>}
          <Button variant="primary" block disabled={!canShoot} onClick={shoot}>{estimate ? `Shoot, ${estimate.credits} credits` : "Shoot"}</Button>
        </div>
      </Sheet>

      <style>{`@media (max-width: 980px){ .shoot-direct-mobile{ display: inline-flex !important; } }`}</style>
    </div>
  );
}

function EmptyInvite({ onSample, sampling }: { onSample: () => void; sampling: boolean }) {
  const [example, setExample] = useState(false);
  return (
    <div style={{ display: "grid", placeItems: "center", padding: 40, textAlign: "center", width: "100%", maxWidth: 460 }}>
      {example ? (
        <div style={{ width: "100%", maxWidth: 340 }}>
          <BeforeAfter before="/before-after/1-before.png" after="/before-after/1-after.png" alt="example" />
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>A flat-lay kurta, placed on a model with the exact colour and embroidery intact. Drag to reveal.</p>
          <button className="btn btn-ghost" style={{ marginTop: 12, fontSize: 13 }} onClick={() => setExample(false)}>Back</button>
        </div>
      ) : (
        <>
          <Monogram size={64} />
          <h1 className="display" style={{ fontSize: "var(--step-3)", marginTop: 18 }}>The studio is yours</h1>
          <p className="serif-italic" style={{ color: "var(--text-secondary)", marginTop: 8 }}>Hand us the garment. We&apos;ll handle the drama.</p>
          <p className="muted" style={{ maxWidth: "34ch", marginTop: 10 }}>Upload your product on the right. It stays the anchor for every shoot, we never reinvent it.</p>
          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap", justifyContent: "center" }}>
            <Button variant="primary" size="sm" loading={sampling} loadingLabel="Fetching" onClick={onSample}>Try a sample piece</Button>
            <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setExample(true)}>See an example</button>
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>New here? Try the sample to reach your first result in one tap.</p>
        </>
      )}
    </div>
  );
}
