import { describe, expect, it } from "vitest";
import {
  barHeight,
  GBAR_H,
  ganttRange,
  LEAD,
  normalizeSize,
  SIZE_KEYS,
  SIZE_NAMES,
  SIZE_PTS,
  sizePts,
  ZOOMS,
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

  it("maps zoom presets to explicit gantt day ranges", () => {
    expect(ganttRange(ZOOMS[0])).toEqual({ r0: -41, r1: 0 });
    expect(ganttRange(ZOOMS[1])).toEqual({ r0: -20, r1: 0 });
    expect(ganttRange(ZOOMS[2])).toEqual({ r0: -14, r1: 21 });
    expect(ganttRange(ZOOMS[3])).toEqual({ r0: 0, r1: 6 });
    expect(ganttRange(ZOOMS[4])).toEqual({ r0: 0, r1: 20 });
    expect(ganttRange(ZOOMS[5])).toEqual({ r0: 0, r1: 41 });
  });
});
