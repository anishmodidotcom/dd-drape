import { describe, it, expect } from "vitest";
import { LedgerSim } from "@/lib/engine/ledger";
import {
  sniffMime,
  readDimensions,
  stripJpegExif,
  validateImageUpload,
  MIN_SHORT_EDGE,
} from "@/lib/engine/image-validate";

describe("ledger idempotency (Phase B: each reserve/settle/refund fires at most once per job)", () => {
  it("a double refund (webhook retry + reconciler race) does not double-credit", () => {
    const l = new LedgerSim();
    l.grant(100);
    l.reserve(15, "job1"); // -> 85
    l.refund(15, "job1"); // -> 100
    l.refund(15, "job1"); // idempotent no-op
    l.refund(15, "job1"); // idempotent no-op
    expect(l.balance).toBe(100);
    // only one refund row recorded
    expect(l.txns.filter((t) => t.kind === "refund" && t.jobId === "job1").length).toBe(1);
  });

  it("a double settle does not double-charge", () => {
    const l = new LedgerSim();
    l.grant(100);
    l.reserve(4, "j");
    l.settle(4, 4, "j");
    l.settle(4, 4, "j"); // idempotent
    expect(l.balance).toBe(96);
    expect(l.txns.filter((t) => t.kind === "settle").length).toBe(1);
  });

  it("a double reserve does not double-debit", () => {
    const l = new LedgerSim();
    l.grant(100);
    l.reserve(15, "j");
    l.reserve(15, "j"); // idempotent
    expect(l.balance).toBe(85);
  });
});

describe("upload validation (Phase B)", () => {
  function pngBytes(w: number, h: number): Uint8Array {
    const b = new Uint8Array(24);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    b.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8); // len + 'IHDR'
    b[16] = (w >>> 24) & 255; b[17] = (w >>> 16) & 255; b[18] = (w >>> 8) & 255; b[19] = w & 255;
    b[20] = (h >>> 24) & 255; b[21] = (h >>> 16) & 255; b[22] = (h >>> 8) & 255; b[23] = h & 255;
    return b;
  }

  it("sniffs the real MIME from magic bytes", () => {
    expect(sniffMime(pngBytes(2000, 2000))).toBe("image/png");
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("image/jpeg");
    const webp = new Uint8Array(16);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(sniffMime(webp)).toBe("image/webp");
    expect(sniffMime(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toBe(null);
  });

  it("reads PNG dimensions and warns (never blocks) below the resolution floor (item 10)", () => {
    expect(readDimensions(pngBytes(1500, 2000), "image/png")).toEqual({ width: 1500, height: 2000 });
    const small = validateImageUpload(pngBytes(800, 800));
    expect(small.ok).toBe(true); // accepted; the user decides
    expect(small.warning).toBeTruthy();
    void MIN_SHORT_EDGE;
    const big = validateImageUpload(pngBytes(1024, 1400));
    expect(big.ok).toBe(true);
    expect(big.warning).toBeUndefined();
  });

  it("rejects non-image content", () => {
    const r = validateImageUpload(new TextEncoder().encode("#!/bin/sh\nrm -rf /"));
    expect(r.ok).toBe(false);
  });

  it("strips the EXIF (APP1) segment from a JPEG, keeping the rest", () => {
    // FFD8 | APP1(FFE1) len=8 + 6 bytes 'EXIF..' | SOF0(FFC0) len=17 (precision+dims) | SOS(FFDA)..FFD9
    const app1 = [0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
    const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, 0x07, 0xd0, 0x05, 0xdc, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
    const sos = [0xff, 0xda, 0x00, 0x02, 0x12, 0x34, 0xff, 0xd9];
    const jpeg = new Uint8Array([0xff, 0xd8, ...app1, ...sof, ...sos]);
    const out = stripJpegExif(jpeg);
    // APP1 marker FF E1 must be gone; SOF (FF C0) and SOS (FF DA) preserved.
    let hasApp1 = false;
    for (let i = 0; i + 1 < out.length; i++) if (out[i] === 0xff && out[i + 1] === 0xe1) hasApp1 = true;
    expect(hasApp1).toBe(false);
    expect(out.length).toBeLessThan(jpeg.length);
    // SOF dims still readable.
    expect(readDimensions(out, "image/jpeg")).toEqual({ width: 0x05dc, height: 0x07d0 });
  });
});
