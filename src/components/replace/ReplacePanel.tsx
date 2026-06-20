"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SmartImage } from "@/components/SmartImage";
import { Uploader, type UploadedItem } from "@/components/Uploader";
import { Button } from "@/components/ui/Button";
import { RequestControl } from "@/components/ui/RequestControl";
import { useToast } from "@/components/ui/Toast";
import { parseJsonSafe } from "@/lib/http";
import type { ProductAnalysis } from "@/lib/director/schema";
import { MAX_PRODUCTS, type Category, type ShotSpec } from "@/lib/shot/spec";

export interface ReplaceShot { id: string; result_ref: string | null }

export function ReplacePanel({ shots }: { shots: ReplaceShot[] }) {
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const presetShot = params.get("shot");

  const [srcMode, setSrcMode] = useState<"upload" | "shot">(presetShot ? "shot" : "upload");
  const [srcUpload, setSrcUpload] = useState<UploadedItem | null>(null);
  const [srcShotPath, setSrcShotPath] = useState<string | null>(null);
  const [products, setProducts] = useState<UploadedItem[]>([]);
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (presetShot) {
      const s = shots.find((x) => x.id === presetShot);
      if (s?.result_ref) { setSrcMode("shot"); setSrcShotPath(s.result_ref); }
    }
  }, [presetShot, shots]);

  async function analyze(path: string) {
    const res = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path }) });
    const parsed = await parseJsonSafe<{ analysis: ProductAnalysis | null }>(res);
    if (parsed.ok && parsed.data?.analysis) setAnalysis(parsed.data.analysis);
  }

  const spec = useMemo<ShotSpec | null>(() => {
    const sourcePath = srcMode === "upload" ? srcUpload?.path : srcShotPath;
    if (!sourcePath || products.length === 0) return null;
    return {
      category: (analysis?.product_category as Category) ?? "apparel",
      subType: analysis?.garment_subtype ?? "dress",
      shotType: "on-model-full",
      referenceImagePaths: products.map((p) => p.path),
      replace: { sourceImagePath: sourcePath },
      quality: "hero",
    } as ShotSpec;
  }, [srcMode, srcUpload, srcShotPath, products, analysis]);

  useEffect(() => {
    if (!spec) { setCredits(null); return; }
    let cancelled = false;
    fetch("/api/estimate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })
      .then((r) => r.json()).then((j) => !cancelled && setCredits(j?.credits ?? null)).catch(() => {});
    return () => { cancelled = true; };
  }, [spec]);

  async function swap() {
    if (!spec) return;
    setBusy(true);
    try {
      const res = await fetch("/api/shots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) });
      const parsed = await parseJsonSafe<{ jobId: string }>(res);
      if (res.status === 402) { toast("Not enough credits for this swap.", "error"); return; }
      if (!parsed.ok || !parsed.data?.jobId) { toast(parsed.error ?? "The swap could not start.", "error"); return; }
      router.push(`/app/shots/${parsed.data.jobId}`);
    } finally { setBusy(false); }
  }

  const sourceUrl = srcMode === "upload" ? srcUpload?.url : null;

  return (
    <div style={{ display: "grid", gap: 24, maxWidth: 1000, margin: "0 auto" }}>
      <header>
        <p className="panel-eyebrow">Swap</p>
        <h1 className="display" style={{ fontSize: "var(--step-3)" }}>Replace</h1>
        <p className="muted" style={{ maxWidth: "58ch", marginTop: 6 }}>Drop your product into an existing image, keeping its pose, scene and light. Your product is preserved with a fidelity check; the result can be animated to video in one tap.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }} className="hero-grid">
        {/* Source */}
        <section style={{ display: "grid", gap: 12 }}>
          <div className="seg" style={{ width: "fit-content" }}>
            <button data-on={srcMode === "upload"} onClick={() => setSrcMode("upload")}>Upload an image</button>
            <button data-on={srcMode === "shot"} onClick={() => setSrcMode("shot")}>From a shot</button>
          </div>
          {srcMode === "upload" ? (
            sourceUrl ? (
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sourceUrl} alt="source" style={{ width: 150, height: 188, objectFit: "cover", borderRadius: 12, border: "1px solid var(--border-subtle)" }} />
                <Button variant="ghost" size="sm" onClick={() => setSrcUpload(null)}>Replace</Button>
              </div>
            ) : (
              <Uploader label="Upload the scene to keep" onUploaded={setSrcUpload} />
            )
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 10, maxHeight: 360, overflowY: "auto" }}>
              {shots.map((s) => s.result_ref && (
                <button key={s.id} className="tilecard" onClick={() => setSrcShotPath(s.result_ref)} style={{ padding: 0, cursor: "pointer", border: srcShotPath === s.result_ref ? "1px solid var(--accent-default)" : "1px solid var(--border-subtle)" }}>
                  <div style={{ aspectRatio: "3 / 4" }}><SmartImage path={s.result_ref} alt="shot" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /></div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Products to swap in */}
        <section style={{ display: "grid", gap: 12 }}>
          <span className="label">Product to drop in</span>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {products.map((p) => (
              <div key={p.path} style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="product" style={{ width: 78, height: 98, objectFit: "cover", borderRadius: 9, border: "1px solid var(--border-subtle)" }} />
                <button className="chip" style={{ position: "absolute", top: 3, right: 3, fontSize: 10, padding: "1px 7px", cursor: "pointer" }} onClick={() => setProducts((a) => a.filter((x) => x.path !== p.path))}>×</button>
              </div>
            ))}
            {products.length < MAX_PRODUCTS && (
              <div style={{ width: 120 }}>
                <Uploader label="+ Add product" onUploaded={(item) => { setProducts((a) => [...a, item]); if (products.length === 0) analyze(item.path); }} />
              </div>
            )}
          </div>
          {analysis && <span className="muted" style={{ fontSize: 12 }}>We see {[analysis.primary_color_name, analysis.garment_subtype].filter(Boolean).join(", ")}. It stays exact.</span>}
          <RequestControl context="replace" />
        </section>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", position: "sticky", bottom: 16 }}>
        <Button variant="primary" size="lg" disabled={!spec} loading={busy} loadingLabel="Swapping" onClick={swap}>
          {credits ? `Swap, ${credits} credits` : "Swap the product in"}
        </Button>
        <span className="muted" style={{ fontSize: 12 }}>A fidelity check runs before delivery.</span>
      </div>
    </div>
  );
}
