import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { BeforeAfter } from "@/components/BeforeAfter";

export const metadata = {
  title: "Drape. Your product. Your model. Your shot.",
  description: "Premium fashion photography, generated.",
};

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const preset = (p: string) => `${SB}/storage/v1/object/public/drape-presets/${p}`;

const STEPS = [
  { n: "01", t: "Upload your product", d: "Add a photo of your real apparel or jewellery." },
  { n: "02", t: "Direct your shoot", d: "Pick a look or set the model, pose, setting, and light." },
  { n: "03", t: "Get photos and video", d: "A premium shot that keeps every detail of the real product." },
];

const GALLERY = [
  "presets/festive-editorial.png",
  "presets/bridal-regal.png",
  "presets/quiet-luxury.png",
  "presets/streetwear-fusion.png",
  "presets/marketplace-clean.png",
  "presets/demi-fine-everyday.png",
];

const FAQ = [
  { q: "Will it keep my exact print and colour?", a: "Yes. Drape is reference-locked: your uploaded product is the anchor for every shot, and a fidelity check catches any drift before delivery. We enhance and place your piece, we never reinvent it." },
  { q: "Can I use the images commercially?", a: "The shots you generate are yours to use for your catalog, ads, and social. You are responsible for the rights to the product photos you upload." },
  { q: "Are these AI generated?", a: "Yes, and we are transparent about it. Every output carries provenance metadata and an optional visible label, in line with AI-content disclosure norms." },
  { q: "How good is the quality?", a: "Output is editorial-grade and natural, no plastic skin or melting hands. Hero quality uses a premium model for maximum fidelity." },
];

export default async function Home() {
  const user = await getUser();
  const cta = user
    ? { href: "/app/new", label: "Go to studio" }
    : { href: "/signup", label: "Try Drape free" };

  return (
    <main style={{ minHeight: "100vh" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px clamp(20px, 5vw, 56px)", maxWidth: 1200, margin: "0 auto" }}>
        <span className="eyebrow" style={{ color: "var(--porcelain)" }}>Drape</span>
        <nav style={{ display: "flex", gap: 12 }}>
          {user ? (
            <Link href="/app/new" className="btn btn-primary" style={{ padding: "9px 16px" }}>Go to studio</Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost-dark" style={{ padding: "9px 16px" }}>Sign in</Link>
              <Link href="/signup" className="btn btn-primary" style={{ padding: "9px 16px" }}>Try Drape free</Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 40, alignItems: "center", padding: "clamp(24px, 6vw, 72px) clamp(20px, 5vw, 56px)", maxWidth: 1200, margin: "0 auto" }} className="hero-grid">
        <div>
          <h1 style={{ fontSize: "clamp(40px, 7vw, 68px)", lineHeight: 1.03, maxWidth: "16ch" }}>
            Your product. Your model. Your{" "}
            <span style={{ background: "var(--gradient-brand)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>shot.</span>
          </h1>
          <p style={{ fontSize: 20, color: "var(--fog)", marginTop: 22, maxWidth: "46ch" }}>
            Premium fashion photography, generated. Upload your real apparel or jewellery, direct the exact shot, and keep every detail of the actual product.
          </p>
          <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href={cta.href} className="btn btn-primary" style={{ fontSize: 16, padding: "14px 26px" }}>{cta.label}</Link>
            {!user && <Link href="/login" className="btn btn-ghost-dark" style={{ fontSize: 16, padding: "14px 26px" }}>Sign in</Link>}
          </div>
          {!user && <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>Start with 400 free credits. No payment needed.</p>}
        </div>
        {SB && (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preset("presets/festive-editorial.png")} alt="Drape sample output" loading="eager" style={{ width: "100%", borderRadius: 16, border: "1px solid var(--line)", display: "block" }} />
          </div>
        )}
      </section>

      {/* Before / after proof */}
      {SB && (
        <section style={{ padding: "16px clamp(20px, 5vw, 56px) 56px", maxWidth: 1200, margin: "0 auto" }}>
          <p className="eyebrow" style={{ color: "var(--saffron)", marginBottom: 10 }}>Will it keep my exact product?</p>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 36px)", marginBottom: 18 }}>Drag to reveal</h2>
          <div style={{ maxWidth: 460 }}>
            <BeforeAfter before={preset("base/model.png")} after={preset("presets/festive-editorial.png")} alt="Drape direction" />
          </div>
        </section>
      )}

      {/* Output gallery */}
      {SB && (
        <section style={{ padding: "24px clamp(20px, 5vw, 56px) 56px", maxWidth: 1200, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 36px)", marginBottom: 18 }}>Real Drape output</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {GALLERY.map((g) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={g} src={preset(g)} alt="Drape output" loading="lazy" style={{ width: "100%", aspectRatio: "4/5", objectFit: "cover", borderRadius: 12, border: "1px solid var(--line)", display: "block" }} />
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      <section style={{ borderTop: "1px solid var(--line-soft)", padding: "48px clamp(20px, 5vw, 56px)", display: "grid", gap: 28, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", maxWidth: 1200, margin: "0 auto" }}>
        {STEPS.map((s) => (
          <div key={s.n}>
            <div className="eyebrow" style={{ color: "var(--saffron)", marginBottom: 10 }}>{s.n}</div>
            <h3 style={{ fontSize: 22, marginBottom: 6 }}>{s.t}</h3>
            <p className="muted" style={{ margin: 0 }}>{s.d}</p>
          </div>
        ))}
      </section>

      {/* Pricing explainer */}
      <section style={{ borderTop: "1px solid var(--line-soft)", padding: "48px clamp(20px, 5vw, 56px)", maxWidth: 1200, margin: "0 auto" }}>
        <h2 style={{ fontSize: "clamp(26px, 4vw, 36px)", marginBottom: 8 }}>Simple credits</h2>
        <p className="muted" style={{ maxWidth: "52ch", marginBottom: 20 }}>
          One credit is one cent of generation. Standard shots cost a few credits, hero shots a little more. Every signup starts with 400 free credits, enough to try real shots before you spend anything.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href={cta.href} className="btn btn-primary" style={{ padding: "12px 22px" }}>{cta.label}</Link>
          <span className="chip">400 free credits on signup</span>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ borderTop: "1px solid var(--line-soft)", padding: "48px clamp(20px, 5vw, 56px)", maxWidth: 800, margin: "0 auto" }}>
        <h2 style={{ fontSize: "clamp(26px, 4vw, 36px)", marginBottom: 20 }}>Questions</h2>
        <div style={{ display: "grid", gap: 14 }}>
          {FAQ.map((f) => (
            <details key={f.q} className="card">
              <summary style={{ cursor: "pointer", fontWeight: 600, fontFamily: "var(--font-display)", fontSize: 18 }}>{f.q}</summary>
              <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer style={{ borderTop: "1px solid var(--line-soft)", padding: "28px clamp(20px, 5vw, 56px)", color: "var(--fog)", fontSize: 13, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, maxWidth: 1200, margin: "0 auto" }}>
        <span>Drape. Premium fashion photography, generated.</span>
        <span>Images are AI generated and carry content provenance.</span>
      </footer>
    </main>
  );
}
