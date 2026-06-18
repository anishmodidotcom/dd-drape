// Server-side upload validation (Phase B). Sniffs the real MIME from magic bytes (never trusts
// the client-declared type), enforces a minimum resolution, and strips EXIF from JPEGs (privacy:
// GPS/camera metadata). Pure JS, no native deps, so it is fully unit-testable.

export type SniffedMime = "image/png" | "image/jpeg" | "image/webp" | null;

export const MIN_SHORT_EDGE = 1024;

export function sniffMime(bytes: Uint8Array): SniffedMime {
  if (bytes.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  // WEBP: 'RIFF' .... 'WEBP'
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

function be16(b: Uint8Array, i: number) { return (b[i] << 8) | b[i + 1]; }
function be32(b: Uint8Array, i: number) { return (b[i] * 0x1000000) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]; }

// Returns {width,height} for PNG/JPEG; null if unreadable (we don't block on unknown dimensions).
export function readDimensions(bytes: Uint8Array, mime: SniffedMime): { width: number; height: number } | null {
  if (mime === "image/png") {
    // IHDR width@16, height@20 (big-endian uint32).
    if (bytes.length < 24) return null;
    return { width: be32(bytes, 16), height: be32(bytes, 20) };
  }
  if (mime === "image/jpeg") {
    let i = 2;
    const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      if (SOF.has(marker)) {
        // segment: FF Cx <len:2> <precision:1> <height:2> <width:2>
        return { height: be16(bytes, i + 5), width: be16(bytes, i + 7) };
      }
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const len = be16(bytes, i + 2);
      if (len < 2) return null;
      i += 2 + len;
    }
    return null;
  }
  return null; // webp dimension parse not required for the floor check
}

// Remove APP1 (EXIF / XMP) segments from a JPEG. Other segments (APP0/JFIF, quantization, scan)
// are preserved, so the image renders identically without the metadata.
export function stripJpegExif(bytes: Uint8Array): Uint8Array {
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8)) return bytes;
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) { out.push(bytes[i]); i++; continue; }
    const marker = bytes[i + 1];
    // Start of scan: copy the rest verbatim (entropy-coded data follows).
    if (marker === 0xda) { for (let j = i; j < bytes.length; j++) out.push(bytes[j]); break; }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(0xff, marker); i += 2; continue;
    }
    const len = be16(bytes, i + 2);
    if (len < 2 || i + 2 + len > bytes.length) { for (let j = i; j < bytes.length; j++) out.push(bytes[j]); break; }
    if (marker === 0xe1) { i += 2 + len; continue; } // drop APP1 (EXIF/XMP)
    for (let j = i; j < i + 2 + len; j++) out.push(bytes[j]);
    i += 2 + len;
  }
  return new Uint8Array(out);
}

export interface ValidationResult {
  ok: boolean;
  reason?: string;
  mime?: Exclude<SniffedMime, null>;
  ext?: "png" | "jpg" | "webp";
  width?: number;
  height?: number;
  cleaned?: Uint8Array;
}

const EXT: Record<Exclude<SniffedMime, null>, "png" | "jpg" | "webp"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// Validate + clean an upload. Rejects non-image content and too-small images; strips EXIF.
export function validateImageUpload(bytes: Uint8Array): ValidationResult {
  const mime = sniffMime(bytes);
  if (!mime) {
    return { ok: false, reason: "Unsupported file. Upload a JPG, PNG, or WEBP image." };
  }
  const dims = readDimensions(bytes, mime);
  if (dims && Math.min(dims.width, dims.height) < MIN_SHORT_EDGE) {
    return {
      ok: false,
      reason: `That image is a bit small (${dims.width}x${dims.height}). For a crisp result, upload at least ${MIN_SHORT_EDGE}px on the short edge.`,
    };
  }
  const cleaned = mime === "image/jpeg" ? stripJpegExif(bytes) : bytes;
  return { ok: true, mime, ext: EXT[mime], width: dims?.width, height: dims?.height, cleaned };
}
