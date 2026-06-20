"use client";
import { useState } from "react";
import { GalleryPicker, type PickOption } from "@/components/ui/GalleryPicker";
import { ThumbTile } from "@/components/ui/ThumbTile";
import { Slider } from "@/components/ui/Slider";
import { RequestControl } from "@/components/ui/RequestControl";
import { SmartImage } from "@/components/SmartImage";
import { Uploader, type UploadedItem } from "@/components/Uploader";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { parseJsonSafe } from "@/lib/http";
import { thumbUrl } from "@/lib/shot/thumbnails";
import { presetsForCategory } from "@/lib/shot/presets";
import { FORMATS } from "@/lib/shot/formats";
import {
  ETHNICITIES, SKIN_TONES, BODIES, AGE_RANGES, GENDERS, MAKEUP, HAIR, BACKGROUNDS, LIGHTING, FRAMINGS,
  VIBES, EXPRESSIONS, LENSES, CAMERA_ANGLES, DEPTH_OF_FIELD, GRADES, MAX_OUTPUTS,
  posesForCategory, type Category, type ShotSpec,
} from "@/lib/shot/spec";

export interface SavedModelOption { id: string; name: string; image_paths: string[] }

const LOOK_IMG: Record<string, string> = {
  "marketplace-clean": "/looks/catalog.png", "festive-editorial": "/looks/heritage.png",
  "quiet-luxury": "/looks/couture.png", "bridal-regal": "/looks/gala.png",
  "streetwear-fusion": "/looks/street.png", "demi-fine-everyday": "/looks/high-gloss.png",
};

const titleize = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const opts = (v: readonly string[]): PickOption[] => v.map((x) => ({ value: x, label: titleize(x) }));
const thumbed = (v: readonly string[], group: Parameters<typeof thumbUrl>[0]): PickOption[] =>
  v.map((x) => ({ value: x, label: titleize(x), thumb: thumbUrl(group, x) }));

export function Panel({ title, selected, children, defaultOpen = false, eyebrow }: { title: string; selected?: string; children: React.ReactNode; defaultOpen?: boolean; eyebrow?: string }) {
  return (
    <details className="panel" open={defaultOpen}>
      <summary>
        <span>{eyebrow && <span className="panel-eyebrow" style={{ display: "block", marginBottom: 2 }}>{eyebrow}</span>}{title}</span>
        <span className="panel-sel">{selected || ""}</span>
      </summary>
      <div className="panel-body">{children}</div>
    </details>
  );
}

export interface ControlsProps {
  mode: "basic" | "advanced";
  category: Category;
  adv: Partial<ShotSpec>;
  setAdv: React.Dispatch<React.SetStateAction<Partial<ShotSpec>>>;
  freeText: Record<string, string>;
  setFreeText: (k: string, v: string | undefined) => void;
  presetId: string | null;
  onPickLook: (id: string) => void;
  usingLook: boolean;
  onFineTune: () => void;
  savedModels: SavedModelOption[];
  modelId: string | null;
  setModelId: (id: string | null) => void;
  onModelsChanged: () => void;
  outputCount: number;
  setOutputCount: (n: number) => void;
  variateModel: boolean;
  setVariateModel: (b: boolean) => void;
  latitude: number;
  setLatitude: (n: number) => void;
}

export function Controls(p: ControlsProps) {
  const { adv, setAdv, category, mode } = p;
  const m = (patch: Partial<ShotSpec>) => setAdv((a) => ({ ...a, ...patch }));
  const setModel = (patch: Partial<NonNullable<ShotSpec["model"]>>) => setAdv((a) => ({ ...a, model: { ...a.model, ...patch } }));
  const poses = posesForCategory(category);
  const selectedModel = p.savedModels.find((s) => s.id === p.modelId);
  const advanced = mode === "advanced";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Looks / Editorials */}
      <Panel title="Editorials" eyebrow="Looks" selected={p.usingLook && p.presetId ? titleize(p.presetId) : undefined} defaultOpen>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {presetsForCategory(category).map((pr) => (
            <ThumbTile key={pr.id} label={pr.label} src={LOOK_IMG[pr.id] ?? null} selected={p.usingLook && p.presetId === pr.id} onClick={() => p.onPickLook(pr.id)} width={undefined} />
          ))}
        </div>
        {p.usingLook ? (
          <Button variant="ghost" size="sm" onClick={p.onFineTune}>Fine-tune this look</Button>
        ) : (
          <span className="chip" style={{ width: "fit-content" }}>Custom direction</span>
        )}
      </Panel>

      {/* Casting */}
      <Panel title="Casting" eyebrow="Model" selected={selectedModel?.name} defaultOpen={advanced}>
        <CastingControls {...p} setModel={setModel} />
      </Panel>

      {advanced && !selectedModel && (
        <>
          <Panel title="Posing & direction" selected={adv.pose && titleize(adv.pose)}>
            <GalleryPicker options={poses.map((x) => ({ value: x, label: titleize(x), thumb: thumbUrl("poses", x) }))} value={adv.pose} onChange={(v) => m({ pose: v as ShotSpec["pose"] })} />
          </Panel>
          <Panel title="Makeup" selected={adv.makeup && titleize(adv.makeup)}>
            <GalleryPicker options={thumbed(MAKEUP, "makeup")} value={adv.makeup} onChange={(v) => m({ makeup: v as ShotSpec["makeup"] })} />
          </Panel>
          <Panel title="Hair" selected={adv.hair && titleize(adv.hair)}>
            <GalleryPicker options={thumbed(HAIR, "hair")} value={adv.hair} onChange={(v) => m({ hair: v as ShotSpec["hair"] })} />
          </Panel>
        </>
      )}

      {advanced && (
        <>
          <Panel title="Location & set" eyebrow="Where" selected={adv.background && titleize(adv.background)}>
            <GalleryPicker options={thumbed(BACKGROUNDS, "sets")} value={adv.background} onChange={(v) => m({ background: v as ShotSpec["background"] })} customPlaceholder="Describe your location" />
          </Panel>
          <Panel title="Light" selected={adv.lighting && titleize(adv.lighting)}>
            <GalleryPicker options={thumbed(LIGHTING, "lighting")} value={adv.lighting} onChange={(v) => m({ lighting: v as ShotSpec["lighting"] })} />
          </Panel>
          <Panel title="Camera & lens" selected={p.freeText.lens && titleize(p.freeText.lens)}>
            <span className="muted" style={{ fontSize: 11 }}>Focal feel</span>
            <GalleryPicker options={opts(LENSES)} value={p.freeText.lens} onChange={(v) => p.setFreeText("lens", v)} />
            <span className="muted" style={{ fontSize: 11 }}>Angle</span>
            <GalleryPicker options={opts(CAMERA_ANGLES)} value={p.freeText.angle} onChange={(v) => p.setFreeText("angle", v)} />
            <span className="muted" style={{ fontSize: 11 }}>Depth of field</span>
            <GalleryPicker options={opts(DEPTH_OF_FIELD)} value={p.freeText.depthOfField} onChange={(v) => p.setFreeText("depthOfField", v)} allowCustom={false} />
          </Panel>
          <Panel title="Framing & crop" selected={adv.framing && titleize(adv.framing)}>
            <GalleryPicker options={opts(FRAMINGS)} value={adv.framing} onChange={(v) => m({ framing: v as ShotSpec["framing"] })} allowCustom={false} tileWidth={84} />
          </Panel>
          <Panel title="Mood & colour grade" selected={(adv.vibe && titleize(adv.vibe)) || (p.freeText.grade && titleize(p.freeText.grade))}>
            <span className="muted" style={{ fontSize: 11 }}>Mood</span>
            <GalleryPicker options={opts(VIBES)} value={adv.vibe} onChange={(v) => m({ vibe: v as ShotSpec["vibe"] })} />
            <span className="muted" style={{ fontSize: 11 }}>Grade</span>
            <GalleryPicker options={opts(GRADES)} value={p.freeText.grade} onChange={(v) => p.setFreeText("grade", v)} />
          </Panel>
          <Panel title="Export size & format" eyebrow="Output" selected={adv.format && (FORMATS.find((f) => f.id === adv.format)?.label)}>
            <GalleryPicker options={FORMATS.map((f) => ({ value: f.id, label: f.label }))} value={adv.format} onChange={(v) => m({ format: v })} allowCustom={false} tileWidth={92} />
          </Panel>
          <Panel title="Fidelity latitude" selected={`${p.latitude}% strict`}>
            <Slider value={p.latitude} min={0} max={100} onChange={p.setLatitude} leftLabel="Creative latitude" rightLabel="Preserve product" label={undefined} />
            <span className="muted" style={{ fontSize: 11 }}>Higher keeps your product exact; lower lets the director interpret more freely. Your product stays pinned for comparison in the before and after.</span>
          </Panel>
        </>
      )}

      {/* Output count + variate (both modes, curated) */}
      <Panel title="Outputs" eyebrow="The shoot" selected={`${p.outputCount} frame${p.outputCount > 1 ? "s" : ""}`} defaultOpen={advanced}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Array.from({ length: MAX_OUTPUTS }, (_, i) => i + 1).map((n) => (
            <ThumbTile key={n} label={`${n}`} src={null} selected={p.outputCount === n} onClick={() => p.setOutputCount(n)} width={56} />
          ))}
        </div>
        {p.outputCount > 1 && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={p.variateModel} onChange={(e) => p.setVariateModel(e.target.checked)} disabled={!!selectedModel} />
            Vary the model across the set {selectedModel ? "(off while a saved model is cast)" : ""}
          </label>
        )}
        <span className="muted" style={{ fontSize: 11 }}>More than one frame directs a coherent shoot: the camera, pose and crop vary across the set.</span>
      </Panel>

      <RequestControl context={`studio-${mode}`} label="Can't find the control you want?" />
    </div>
  );
}

function CastingControls(p: ControlsProps & { setModel: (patch: Partial<NonNullable<ShotSpec["model"]>>) => void }) {
  const { adv, mode } = p;
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<UploadedItem[]>([]);
  const selectedModel = p.savedModels.find((s) => s.id === p.modelId);

  async function saveUploaded() {
    if (!pending.length) return;
    setUploading(true);
    try {
      const res = await fetch("/api/models", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "My model", uploadedPaths: pending.map((x) => x.path) }) });
      const parsed = await parseJsonSafe<{ modelId: string }>(res);
      if (!parsed.ok) { toast(parsed.error ?? "Could not save the model", "error"); return; }
      toast("Saved to your models.", "success");
      setPending([]);
      p.onModelsChanged();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Saved models library */}
      <div>
        <span className="muted" style={{ fontSize: 11 }}>Your models</span>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
          <ThumbTile label="Open casting" src={null} selected={p.modelId === null} onClick={() => p.setModelId(null)} width={84} />
          {p.savedModels.map((s) => (
            <ThumbTile key={s.id} label={s.name} media={s.image_paths[0] ? <SmartImage path={s.image_paths[0]} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : undefined} selected={p.modelId === s.id} onClick={() => p.setModelId(s.id)} width={84} />
          ))}
        </div>
        {selectedModel && <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>{selectedModel.name} is cast. Set, posing and light still apply.</p>}
      </div>

      {/* Upload your own model */}
      <details className="panel" style={{ background: "var(--surface-raised)" }}>
        <summary style={{ fontSize: 13 }}>Upload your own model<span className="panel-sel">no credits</span></summary>
        <div className="panel-body">
          {pending.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {pending.map((x) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={x.path} src={x.url} alt="model reference" style={{ width: 56, height: 70, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border-subtle)" }} />
              ))}
            </div>
          )}
          <Uploader label="Add a face or full-body reference" onUploaded={(item) => setPending((a) => [...a, item])} />
          {pending.length > 0 && <Button variant="primary" size="sm" loading={uploading} onClick={saveUploaded}>Save to my models</Button>}
        </div>
      </details>

      {/* Generate-a-cast attributes (when no saved model is chosen) */}
      {!selectedModel && (mode === "advanced" || true) && (
        <div style={{ display: "grid", gap: 10 }}>
          <span className="muted" style={{ fontSize: 11 }}>Or describe the cast</span>
          <GalleryPicker options={opts(ETHNICITIES)} value={adv.model?.ethnicity} onChange={(v) => p.setModel({ ethnicity: v as NonNullable<ShotSpec["model"]>["ethnicity"] })} customPlaceholder="Describe the look" />
          {mode === "advanced" && (
            <>
              <span className="muted" style={{ fontSize: 11 }}>Skin tone</span>
              <GalleryPicker options={opts(SKIN_TONES)} value={adv.model?.skinTone} onChange={(v) => p.setModel({ skinTone: v as NonNullable<ShotSpec["model"]>["skinTone"] })} allowCustom={false} tileWidth={78} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><span className="muted" style={{ fontSize: 11 }}>Body</span><GalleryPicker options={opts(BODIES)} value={adv.model?.body} onChange={(v) => p.setModel({ body: v as NonNullable<ShotSpec["model"]>["body"] })} allowCustom={false} tileWidth={76} /></div>
                <div><span className="muted" style={{ fontSize: 11 }}>Age</span><GalleryPicker options={opts(AGE_RANGES)} value={typeof adv.model?.ageRange === "string" ? adv.model?.ageRange : undefined} onChange={(v) => p.setModel({ ageRange: v })} allowCustom={false} tileWidth={64} /></div>
              </div>
              <span className="muted" style={{ fontSize: 11 }}>Who</span>
              <GalleryPicker options={opts(GENDERS)} value={adv.model?.gender} onChange={(v) => p.setModel({ gender: v as NonNullable<ShotSpec["model"]>["gender"] })} allowCustom={false} tileWidth={72} />
              <span className="muted" style={{ fontSize: 11 }}>Expression</span>
              <GalleryPicker options={opts(EXPRESSIONS)} value={p.freeText.expression} onChange={(v) => p.setFreeText("expression", v)} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
