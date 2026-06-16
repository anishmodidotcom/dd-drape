import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";

// Outputs from fal come back as hosted URLs. We download them and store in a PRIVATE
// Supabase Storage bucket, then serve to the owner via short-lived signed URLs.

export const OUTPUT_BUCKET = "drape-outputs";

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

  const path = `results/${userId}/${jobId}.${ext}`;
  const { error } = await admin.storage
    .from(OUTPUT_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`storeOutput failed: ${error.message}`);
  return path;
}

const ALLOWED_UPLOAD_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "video/mp4",
  "video/quicktime",
]);

/** Store a user upload (product photo or vibe reference) under uploads/. Returns the path. */
export async function storeUpload(
  userId: string,
  bytes: Uint8Array,
  contentType: string,
  ext: string
): Promise<string> {
  if (!ALLOWED_UPLOAD_TYPES.has(contentType)) {
    throw new Error(`Unsupported upload type: ${contentType}`);
  }
  const admin = getAdminClient();
  const id = crypto.randomUUID();
  const path = `uploads/${userId}/${id}.${ext}`;
  const { error } = await admin.storage
    .from(OUTPUT_BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`storeUpload failed: ${error.message}`);
  return path;
}

/** Short-lived signed URL for any stored object (result or upload). */
export async function signedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin.storage
    .from(OUTPUT_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw new Error(`signedUrl failed: ${error.message}`);
  return data.signedUrl;
}

/** A stored object path belongs to a user only if it sits under their namespace. */
export function pathBelongsToUser(path: string, userId: string): boolean {
  return path.startsWith(`uploads/${userId}/`) || path.startsWith(`results/${userId}/`);
}

/** Write the C2PA-style provenance sidecar next to an output. Returns the manifest path. */
export async function storeManifest(
  userId: string,
  jobId: string,
  manifest: unknown
): Promise<string> {
  const admin = getAdminClient();
  const path = `results/${userId}/${jobId}.c2pa.json`;
  const bytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  const { error } = await admin.storage
    .from(OUTPUT_BUCKET)
    .upload(path, bytes, { contentType: "application/json", upsert: true });
  if (error) throw new Error(`storeManifest failed: ${error.message}`);
  return path;
}
