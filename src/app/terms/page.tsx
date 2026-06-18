import Link from "next/link";

export const metadata = { title: "Terms. Drape." };

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px clamp(20px, 5vw, 56px) 80px" }}>
      <Link href="/" className="eyebrow" style={{ display: "block", marginBottom: 20 }}>Drape</Link>
      <h1 style={{ fontSize: 36, marginBottom: 16 }}>Terms of use</h1>
      <p className="muted">
        Drape generates fashion imagery from product photos you upload. You confirm you hold the
        rights to the images you upload, and you own the shots you generate for your commercial use.
        Outputs are AI generated and carry content provenance. This is an early product; the service
        is provided as is while we are in beta. Full terms will be published before paid plans launch.
      </p>
      <p className="muted" style={{ marginTop: 24 }}>
        <Link href="/" style={{ color: "var(--saffron)" }}>Back to home</Link>
      </p>
    </main>
  );
}
