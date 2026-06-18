import "server-only";
import { getServerClient } from "@/lib/supabase/server";
import type { ModelRow } from "./schema";

// RLS-scoped reads for the Models studio (server components see only the user's own models).
export async function listModels(): Promise<ModelRow[]> {
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("drape_models")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as unknown as ModelRow[]) ?? [];
}
