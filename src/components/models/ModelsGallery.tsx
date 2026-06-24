"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SmartImage } from "@/components/SmartImage";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Uploader, type UploadedItem } from "@/components/Uploader";
import { useToast } from "@/components/ui/Toast";
import { CreateModelPanel } from "@/components/CreateModelPanel";
import { parseJsonSafe } from "@/lib/http";
import { MODEL_ANGLES } from "@/lib/models/schema";

export interface ModelCard { id: string; name: string; image_paths: string[] }

export function ModelsGallery({ models }: { models: ModelCard[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState<ModelCard | null>(null);
  const [pending, setPending] = useState<UploadedItem[]>([]);
  const [uploadName, setUploadName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  async function saveUploaded() {
    if (!pending.length) return;
    setSaving(true);
    try {
      const res = await fetch("/api/models", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: uploadName || "My model", uploadedPaths: pending.map((x) => x.path) }) });
      const parsed = await parseJsonSafe(res);
      if (!parsed.ok) { toast(parsed.error ?? "Could not save the model", "error"); return; }
      toast("Saved to your models.", "success");
      setPending([]); setUploadName(""); setShowUpload(false);
      router.refresh();
    } finally { setSaving(false); }
  }

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p className="panel-eyebrow">Casting</p>
          <h1 className="display" style={{ fontSize: "var(--step-3)" }}>Your Models</h1>
          <p className="muted" style={{ maxWidth: "54ch", marginTop: 6 }}>Cast a model once and reuse the same face and body across your whole catalogue. Generate one, or upload your own.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={() => setShowUpload((s) => !s)}>Upload your own</Button>
        </div>
      </header>

      {/* Create / upload affordances */}
      <div style={{ display: "grid", gap: 16 }}>
        <CreateModelPanel />
        {showUpload && (
          <div className="card" style={{ display: "grid", gap: 12 }}>
            <div>
              <strong className="display" style={{ fontSize: 18 }}>Upload your own model</strong>
              <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>Add a face or full-body reference. Saved with no credits and reusable like any model.</p>
            </div>
            <input className="input" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Name this model" />
            {pending.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {pending.map((x) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={x.path} src={x.url} alt="reference" style={{ width: 64, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border-subtle)" }} />
                ))}
              </div>
            )}
            <Uploader label="Add a reference image" onUploaded={(item) => setPending((a) => [...a, item])} />
            <div><Button variant="primary" loading={saving} disabled={!pending.length} onClick={saveUploaded}>Save to my models</Button></div>
          </div>
        )}
      </div>

      {/* Library grid */}
      {models.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 44 }}>
          <p className="display" style={{ fontSize: 20 }}>No models yet</p>
          <p className="muted">Generate a model or upload your own to start casting.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 16 }}>
          {models.map((mdl) => (
            <button key={mdl.id} className="tilecard" onClick={() => setOpen(mdl)} style={{ padding: 0, cursor: "pointer", textAlign: "left", border: "1px solid var(--border-subtle)" }}>
              <div style={{ aspectRatio: "3 / 4", background: "var(--surface-sunken)" }}>
                {mdl.image_paths[0] && <SmartImage path={mdl.image_paths[0]} alt={mdl.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
              </div>
              <div style={{ padding: 12 }}>
                <div className="display" style={{ fontWeight: 600 }}>{mdl.name}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{mdl.image_paths.length} angle{mdl.image_paths.length > 1 ? "s" : ""}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail: ALL angles (fixes the open / 2-photo bug) */}
      <Modal open={!!open} onClose={() => setOpen(null)} maxWidth={680}>
        {open && (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 className="display" style={{ fontSize: "var(--step-2)" }}>{open.name}</h3>
              <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{open.image_paths.length} angles</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
              {open.image_paths.map((path, i) => (
                <figure key={path} style={{ margin: 0 }}>
                  <div style={{ aspectRatio: "3 / 4", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-subtle)", background: "var(--surface-sunken)" }}>
                    <SmartImage path={path} alt={`angle ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </div>
                  <figcaption className="mono" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{MODEL_ANGLES[i]?.label ?? `Angle ${i + 1}`}</figcaption>
                </figure>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="primary" onClick={() => router.push("/app/new")}>Use in the studio</Button>
              <Button variant="ghost" onClick={() => setOpen(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
