import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getUser } from "@/lib/supabase/server";
import { Wordmark } from "@/components/ui/Wordmark";

export const metadata = { title: "Sign in. Oviya Studio." };

export default async function LoginPage() {
  if (await getUser()) redirect("/app/new"); // M2: logged-in users skip auth
  return (
    <>
      <Link href="/" style={{ display: "inline-block", marginBottom: 20 }}>
        <Wordmark size="sm" />
      </Link>
      <h1 style={{ fontSize: 36, color: "var(--porcelain)", marginBottom: 8 }}>Welcome back</h1>
      <p className="muted" style={{ marginBottom: 28 }}>
        Sign in to keep shooting your products.
      </p>
      <AuthForm mode="login" />
    </>
  );
}
