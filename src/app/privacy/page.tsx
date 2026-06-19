import Link from "next/link";
import { Wordmark } from "@/components/ui/Wordmark";

export const metadata = { title: "Privacy. Oviya Studio." };

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px clamp(20px, 5vw, 56px) 80px" }}>
      <Link href="/" style={{ display: "inline-block", marginBottom: 20 }}><Wordmark size="sm" /></Link>
      <h1 style={{ fontSize: 36, marginBottom: 16 }}>Privacy</h1>
      <p className="muted">
        We store your account email, the product images you upload, and the shots you generate, so
        you can return to your work. Uploads are private and served over short-lived signed links.
        EXIF metadata is stripped from uploads. We do not sell your data. A full privacy policy will
        be published before paid plans launch.
      </p>
      <p className="muted" style={{ marginTop: 24 }}>
        <Link href="/" style={{ color: "var(--saffron)" }}>Back to home</Link>
      </p>
    </main>
  );
}
