import { describe, expect, it } from "vitest";
import { GBAR_H, LEAD, SIZE_KEYS, SIZE_NAMES, SIZE_PTS } from "../src/data/constants.js";

describe("size constants", () => {
  it("defines S through XXL with the requested point weights", () => {
    expect(SIZE_KEYS).toEqual(["s", "m", "l", "xl", "xxl"]);
    expect(SIZE_PTS).toEqual({ s: 1, m: 2, l: 4, xl: 6, xxl: 8 });
    for (const k of SIZE_KEYS) {
      expect(SIZE_NAMES[k]).toBeTruthy();
      expect(GBAR_H[k]).toBeGreaterThan(0);
      expect(LEAD[k]).toBeGreaterThan(0);
    }
    expect(GBAR_H.s).toBeLessThan(GBAR_H.xxl);
    expect(LEAD.s).toBeLessThanOrEqual(LEAD.xxl);
  });
});
