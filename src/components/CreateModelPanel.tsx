"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MODEL_CREATE_CREDITS, type ModelInputs } from "@/lib/models/schema";

const FIELDS: { key: keyof ModelInputs; label: string; options?: string[] }[] = [
  { key: "gender", label: "Gender", options: ["women", "men", "unisex"] },
  { key: "ethnicity", label: "Ethnicity / region", options: ["South Asian", "South Indian", "North East Indian", "White", "Black", "East Asian", "Latina", "Mixed"] },
  { key: "ageRange", label: "Age", options: ["20s", "30s", "40s+"] },
  { key: "bodyType", label: "Body type", options: ["slim", "mid-size", "plus-curvy", "petite", "athletic"] },
  { key: "heightImpression", label: "Height", options: ["petite", "average", "tall"] },
  { key: "skinTone", label: "Skin tone", options: ["fair", "wheatish", "medium", "deep"] },
  { key: "expression", label: "Expression", options: ["soft smile", "neutral", "confident", "candid"] },
  { key: "hairColor", label: "Hair colour", options: ["black", "dark brown", "brown", "auburn"] },
  { key: "hairLength", label: "Hair length", options: ["short", "shoulder", "long"] },
  { key: "hairstyle", label: "Hairstyle", options: ["open waves", "sleek bun", "braided", "high pony"] },
  { key: "eyeColor", label: "Eye colour", options: ["dark brown", "brown", "hazel", "green"] },
  { key: "vibe", label: "Vibe", options: ["editorial", "approachable", "regal", "streetwear"] },
];

export function CreateModelPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [inputs, setInputs] = useState<ModelInputs>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ModelInputs>(k: K, v: string) {
    setInputs((s) => ({ ...s, [k]: v || undefined }));
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, inputs }),
      });
      if (res.status === 402) {
        setError("Not enough credits to create a model.");
        setBusy(false);
        return;
      }
      if (!res.ok) throw new Error("Model creation failed");
      setOpen(false);
      setName("");
      setInputs({});
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Model creation failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        Create a model
      </button>
    );
  }

  return (
    <div className="card" style={{ display: "grid", gap: 16 }}>
      <div>
        <label className="label">Model name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aanya, house model" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label">{f.label}</label>
            <input
              className="input"
              list={`opt-${f.key}`}
              value={(inputs[f.key] as string) ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder="Default or type your own"
            />
            <datalist id={`opt-${f.key}`}>
              {f.options?.map((o) => <option key={o} value={o} />)}
            </datalist>
          </div>
        ))}
      </div>
      <div>
        <label className="label">Describe your model (overrides any field)</label>
        <textarea
          className="input"
          rows={2}
          value={inputs.describe ?? ""}
          onChange={(e) => set("describe", e.target.value)}
          placeholder="e.g. warm, approachable, light freckles across the nose"
        />
      </div>
      {error && <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="btn btn-primary" disabled={busy} onClick={create}>
          {busy ? "Casting your model (about a minute)..." : `Generate model (${MODEL_CREATE_CREDITS} credits)`}
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        We generate four consistent reference shots (front, three-quarter, side, portrait). Identity
        from references is strong but not pixel-perfect across every shot.
      </p>
    </div>
  );
}
