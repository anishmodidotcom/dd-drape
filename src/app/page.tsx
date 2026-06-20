import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { BeforeAfter } from "@/components/BeforeAfter";
import { Wordmark } from "@/components/ui/Wordmark";
import { Reveal } from "@/components/ui/Reveal";

export const metadata = {
  title: "Oviya Studio. Your product. Your model. Your shoot.",
  description: "Every product, a work of art. Turn your product into a high-fashion editorial shoot.",
};

// All landing imagery is the fresh Gemini brand set (public/). The live product engine stays on fal.
const GALLERY = [
  { src: "/gallery/saree.png", label: "Kanjivaram, heritage light" },
  { src: "/gallery/lehenga.png", label: "Bridal couture" },
  { src: "/gallery/jewellery.png", label: "Fine jewellery" },
  { src: "/gallery/western.png", label: "Tailored editorial" },
  { src: "/gallery/street.png", label: "Indo-western street" },
  { src: "/gallery/accessory.png", label: "Accessories campaign" },
];

const LOOKS = [
  { src: "/looks/high-gloss.png", label: "High gloss" },
  { src: "/looks/noir.png", label: "Noir" },
  { src: "/looks/heritage.png", label: "Heritage" },
  { src: "/looks/catalog.png", label: "Catalog" },
  { src: "/looks/campaign.png", label: "Campaign" },
  { src: "/looks/couture.png", label: "Couture" },
  { src: "/looks/street.png", label: "Street" },
  { src: "/looks/gala.png", label: "Gala" },
];

const PAIRS = [
  { before: "/before-after/1-before.png", after: "/before-after/1-after.png", label: "Chikankari kurta" },
  { before: "/before-after/2-before.png", after: "/before-after/2-after.png", label: "Bridal lehenga" },
  { before: "/before-after/3-before.png", after: "/before-after/3-after.png", label: "Cotton shirt" },
];

const STEPS = [
  { n: "01", t: "Upload your product", d: "A flat-lay, ghost mannequin, or hanger shot of your real piece. It becomes the anchor." },
  { n: "02", t: "Direct your shoot", d: "Cast a model, pick an editorial, set the location, posing, and light. Or just describe it." },
  { n: "03", t: "Shoot the look", d: "A premium editorial that keeps every thread, stone, and colour of the real product." },
];

const FAQ = [
  { q: "Will it keep my exact print and colour?", a: "Yes. Oviya is reference-locked: your uploaded product is the anchor for every shoot, and a fidelity check catches any drift before delivery. We enhance and place your piece, we never reinvent it." },
  { q: "Can I use the images commercially?", a: "The shoots you create are yours to use for your catalogue, ads, and social. You are responsible for the rights to the product photos you upload." },
  { q: "Are these created with AI?", a: "Yes, and we are transparent about it. Every output carries provenance metadata and an optional visible label, in line with content disclosure norms." },
  { q: "How good is the quality?", a: "Editorial-grade and natural: no plastic skin, no melting hands. Hero quality uses a premium engine for maximum fidelity." },
];

export default async function Home() {
  const user = await getUser();
  const cta = user ? { href: "/app/new", label: "Enter the studio" } : { href: "/signup", label: "Try Oviya free" };

  return (
    <main style={{ minHeight: "100vh", position: "relative", zIndex: 2 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px clamp(20px, 5vw, 56px)", maxWidth: 1240, margin: "0 auto" }}>
        <Wordmark size="md" />
        <nav style={{ display: "flex", gap: 12 }}>
          {user ? (
            <Link href="/app/new" className="btn btn-primary" style={{ padding: "9px 16px" }}>Enter the studio</Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost-dark" style={{ padding: "9px 16px" }}>Sign in</Link>
              <Link href="/signup" className="btn btn-primary" style={{ padding: "9px 16px" }}>Try Oviya free</Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero: editorial split */}
      <section style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 48, alignItems: "center", padding: "clamp(24px, 5vw, 64px) clamp(20px, 5vw, 56px)", maxWidth: 1240, margin: "0 auto" }} className="hero-grid">
        <Reveal>
          <p className="eyebrow accent" style={{ marginBottom: 18 }}>Every product, a work of art</p>
          <h1 style={{ fontSize: "clamp(42px, 7vw, 76px)", lineHeight: 1.02, letterSpacing: "-0.01em" }}>
            Your product.<br />Your model.<br />Your{" "}
            <span className="serif-italic" style={{ background: "var(--gradient-brand)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>shoot.</span>
          </h1>
          <p style={{ fontSize: 20, color: "var(--text-soft)", marginTop: 24, maxWidth: "44ch" }}>
            Oviya turns the product you already sell into a high-fashion editorial. Upload your real piece, direct the shoot, and keep every detail of the actual product.
          </p>
          <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href={cta.href} className="btn btn-primary" style={{ fontSize: 16, padding: "15px 28px" }}>{cta.label}</Link>
            {!user && <Link href="/login" className="btn btn-ghost-dark" style={{ fontSize: 16, padding: "15px 28px" }}>Sign in</Link>}
          </div>
          {!user && <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>Start with 400 free credits. No payment needed.</p>}
        </Reveal>
        <Reveal delay={0.1}>
          <div style={{ position: "relative", borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--line)", boxShadow: "var(--shadow-3)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/hero-1.png" alt="Oviya editorial" loading="eager" style={{ width: "100%", display: "block", aspectRatio: "4/5", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 55%, rgba(11,11,15,0.55))" }} />
          </div>
        </Reveal>
      </section>

      {/* Before / after: the persuasive centerpiece */}
      <section style={{ padding: "clamp(32px, 5vw, 64px) clamp(20px, 5vw, 56px)", maxWidth: 1240, margin: "0 auto" }}>
        <Reveal>
          <p className="eyebrow accent" style={{ marginBottom: 10 }}>Will it keep my exact product?</p>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", marginBottom: 8 }}>Drag to reveal</h2>
          <p className="muted" style={{ maxWidth: "52ch", marginBottom: 28 }}>
            The same flat-lay you would put on a marketplace, placed on a model with the colour, weave, and embroidery intact. Drag each slider.
          </p>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          {PAIRS.map((p, i) => (
            <Reveal key={p.label} delay={i * 0.08}>
              <BeforeAfter before={p.before} after={p.after} alt={p.label} />
              <p className="muted" style={{ fontSize: 13, marginTop: 10, textAlign: "center" }}>{p.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Full-bleed campaign banner */}
      <section style={{ position: "relative", margin: "clamp(24px, 4vw, 48px) 0" }}>
        <div style={{ position: "relative", maxWidth: 1400, margin: "0 auto", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/hero-2.png" alt="Oviya campaign" loading="lazy" style={{ width: "100%", display: "block", aspectRatio: "16/9", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(11,11,15,0.7) 0%, transparent 60%)", display: "grid", alignItems: "center", padding: "clamp(24px, 6vw, 72px)" }}>
            <Reveal>
              <h2 className="display" style={{ fontSize: "clamp(26px, 4vw, 48px)", maxWidth: "16ch" }}>One model, your whole catalogue.</h2>
              <p style={{ color: "var(--text-soft)", marginTop: 12, maxWidth: "40ch" }}>Cast a face once and reshoot every product on the same model, on set after set.</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Lookbook */}
      <section style={{ padding: "clamp(24px, 4vw, 56px) clamp(20px, 5vw, 56px)", maxWidth: 1240, margin: "0 auto" }}>
        <Reveal><h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", marginBottom: 22 }}>The lookbook</h2></Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
          {GALLERY.map((g, i) => (
            <Reveal key={g.src} delay={i * 0.05}>
              <div style={{ position: "relative", borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid var(--line)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.src} alt={g.label} loading="lazy" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }} />
                <span className="chip glass" style={{ position: "absolute", bottom: 10, left: 10, fontSize: 11, color: "#fff", borderColor: "transparent" }}>{g.label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Editorials strip */}
      <section style={{ padding: "clamp(16px, 3vw, 32px) clamp(20px, 5vw, 56px)", maxWidth: 1240, margin: "0 auto" }}>
        <Reveal>
          <p className="eyebrow accent" style={{ marginBottom: 10 }}>Editorials</p>
          <h2 style={{ fontSize: "clamp(24px, 3.5vw, 36px)", marginBottom: 20 }}>Eight signature looks, or describe your own</h2>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          {LOOKS.map((l, i) => (
            <Reveal key={l.src} delay={i * 0.04}>
              <div style={{ position: "relative", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--line)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.src} alt={l.label} loading="lazy" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }} />
                <span style={{ position: "absolute", bottom: 8, left: 8, fontSize: 12, fontFamily: "var(--font-display)", color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>{l.label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ borderTop: "1px solid var(--line-soft)", marginTop: 40, padding: "clamp(40px, 5vw, 64px) clamp(20px, 5vw, 56px)", display: "grid", gap: 28, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", maxWidth: 1240, margin: "40px auto 0" }}>
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.08}>
            <div className="display accent" style={{ fontSize: 15, letterSpacing: "0.16em", marginBottom: 12 }}>{s.n}</div>
            <h3 style={{ fontSize: 23, marginBottom: 8 }}>{s.t}</h3>
            <p className="muted" style={{ margin: 0 }}>{s.d}</p>
          </Reveal>
        ))}
      </section>

      {/* Credibility */}
      <section style={{ borderTop: "1px solid var(--line-soft)", padding: "clamp(48px, 6vw, 80px) clamp(20px, 5vw, 56px)", maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <Reveal>
          <p className="serif-italic" style={{ fontSize: "clamp(22px, 3vw, 32px)", lineHeight: 1.35, color: "var(--porcelain)" }}>
            The intelligence behind Oviya is built with veterans from the fashion and photography industry.
          </p>
          <p className="muted" style={{ marginTop: 16 }}>A studio team, in software. Editorial taste, reference-locked fidelity.</p>
        </Reveal>
      </section>

      {/* Credits */}
      <section style={{ borderTop: "1px solid var(--line-soft)", padding: "clamp(40px, 5vw, 64px) clamp(20px, 5vw, 56px)", maxWidth: 1240, margin: "0 auto" }}>
        <Reveal>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", marginBottom: 8 }}>Simple credits</h2>
          <p className="muted" style={{ maxWidth: "54ch", marginBottom: 22 }}>
            One credit is one cent of generation. Standard shoots cost a few credits, hero shoots a little more. Every signup starts with 400 free credits, enough to shoot real looks before you spend anything.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href={cta.href} className="btn btn-primary" style={{ padding: "13px 24px" }}>{cta.label}</Link>
            <span className="chip">400 free credits on signup</span>
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section style={{ borderTop: "1px solid var(--line-soft)", padding: "clamp(40px, 5vw, 64px) clamp(20px, 5vw, 56px)", maxWidth: 820, margin: "0 auto" }}>
        <Reveal><h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", marginBottom: 20 }}>Questions</h2></Reveal>
        <div style={{ display: "grid", gap: 14 }}>
          {FAQ.map((f) => (
            <details key={f.q} className="card">
              <summary style={{ cursor: "pointer", fontWeight: 600, fontFamily: "var(--font-display)", fontSize: 18 }}>{f.q}</summary>
              <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer style={{ borderTop: "1px solid var(--line-soft)", padding: "32px clamp(20px, 5vw, 56px)", color: "var(--fog)", fontSize: 13, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, maxWidth: 1240, margin: "0 auto" }}>
        <span>Oviya Studio. Every product, a work of art.</span>
        <span style={{ display: "flex", gap: 16 }}>
          <Link href="/terms" className="muted">Terms</Link>
          <Link href="/privacy" className="muted">Privacy</Link>
          <span>Images are created with AI and carry content provenance.</span>
        </span>
      </footer>
    </main>
  );
}
