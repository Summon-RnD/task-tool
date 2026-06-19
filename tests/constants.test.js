import { describe, expect, it } from "vitest";
import {
  barHeight,
  GBAR_H,
  LEAD,
  normalizeSize,
  SIZE_KEYS,
  SIZE_NAMES,
  SIZE_PTS,
  sizePts,
} from "../src/data/constants.js";

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

  it("normalizes legacy and missing sizes the same for tasks and subtasks", () => {
    expect(normalizeSize("l")).toBe("l");
    expect(normalizeSize("xs")).toBe("s");
    expect(normalizeSize(null)).toBe("m");
    expect(normalizeSize(undefined)).toBe("m");
  });

  it("uses the same point and bar-height scale for every item", () => {
    for (const k of SIZE_KEYS) {
      expect(sizePts(k)).toBe(SIZE_PTS[k]);
      expect(barHeight(k)).toBe(GBAR_H[k]);
    }
    expect(sizePts(null)).toBe(2);
    expect(barHeight("xs")).toBe(GBAR_H.s);
    expect(barHeight("m")).toBe(barHeight(null));
  });
});
