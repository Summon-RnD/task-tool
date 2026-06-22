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

  it("spanFor tolerates nodes without a children array", () => {
    const leaf = { due: "2026-06-20", size: "m" };
    expect(h.spanFor(leaf).e).toBe(8);
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
    // parent end (Jun 30) wins over subtasks; earliest subtask still extends the left edge
    expect(span.s).toBe(2);
    expect(span.e).toBe(18);
  });

  it("does not shrink a parent task when subtasks fall inside its dates", () => {
    const parent = {
      start: "2026-06-15",
      due: "2026-06-30",
      size: "l",
      children: [{ due: "2026-06-20", size: "s", children: [] }],
    };
    const own = h.barSpan(parent);
    const span = h.spanFor(parent);
    expect(span.s).toBe(own.s);
    expect(span.e).toBe(own.e);
  });

  it("expands a parent task when a subtask is scheduled outside its dates", () => {
    const parent = {
      due: "2026-06-20",
      size: "m",
      children: [{ due: "2026-07-05", size: "s", children: [] }],
    };
    const own = h.barSpan(parent);
    const span = h.spanFor(parent);
    expect(span.s).toBe(own.s);
    expect(span.e).toBeGreaterThan(own.e);
    expect(span.e).toBe(h.barSpan(parent.children[0]).e);
  });

  it("clips subtasks when a parent task's end date moves earlier", () => {
    const parent = {
      due: "2026-06-30",
      size: "m",
      children: [{ due: "2026-07-05", size: "s", children: [] }],
    };
    parent.due = "2026-06-22";
    h.clipLeavesToParentSpan(parent);
    expect(h.dayN(parent.children[0].due)).toBeLessThanOrEqual(h.dayN(parent.due));
    expect(h.barSpan(parent.children[0]).e).toBeLessThanOrEqual(h.barSpan(parent).e);
  });

  it("still rolls up projects across all descendant leaves", () => {
    const project = {
      due: "2026-07-15",
      size: "m",
      children: [
        { due: "2026-06-14", size: "s", children: [] },
        { due: "2026-06-22", size: "m", children: [] },
      ],
    };
    const roots = [project];
    const hp = createDateHelpers(calendarToday(new Date(2026, 5, 12)), () => roots);
    const span = hp.rollupSpan(project);
    expect(span.s).toBe(2);
    expect(span.e).toBe(10);
  });

  it("moves a parent task and its subtasks together", () => {
    const parent = {
      due: "2026-06-30",
      size: "m",
      children: [
        { due: "2026-06-14", size: "s", children: [] },
        { due: "2026-06-22", size: "m", children: [] },
      ],
    };
    const before = h.spanFor(parent);
    h.commitBarDrag(parent, "move", before.s + 3, before.e + 3, before.s, before.e);
    expect(h.dayN(parent.due)).toBe(h.dayN("2026-07-03"));
    expect(h.dayN(parent.children[0].due)).toBe(h.dayN("2026-06-17"));
    expect(h.dayN(parent.children[1].due)).toBe(h.dayN("2026-06-25"));
    expect(h.spanFor(parent).s).toBe(before.s + 3);
    expect(h.spanFor(parent).e).toBe(before.e + 3);
  });

  it("resizes a parent task rollup from the right edge", () => {
    const parent = {
      due: "2026-06-30",
      size: "m",
      children: [
        { due: "2026-06-14", size: "s", children: [] },
        { due: "2026-06-22", size: "m", children: [] },
      ],
    };
    const before = h.spanFor(parent);
    h.commitBarDrag(parent, "r", before.s, before.e + 2, before.s, before.e);
    expect(h.spanFor(parent).e).toBe(before.e + 2);
    expect(h.dayN(parent.children[1].due)).toBe(h.dayN("2026-06-24"));
  });
});
