import { describe, expect, it } from "vitest";
import { GBAR_H, LEAD, SIZE_KEYS, SIZE_NAMES, SIZE_PTS } from "../src/data/constants.js";

describe("size constants", () => {
  it("defines XS through XXL with increasing bar height and lead time", () => {
    expect(SIZE_KEYS).toEqual(["xs", "s", "m", "l", "xl", "xxl"]);
    for (const k of SIZE_KEYS) {
      expect(SIZE_NAMES[k]).toBeTruthy();
      expect(SIZE_PTS[k]).toBeGreaterThan(0);
      expect(GBAR_H[k]).toBeGreaterThan(0);
      expect(LEAD[k]).toBeGreaterThan(0);
    }
    expect(GBAR_H.xs).toBeLessThan(GBAR_H.s);
    expect(GBAR_H.xxl).toBeGreaterThan(GBAR_H.xl);
    expect(LEAD.xs).toBeLessThanOrEqual(LEAD.s);
    expect(LEAD.xxl).toBeGreaterThan(LEAD.xl);
  });
});
