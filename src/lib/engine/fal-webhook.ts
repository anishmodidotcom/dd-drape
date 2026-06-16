import "server-only";
import { webcrypto } from "node:crypto";

// fal webhook signature verification.
//
// IMPORTANT (CGE lesson, rule 8): webhook auth has TWO layers.
//   1. The route is whitelisted in middleware so this machine-to-machine POST is not bounced
//      as "no login cookie = 401". (See middleware.ts.)
//   2. The payload signature is verified here.
//
// fal signs deliveries with ED25519. The signed message is:
//     request-id + "\n" + user-id + "\n" + timestamp + "\n" + sha256_hex(body)
// over headers x-fal-webhook-{request-id,user-id,timestamp,signature}, verified against the
// rotating public keys at https://rest.alpha.fal.ai/.well-known/jwks.json.
//
// DO NOT trust this assumed scheme blindly: capture a REAL delivery and confirm header names,
// message construction, and encoding match before relying on it in production. Until verified
// against a real delivery, a shared-secret header (FAL_WEBHOOK_SECRET) gates the route too.

const JWKS_URL = "https://rest.alpha.fal.ai/.well-known/jwks.json";
const MAX_SKEW_SECONDS = 60 * 5;

let jwksCache: { keys: { x: string }[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 10 * 60 * 1000;

async function getPublicKeys(): Promise<Uint8Array[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys.map((k) => base64UrlToBytes(k.x));
  }
  const res = await fetch(JWKS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch fal JWKS: ${res.status}`);
  const json = (await res.json()) as { keys: { x: string }[] };
  jwksCache = { keys: json.keys, fetchedAt: Date.now() };
  return json.keys.map((k) => base64UrlToBytes(k.x));
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(b64url.length / 4) * 4,
    "="
  );
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

export interface VerifyInput {
  headers: Headers;
  rawBody: string;
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  requestId?: string;
}

/** Layer 2a: optional shared-secret gate, active until ED25519 is confirmed on real deliveries. */
export function checkSharedSecret(headers: Headers): boolean {
  const expected = process.env.FAL_WEBHOOK_SECRET;
  if (!expected) return true; // not configured => skip this layer
  const got = headers.get("x-fal-webhook-secret") ?? headers.get("authorization");
  return got === expected || got === `Bearer ${expected}`;
}

/** Layer 2b: ED25519 signature verification against fal's rotating JWKS. */
export async function verifyFalSignature(input: VerifyInput): Promise<VerifyResult> {
  const { headers, rawBody } = input;
  const requestId = headers.get("x-fal-webhook-request-id") ?? undefined;
  const userId = headers.get("x-fal-webhook-user-id");
  const timestamp = headers.get("x-fal-webhook-timestamp");
  const signature = headers.get("x-fal-webhook-signature");

  if (!requestId || !userId || !timestamp || !signature) {
    return { ok: false, reason: "missing fal webhook headers", requestId };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > MAX_SKEW_SECONDS) {
    return { ok: false, reason: "timestamp out of range", requestId };
  }

  // Construct the signed message.
  const bodyHash = await webcrypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(rawBody)
  );
  const bodyHashHex = Buffer.from(bodyHash).toString("hex");
  const message = new TextEncoder().encode(
    `${requestId}\n${userId}\n${timestamp}\n${bodyHashHex}`
  );

  const sigBytes = hexToBytes(signature);
  const keys = await getPublicKeys();

  for (const rawKey of keys) {
    try {
      const key = await webcrypto.subtle.importKey(
        "raw",
        rawKey,
        { name: "Ed25519" },
        false,
        ["verify"]
      );
      const valid = await webcrypto.subtle.verify("Ed25519", key, sigBytes, message);
      if (valid) return { ok: true, requestId };
    } catch {
      // try next key
    }
  }
  return { ok: false, reason: "no matching signature", requestId };
}
