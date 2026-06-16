import Link from "next/link";

// Minimal landing (kept light for v1). The full marketing site (before/after hero, showcase,
// pricing, FAQ) comes later. Confident, fashion-editorial, no em dashes.

export const metadata = {
  title: "Drape. Your product. Your model. Your shot.",
  description: "Premium fashion photography, generated.",
};

const STEPS = [
  { n: "01", t: "Upload", d: "Add a photo of your real apparel or jewellery." },
  { n: "02", t: "Choose your shot", d: "Pick a preset or set the model, pose, setting, and light." },
  { n: "03", t: "Generate", d: "Get a premium shot that keeps every detail of the real product." },
];

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px clamp(20px, 5vw, 56px)",
        }}
      >
        <span className="eyebrow" style={{ color: "var(--porcelain)" }}>
          Drape
        </span>
        <nav style={{ display: "flex", gap: 12 }}>
          <Link href="/login" className="btn btn-ghost-dark" style={{ padding: "9px 16px" }}>
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-primary" style={{ padding: "9px 16px" }}>
            Try Drape free
          </Link>
        </nav>
      </header>

      <section
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "clamp(32px, 8vw, 96px) clamp(20px, 5vw, 56px)",
          maxWidth: 1100,
        }}
      >
        <h1 style={{ fontSize: "clamp(44px, 8vw, 72px)", lineHeight: 1.02, maxWidth: "16ch" }}>
          Your product. Your model. Your{" "}
          <span
            style={{
              background: "var(--gradient-brand)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            shot.
          </span>
        </h1>
        <p style={{ fontSize: 20, color: "var(--fog)", marginTop: 22, maxWidth: "48ch" }}>
          Premium fashion photography, generated. Upload your real apparel or jewellery, choose the
          exact shot you want, and keep every detail of the actual product.
        </p>
        <div style={{ marginTop: 36, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/signup" className="btn btn-primary" style={{ fontSize: 16, padding: "14px 26px" }}>
            Try Drape free
          </Link>
          <Link href="/login" className="btn btn-ghost-dark" style={{ fontSize: 16, padding: "14px 26px" }}>
            Sign in
          </Link>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
          Start with 400 free credits. No payment needed.
        </p>
      </section>

      <section
        style={{
          borderTop: "1px solid var(--ink-soft)",
          padding: "48px clamp(20px, 5vw, 56px)",
          display: "grid",
          gap: 28,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          maxWidth: 1100,
        }}
      >
        {STEPS.map((s) => (
          <div key={s.n}>
            <div className="eyebrow" style={{ color: "var(--saffron)", marginBottom: 10 }}>
              {s.n}
            </div>
            <h3 style={{ fontSize: 22, color: "var(--porcelain)", marginBottom: 6 }}>{s.t}</h3>
            <p className="muted" style={{ margin: 0 }}>
              {s.d}
            </p>
          </div>
        ))}
      </section>

      <footer style={{ padding: "24px clamp(20px, 5vw, 56px)", color: "var(--fog)", fontSize: 13 }}>
        Drape. Premium fashion photography, generated.
      </footer>
    </main>
  );
}
