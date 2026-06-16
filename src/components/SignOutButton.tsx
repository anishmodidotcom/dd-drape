"use client";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    await getBrowserClient().auth.signOut();
    router.push("/");
    router.refresh();
  }
  return (
    <button onClick={signOut} className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 14 }}>
      Sign out
    </button>
  );
}
