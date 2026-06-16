import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";

// Outputs from fal come back as hosted URLs. We download them and store in a PRIVATE
// Supabase Storage bucket, then serve to the owner via short-lived signed URLs.

export const OUTPUT_BUCKET = "outputs";

/** Download a hosted output URL and store it under the user's namespace. Returns the path. */
export async function storeOutputFromUrl(
  userId: string,
  jobId: string,
  url: string,
  ext = "png"
): Promise<string> {
  const admin = getAdminClient();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download fal output: ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const bytes = new Uint8Array(await res.arrayBuffer());

  const path = `${userId}/${jobId}.${ext}`;
  const { error } = await admin.storage
    .from(OUTPUT_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`storeOutput failed: ${error.message}`);
  return path;
}

/** Short-lived signed URL for a stored output. */
export async function signedOutputUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin.storage
    .from(OUTPUT_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw new Error(`signedOutputUrl failed: ${error.message}`);
  return data.signedUrl;
}
