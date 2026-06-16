import { describe, it, expect } from "vitest";
import {
  LedgerSim,
  canReserve,
  settleDelta,
  applyDebit,
  InsufficientCreditsError,
} from "@/lib/engine/ledger";

describe("credit ledger math", () => {
  it("canReserve gates on balance", () => {
    expect(canReserve(100, 4)).toBe(true);
    expect(canReserve(4, 4)).toBe(true);
    expect(canReserve(3, 4)).toBe(false);
  });

  it("settleDelta returns signed delta so net charge equals actual", () => {
    expect(settleDelta(4, 4)).toBe(0); // fixed-cost image
    expect(settleDelta(152, 160)).toBe(8); // ran longer, charge more
    expect(settleDelta(152, 140)).toBe(-12); // ran shorter, credit back
  });

  it("applyDebit gates at zero only when asked", () => {
    expect(applyDebit(100, 4, true)).toBe(96);
    expect(() => applyDebit(3, 4, true)).toThrow(InsufficientCreditsError);
    expect(applyDebit(3, 4, false)).toBe(-1); // ungated settle may dip
  });
});

describe("reserve -> settle -> refund lifecycle (in-memory sim mirroring SQL)", () => {
  it("happy path: grant, reserve, settle equal-cost leaves correct balance", () => {
    const l = new LedgerSim();
    l.grant(100); // signup grant
    expect(l.balance).toBe(100);

    l.reserve(4, "job1"); // reserve $0.04 Seedream
    expect(l.balance).toBe(96);

    l.settle(4, 4, "job1"); // actual == estimate
    expect(l.balance).toBe(96); // net spend is exactly 4

    // ledger conservation: balance equals sum of all transaction amounts
    const sum = l.txns.reduce((acc, t) => acc + t.amount, 0);
    expect(sum).toBe(l.balance);
  });

  it("settle when actual exceeds estimate charges the extra", () => {
    const l = new LedgerSim();
    l.grant(200);
    l.reserve(152, "vid"); // 5s video estimate
    l.settle(152, 160, "vid"); // ran 8 credits longer
    expect(l.balance).toBe(200 - 160);
  });

  it("settle when actual is under estimate credits part back", () => {
    const l = new LedgerSim();
    l.grant(200);
    l.reserve(152, "vid");
    l.settle(152, 140, "vid");
    expect(l.balance).toBe(200 - 140);
  });

  it("refund on failure returns the full reservation: free of charge", () => {
    const l = new LedgerSim();
    l.grant(100);
    l.reserve(15, "hero"); // Nano Banana Pro reserve
    expect(l.balance).toBe(85);
    l.refund(15, "hero"); // fal failed, refund
    expect(l.balance).toBe(100); // back to start, no spend
  });

  it("reserve rejects when balance cannot cover it (no free generations)", () => {
    const l = new LedgerSim();
    l.grant(3);
    expect(() => l.reserve(4, "job")).toThrow(InsufficientCreditsError);
    expect(l.balance).toBe(3); // unchanged
  });

  it("balance never silently goes free: a settle delta of zero still records a row", () => {
    const l = new LedgerSim();
    l.grant(50);
    l.reserve(4, "j");
    const before = l.txns.length;
    l.settle(4, 4, "j");
    expect(l.txns.length).toBe(before + 1); // settle row recorded even at delta 0
  });
});
