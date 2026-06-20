// Auth screens: an editorial split. Cinematic brand image on the left (desktop), the form on the
// right. Near-black canvas, single gold accent, serif headline.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1fr 1fr", background: "var(--ink)" }} className="auth-split">
      <aside style={{ position: "relative", overflow: "hidden", borderRight: "1px solid var(--line-soft)" }} className="auth-aside">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/gallery/saree.png" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(11,11,15,0.35), rgba(11,11,15,0.85))" }} />
        <div style={{ position: "absolute", left: 40, bottom: 40, right: 40 }}>
          <p className="serif-italic" style={{ fontSize: 26, color: "var(--porcelain)", lineHeight: 1.3 }}>
            Every product, a work of art.
          </p>
          <p className="muted" style={{ marginTop: 8 }}>Your product. Your model. Your shoot.</p>
        </div>
      </aside>
      <div style={{ display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 400 }}>{children}</div>
      </div>
    </main>
  );
}
