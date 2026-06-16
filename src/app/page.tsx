// Phase 0 holding page. The full marketing site (before/after reveal, how-it-works, showcase,
// pricing, FAQ) is Phase 4. This page proves the brand system and the spine are alive.

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "clamp(24px, 6vw, 96px)",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <span
        style={{
          fontSize: 13,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--fog)",
          marginBottom: 28,
        }}
      >
        Drape
      </span>

      <h1 style={{ fontSize: "clamp(40px, 7vw, 56px)", maxWidth: 14 + "ch" }}>
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

      <p style={{ fontSize: 20, color: "var(--fog)", marginTop: 20, maxWidth: "46ch" }}>
        Premium fashion photography, generated. Upload your real apparel or jewellery, choose the
        exact shot, and keep every detail of the actual product.
      </p>

      <p
        style={{
          marginTop: 40,
          fontSize: 13,
          color: "var(--fog)",
          fontFamily: "var(--font-ui)",
        }}
      >
        Phase 0 is live. Engine spine: model router, prepaid credits ledger, async jobs, fal
        webhook, row-level security, auth.
      </p>
    </main>
  );
}
