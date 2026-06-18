import { describe, it, expect } from "vitest";
import {
  STAGES,
  VIDEO_STAGES,
  LOADING_LINES,
  stageIndexForElapsed,
  lineForElapsed,
} from "@/lib/shot/loading";

describe("studio loading personality (Phase E)", () => {
  it("advances one stage every few seconds and holds on the last", () => {
    expect(stageIndexForElapsed(0, STAGES.length)).toBe(0);
    expect(stageIndexForElapsed(6000, STAGES.length)).toBe(1);
    expect(stageIndexForElapsed(6000 * 4, STAGES.length)).toBe(4);
    // holds on the last stage no matter how long it runs
    expect(stageIndexForElapsed(6000 * 99, STAGES.length)).toBe(STAGES.length - 1);
  });

  it("rotates through the studio lines and wraps", () => {
    expect(lineForElapsed(0)).toBe(LOADING_LINES[0]);
    expect(lineForElapsed(3500)).toBe(LOADING_LINES[1]);
    expect(lineForElapsed(3500 * LOADING_LINES.length)).toBe(LOADING_LINES[0]);
  });

  it("has tasteful copy with no em dashes", () => {
    for (const l of LOADING_LINES) expect(l).not.toContain("—");
    for (const s of [...STAGES, ...VIDEO_STAGES]) expect(s.label).not.toContain("—");
  });

  it("ships distinct image and video stage sets", () => {
    expect(STAGES.length).toBeGreaterThanOrEqual(4);
    expect(VIDEO_STAGES[0].label.toLowerCase()).toContain("frame");
  });
});
