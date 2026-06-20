// Client-side image downscale (item 9 root-cause fix). Serverless request bodies are capped (~4.5 MB
// on the platform), and an oversized upload returns a plain-text 413 that broke JSON parsing. We
// downscale large images in the browser before upload so they fit comfortably, which also speeds
// uploads. Tiny images are returned untouched (no upscaling; item 10 keeps small images valid).

const MAX_EDGE = 2048; // long edge, plenty for generation references
const TARGET_BYTES = 3_600_000; // stay under the platform body limit with headroom

export async function maybeDownscale(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // Small enough already: leave it alone.
  if (file.size <= TARGET_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    // Re-encode at descending quality until under target (or give up and use the original).
    for (const q of [0.92, 0.85, 0.78, 0.7]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", q));
      if (blob && blob.size <= TARGET_BYTES) {
        const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
        return new File([blob], name, { type: "image/jpeg" });
      }
      if (blob && q === 0.7) {
        const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
        return new File([blob], name, { type: "image/jpeg" });
      }
    }
    return file;
  } catch {
    return file; // any failure: fall back to the original, the server still validates it
  }
}
