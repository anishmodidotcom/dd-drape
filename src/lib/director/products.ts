import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import { directorEnabled } from "./client";
import { analyzeProduct } from "./analyze";
import type { ProductAnalysis } from "./schema";
import type { Json } from "@/lib/supabase/types";

// Product analysis cache. Analyze a product image once and store it on drape_products so
// re-generations of the same item skip re-analysis.

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
