import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getUser } from "@/lib/supabase/server";

export const metadata = { title: "Create account. Drape." };

export default async function SignupPage() {
  if (await getUser()) redirect("/app/new"); // M2: logged-in users skip auth
  return (
    <>
      <Link href="/" className="eyebrow" style={{ display: "block", marginBottom: 20 }}>
        Drape
      </Link>
      <h1 style={{ fontSize: 36, color: "var(--porcelain)", marginBottom: 8 }}>Try Drape free</h1>
      <p className="muted" style={{ marginBottom: 28 }}>
        Start with 400 free credits. Your product, your model, your shot.
      </p>
      <AuthForm mode="signup" />
    </>
  );
}
