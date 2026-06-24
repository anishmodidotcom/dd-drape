// Session media cache (item 11). Previously every SmartImage / BeforeAfter re-fetched a fresh signed
// URL from /api/media on every mount, and because the signed URL changed each time the browser could
// never reuse the downloaded bytes either, so models and prior shots reloaded from scratch on every
// open. This module caches the resolved signed URL per storage path until shortly before expiry and
// dedupes concurrent resolves, so reopening a gallery resolves nothing and the browser HTTP-caches
// the stable URL's bytes.

interface Entry {
  url: string;
  exp: number;
}

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<string>>();

// Signed URLs are minted for 1 hour; refresh a little before that.
const TTL_MS = 50 * 60 * 1000;

export async function resolveMedia(path: string): Promise<string> {
  const hit = cache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;

  const existing = inflight.get(path);
  if (existing) return existing;

  const p = (async () => {
    const res = await fetch(`/api/media?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error(`media ${res.status}`);
    const j = (await res.json()) as { url: string };
    cache.set(path, { url: j.url, exp: Date.now() + TTL_MS });
    return j.url;
  })();
  inflight.set(path, p);
  try {
    return await p;
  } finally {
    inflight.delete(path);
  }
}

/** Drop a cached URL (e.g. an <img> errored on an expired link) so the next resolve re-mints. */
export function invalidateMedia(path: string): void {
  cache.delete(path);
}
