"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CustomSelect, type Option } from "./ui/CustomSelect";
import { useToast } from "./ui/Toast";
import { MODEL_CREATE_CREDITS, type ModelInputs } from "@/lib/models/schema";

// Guided dropdowns (same paradigm as the shot Advanced panel) with a "type your own" option,
// rather than 12 bare free-text fields. MN10.
const FIELDS: { key: keyof ModelInputs; label: string; options: string[]; creatable?: boolean }[] = [
  { key: "gender", label: "Gender", options: ["women", "men", "unisex"] },
  { key: "ethnicity", label: "Ethnicity / region", options: ["South Asian", "South Indian", "North East Indian", "White", "Black", "East Asian", "Latina", "Mixed"], creatable: true },
  { key: "ageRange", label: "Age", options: ["20s", "30s", "40s+"] },
  { key: "bodyType", label: "Body type", options: ["slim", "mid-size", "plus-curvy", "petite", "athletic"], creatable: true },
  { key: "heightImpression", label: "Height", options: ["petite", "average", "tall"] },
  { key: "skinTone", label: "Skin tone", options: ["fair", "wheatish", "medium", "deep"], creatable: true },
  { key: "expression", label: "Expression", options: ["soft smile", "neutral", "confident", "candid"], creatable: true },
  { key: "hairColor", label: "Hair colour", options: ["black", "dark brown", "brown", "auburn"], creatable: true },
  { key: "hairLength", label: "Hair length", options: ["short", "shoulder", "long"] },
  { key: "hairstyle", label: "Hairstyle", options: ["open waves", "sleek bun", "braided", "high pony"], creatable: true },
  { key: "eyeColor", label: "Eye colour", options: ["dark brown", "brown", "hazel", "green"] },
  { key: "vibe", label: "Vibe", options: ["editorial", "approachable", "regal", "streetwear"], creatable: true },
];

const toOpts = (v: string[]): Option[] => v.map((o) => ({ value: o, label: o }));

export function CreateModelPanel() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [inputs, setInputs] = useState<ModelInputs>({});
  const [busy, setBusy] = useState(false);

  function set<K extends keyof ModelInputs>(k: K, v: string | undefined) {
    setInputs((s) => ({ ...s, [k]: v }));
  }

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/models", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, inputs }) });
      if (res.status === 402) {
        toast("Not enough credits to create a model.", "error");
        setBusy(false);
        return;
      }
      if (!res.ok) throw new Error("Model creation failed");
      toast("Model created. It is ready to use in your shots.", "success");
      setOpen(false);
      setName("");
      setInputs({});
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Model creation failed", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        Create a model · {MODEL_CREATE_CREDITS} credits
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
            <CustomSelect value={inputs[f.key] as string | undefined} options={toOpts(f.options)} onChange={(v) => set(f.key, v)} creatable={f.creatable} placeholder="Default" />
          </div>
        ))}
      </div>
      <div>
        <label className="label">Describe your model (overrides any field)</label>
        <textarea className="input" rows={2} value={inputs.describe ?? ""} onChange={(e) => set("describe", e.target.value || undefined)} placeholder="e.g. warm, approachable, with light freckles across the nose" />
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-primary" disabled={busy} onClick={create}>
          {busy ? "Casting your model (about a minute)..." : `Generate model · ${MODEL_CREATE_CREDITS} credits`}
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
