"use client";
import { useEffect, useState } from "react";
import tokens from "@/app/_tokens.json";
import { Wordmark, Monogram } from "@/components/ui/Wordmark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Slider } from "@/components/ui/Slider";
import { Modal } from "@/components/ui/Modal";
import { Sheet } from "@/components/ui/Sheet";
import { AtelierLoader } from "@/components/ui/AtelierLoader";
import { RequestControl } from "@/components/ui/RequestControl";
import { AliveBackground } from "@/components/ui/AliveBackground";
import { ThumbTile } from "@/components/ui/ThumbTile";
import { GalleryPicker } from "@/components/ui/GalleryPicker";
import { Reveal } from "@/components/ui/Reveal";
import { useToast } from "@/components/ui/Toast";

const SEMANTIC_KEYS = [
  "--surface-base", "--surface-raised", "--surface-overlay", "--surface-sunken",
  "--text-primary", "--text-secondary", "--text-muted", "--border-subtle", "--border-strong",
  "--accent-default", "--accent-hover", "--accent-contrast", "--indigo", "--gold", "--sand",
];
const TYPE_STEPS: [string, string, string][] = [
  ["--step-6", "Atelier", "display 6"],
  ["--step-5", "Oviya", "display 5"],
  ["--step-4", "Every product, a work of art", "display 4"],
  ["--step-3", "Your product. Your model.", "display 3"],
  ["--step-2", "Styling the shoot", "display 2"],
  ["--step-1", "The intelligence behind Oviya", "heading 1"],
];

type Manifest = Record<string, { path: string; model: string; style: string }>;

export default function DesignPage() {
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [slider, setSlider] = useState(40);
  const [pick, setPick] = useState<string | undefined>("noir");
  const [manifest, setManifest] = useState<Manifest>({});

  useEffect(() => {
    // v4 set (mixed-model, tagged) + the v3 Gemini set surfaced as the Gemini side of the comparison
    // (the v3 manifest maps id -> path string).
    Promise.all([
      fetch("/v4/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
      fetch("/brand/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]).then(([v4, v3]: [Manifest, Record<string, string>]) => {
      const merged: Manifest = { ...v4 };
      for (const [id, path] of Object.entries(v3)) {
        merged[`v3-${id}`] = { path, model: "gemini-pro", style: "v3 editorial (Gemini)" };
      }
      setManifest(merged);
    });
  }, []);

  const assets = Object.entries(manifest);
  const byModel = (m: string) => assets.filter(([, v]) => v.model === m);

  return (
    <main style={{ minHeight: "100vh", background: "var(--surface-base)", color: "var(--text-primary)" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px clamp(20px,5vw,56px)", borderBottom: "1px solid var(--border-subtle)", background: "color-mix(in oklab, var(--surface-base) 86%, transparent)", backdropFilter: "blur(10px)" }}>
        <Wordmark />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span className="mono" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)" }}>Brand bible</span>
          <ThemeToggle />
        </div>
      </header>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "clamp(28px,5vw,64px) clamp(20px,5vw,56px) 120px", display: "grid", gap: 72 }}>
        {/* Intro */}
        <Reveal>
          <Eyebrow>The Oviya design system</Eyebrow>
          <h1 className="display" style={{ fontSize: "var(--step-5)", margin: "10px 0 0" }}>The Atelier in the Void</h1>
          <p style={{ fontSize: "var(--step-1)", color: "var(--text-secondary)", maxWidth: "44ch", marginTop: 18, lineHeight: 1.4 }}>
            One token structure, two equally first-class worlds. A contemporary art house that happens to make fashion imagery.
          </p>
          <p className="serif-italic" style={{ color: "var(--text-muted)", marginTop: 16, fontSize: 17 }}>
            Hand us the garment. We&apos;ll handle the drama.
          </p>
        </Reveal>

        {/* Accent decision */}
        <Section eyebrow="The accent" title="Oxblood, rationed">
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ width: 120, height: 120, borderRadius: "var(--radius)", background: "var(--accent-default)", boxShadow: "var(--shadow-2)" }} />
            <p style={{ maxWidth: "52ch", color: "var(--text-secondary)" }}>
              One confident accent, rationed to the single primary action per screen. Oxblood reads as both Western luxury and India-rooted richness without cliche, holds full chroma on cream, and shifts lighter on near-black. Indigo, antique gold (hairline only), and sandstone are support intelligence.
            </p>
          </div>
        </Section>

        {/* Color, both themes side by side */}
        <Section eyebrow="Color" title="Two worlds, one system">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
            <ThemePane mode="light" />
            <ThemePane mode="dark" />
          </div>
          <h3 className="mono" style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", margin: "28px 0 12px" }}>Primitive ramps (OKLCH)</h3>
          <Ramps />
        </Section>

        {/* Type */}
        <Section eyebrow="Typography" title="Two voices, plus mono">
          <div style={{ display: "grid", gap: 6 }}>
            {TYPE_STEPS.map(([v, sample, note]) => (
              <div key={v} style={{ display: "flex", alignItems: "baseline", gap: 16, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 8 }}>
                <span className="display" style={{ fontSize: `var(${v})`, lineHeight: 1.05, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sample}</span>
                <span className="mono" style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{note} / {v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 18, marginTop: 24 }}>
            <VoiceCard family="var(--font-display)" name="Bodoni Moda" role="Editorial display serif" sample="A work of art" />
            <VoiceCard family="var(--font-ui)" name="Hanken Grotesk" role="Premium grotesk, UI + body" sample="Your product, your model, your shoot." />
            <VoiceCard family="var(--font-mono)" name="DM Mono" role="Atelier process + metadata" sample="reading the garment" />
          </div>
        </Section>

        {/* Primitives */}
        <Section eyebrow="Primitives" title="Every control, both worlds">
          <Group label="Buttons">
            <Button variant="primary">Shoot</Button>
            <Button variant="secondary">Casting</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="primary" loading>Shoot</Button>
            <Button variant="primary" disabled>Shoot</Button>
            <Button variant="primary" size="sm">Small</Button>
            <Button variant="primary" size="lg">Large</Button>
          </Group>
          <Group label="Slider (semantic ends)">
            <div style={{ width: 280 }}>
              <Slider value={slider} onChange={setSlider} leftLabel="Soft" rightLabel="Hard" label="Light intensity" />
            </div>
          </Group>
          <Group label="Gallery control (no native dropdowns)">
            <div style={{ width: 360 }}>
              <GalleryPicker
                options={[{ value: "noir", label: "Noir" }, { value: "heritage", label: "Heritage" }, { value: "red-carpet", label: "Red Carpet" }]}
                value={pick}
                onChange={setPick}
              />
            </div>
          </Group>
          <Group label="ThumbTile">
            <ThumbTile label="Quiet Luxury" src={null} selected onClick={() => {}} width={120} />
            <ThumbTile label="Loading thumb" src="/v4/looks/look-noir.png" selected={false} onClick={() => {}} width={120} />
          </Group>
          <Group label="Overlays + voice">
            <Button variant="secondary" onClick={() => setModal(true)}>Open modal</Button>
            <Button variant="secondary" onClick={() => setSheet(true)}>Open sheet</Button>
            <Button variant="ghost" onClick={() => toast("Your editorial is ready for its close-up.", "success")}>Fire a toast</Button>
          </Group>
          <Group label="The escape hatch">
            <div style={{ maxWidth: 420 }}>
              <RequestControl context="design-showcase" onSubmit={() => toast("Captured. Thank you.", "info")} />
            </div>
          </Group>
        </Section>

        {/* Motion */}
        <Section eyebrow="Motion" title="Restraint, then bloom">
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
            <Reveal><div style={{ width: 120, height: 120, borderRadius: "var(--radius)", background: "var(--surface-raised)", border: "1px solid var(--border-subtle)", display: "grid", placeItems: "center", color: "var(--text-muted)", fontSize: 12 }} className="mono">reveal</div></Reveal>
            <ul className="mono" style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 2, listStyle: "none", padding: 0, margin: 0 }}>
              <li>spring: stiffness 350 / damping 18</li>
              <li>hover scale ≤ 1.03 / tap 0.98</li>
              <li>entrance ~400ms / ease (0.16, 1, 0.3, 1)</li>
              <li>transform + opacity only / honors reduced-motion</li>
            </ul>
          </div>
        </Section>

        {/* Atelier loader */}
        <Section eyebrow="The atelier" title="A studio at work">
          <div style={{ maxWidth: 460 }}>
            <AtelierLoader />
          </div>
        </Section>

        {/* Alive background scaffold */}
        <Section eyebrow="Surface" title="The alive background (scaffold)">
          <div style={{ position: "relative", height: 220, borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
            <AliveBackground />
            <div style={{ position: "relative", display: "grid", placeItems: "center", height: "100%" }}>
              <Monogram size={56} />
            </div>
          </div>
        </Section>

        {/* Asset gallery + model comparison */}
        <Section eyebrow="Assets" title={`The v4 set${assets.length ? ` (${assets.length})` : ""}`}>
          {assets.length === 0 ? (
            <p className="muted mono" style={{ fontSize: 13 }}>Generating, or no manifest yet. Run scripts/generate-assets-v4.ts.</p>
          ) : (
            <>
              <div className="mono" style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
                Gemini Nano Banana Pro: {byModel("gemini-pro").length} · Gemini Flash: {byModel("gemini-flash").length} · fal Flux: {byModel("fal-flux").length}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                {assets.map(([id, a]) => (
                  <figure key={id} style={{ margin: 0 }}>
                    <div style={{ position: "relative", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border-subtle)", aspectRatio: "3/4", background: "var(--surface-raised)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.path} alt={a.style} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      <span className="mono" style={{ position: "absolute", top: 6, left: 6, fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "color-mix(in oklab, var(--surface-sunken) 70%, transparent)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{a.model}</span>
                    </div>
                    <figcaption className="mono" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 5 }}>{a.style}</figcaption>
                  </figure>
                ))}
              </div>
            </>
          )}
        </Section>
      </div>

      <Modal open={modal} onClose={() => setModal(false)}>
        <h3 className="display" style={{ fontSize: "var(--step-2)", marginBottom: 8 }}>A quiet overlay</h3>
        <p className="muted" style={{ marginBottom: 18 }}>Glass only on overlays. Hairline border, restrained.</p>
        <Button variant="primary" onClick={() => setModal(false)}>Close</Button>
      </Modal>
      <Sheet open={sheet} onClose={() => setSheet(false)}>
        <h3 className="display" style={{ fontSize: "var(--step-2)", marginBottom: 8 }}>The drawer</h3>
        <p className="muted">Slides from the edge with a spring. Used for casting boards and control panels later.</p>
      </Sheet>
    </main>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mono" style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--accent-default)", margin: 0 }}>{children}</p>;
}
function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <Reveal>
      <section style={{ display: "grid", gap: 20 }}>
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="display" style={{ fontSize: "var(--step-3)", margin: "6px 0 0" }}>{title}</h2>
        </div>
        {children}
      </section>
    </Reveal>
  );
}
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>{children}</div>
    </div>
  );
}
function VoiceCard({ family, name, role, sample }: { family: string; name: string; role: string; sample: string }) {
  return (
    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius)", padding: 18, background: "var(--surface-raised)" }}>
      <p style={{ fontFamily: family, fontSize: 28, margin: 0, color: "var(--text-primary)" }}>{sample}</p>
      <p className="mono" style={{ fontSize: 11, color: "var(--text-muted)", margin: "10px 0 0" }}>{name} · {role}</p>
    </div>
  );
}
function ThemePane({ mode }: { mode: "light" | "dark" }) {
  const map = (tokens as { light: Record<string, string>; dark: Record<string, string> })[mode];
  return (
    <div className={mode} style={{ background: "var(--surface-base)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: 20 }}>
      <p className="mono" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--text-muted)", marginTop: 0 }}>{mode} world</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(78px,1fr))", gap: 8 }}>
        {SEMANTIC_KEYS.map((k) => (
          <div key={k} title={`${k} ${map[k] ?? ""}`} style={{ display: "grid", gap: 4 }}>
            <div style={{ height: 44, borderRadius: 8, background: `var(${k})`, border: "1px solid var(--border-subtle)" }} />
            <span className="mono" style={{ fontSize: 8.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.replace("--", "")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function Ramps() {
  const prims = (tokens as { primitives: Record<string, { hex: string }> }).primitives;
  const groups: Record<string, string[]> = { neutral: [], accent: [], support: [] };
  for (const name of Object.keys(prims)) {
    if (name.startsWith("n")) groups.neutral.push(name);
    else if (name.startsWith("a")) groups.accent.push(name);
    else groups.support.push(name);
  }
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {Object.entries(groups).map(([g, names]) => (
        <div key={g}>
          <span className="mono" style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>{g}</span>
          <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
            {names.map((n) => (
              <div key={n} title={`${n} ${prims[n].hex}`} style={{ width: 38, height: 38, borderRadius: 6, background: prims[n].hex, border: "1px solid var(--border-subtle)" }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
