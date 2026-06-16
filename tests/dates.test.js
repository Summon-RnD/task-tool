import { describe, expect, it } from "vitest";
import { calendarToday } from "../src/lib/date-core.js";
import { createDateHelpers } from "../src/lib/dates.js";

describe("dates", () => {
  const h = createDateHelpers(calendarToday(new Date(2026, 5, 12)));

  it("maps iso dates to day offsets from today", () => {
    expect(h.dayN("2026-06-12")).toBe(0);
    expect(h.dayN("2026-06-15")).toBe(3);
  });

  it("derives bar span from due date and size lead time", () => {
    const span = h.barSpan({ due: "2026-06-20", size: "m" });
    expect(span.e).toBe(8);
    expect(span.s).toBe(6);
  });

  it("counts weekdays inside a span", () => {
    expect(h.workDays(0, 4)).toBe(3);
  });

  it("assigns urgency colors", () => {
    expect(h.barColor(-1, -2, false)).toBe("#ff5d5d");
    expect(h.barColor(0, 0, false)).toBe("#2f80ff");
    expect(h.barColor(5, 0, false)).toBe("#16c79a");
    expect(h.barColor(5, 3, false)).toBe("#9b8cff");
    expect(h.barColor(5, 3, true)).toBe("#c8cdd6");
  });

  it("clamps late tasks to the today box", () => {
    expect(h.barGeom(-3, -1, false)).toEqual([0, 1]);
  });

  it("rolls parent span across child leaves", () => {
    const parent = {
      due: "2026-06-30",
      size: "m",
      children: [
        { due: "2026-06-14", size: "s", children: [] },
        { due: "2026-06-22", size: "m", children: [] },
      ],
    };
    const span = h.rollupSpan(parent);
    expect(span.s).toBeLessThanOrEqual(span.e);
    expect(span.e).toBe(10);
  });
});
