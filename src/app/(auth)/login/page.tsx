import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Sign in. Drape." };

export default function LoginPage() {
  return (
    <>
      <Link href="/" className="eyebrow" style={{ display: "block", marginBottom: 20 }}>
        Drape
      </Link>
      <h1 style={{ fontSize: 36, color: "var(--porcelain)", marginBottom: 8 }}>Welcome back</h1>
      <p className="muted" style={{ marginBottom: 28 }}>
        Sign in to keep shooting your products.
      </p>
      <AuthForm mode="login" />
    </>
  );
}
