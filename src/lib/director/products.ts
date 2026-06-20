import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import { directorEnabled } from "./client";
import { analyzeProduct } from "./analyze";
import type { ProductAnalysis } from "./schema";
import type { Json } from "@/lib/supabase/types";

// Product analysis cache. Analyze a product image once and store it on drape_products so
// re-generations of the same item skip re-analysis.

// Item 8: persist an uploaded product to the user's collection for reuse. Idempotent per
// (user, image_path); marks the existing analysis row "saved" (and names it) or inserts one.
export async function saveProductToCollection(
  userId: string,
  imagePath: string,
  name?: string
): Promise<void> {
  const admin = getAdminClient();
  await admin.from("drape_products").upsert(
    {
      user_id: userId,
      image_path: imagePath,
      saved: true,
      ...(name ? { name: name.slice(0, 120) } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,image_path" }
  );
}

export interface SavedProduct {
  image_path: string;
  name: string | null;
  analysis: ProductAnalysis | null;
  updated_at: string;
}

/** List the user's saved products for reuse as inputs. */
export async function listSavedProducts(userId: string): Promise<SavedProduct[]> {
  const admin = getAdminClient();
  const { data } = await admin
    .from("drape_products")
    .select("image_path, name, analysis, updated_at")
    .eq("user_id", userId)
    .eq("saved", true)
    .order("updated_at", { ascending: false });
  return (data as unknown as SavedProduct[]) ?? [];
}

export async function getOrAnalyzeProduct(
  userId: string,
  imagePath: string,
  imageUrl: string
): Promise<ProductAnalysis | null> {
  const admin = getAdminClient();

  // 1. Cached?
  const { data: existing } = await admin
    .from("drape_products")
    .select("analysis")
    .eq("user_id", userId)
    .eq("image_path", imagePath)
    .maybeSingle();
  if (existing?.analysis) return existing.analysis as unknown as ProductAnalysis;

  // Ensure a product row exists (analysis null) even if we cannot analyze now.
  await admin
    .from("drape_products")
    .upsert({ user_id: userId, image_path: imagePath }, { onConflict: "user_id,image_path" });

  if (!directorEnabled()) return null;

  // 2. Analyze + cache.
  try {
    const analysis = await analyzeProduct(imageUrl);
    await admin
      .from("drape_products")
      .update({ analysis: analysis as unknown as Json, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("image_path", imagePath);
    return analysis;
  } catch {
    return null;
  }
}
