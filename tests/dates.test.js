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

  it("uses a parent task's own span regardless of subtask dates", () => {
    const parent = {
      due: "2026-06-30",
      size: "m",
      children: [
        { due: "2026-06-14", size: "s", children: [] },
        { due: "2026-06-22", size: "m", children: [] },
      ],
    };
    expect(h.rollupSpan(parent)).toEqual(h.barSpan(parent));
  });

  it("does not change subtasks when a parent task due date is edited", () => {
    const parent = {
      due: "2026-06-30",
      size: "m",
      children: [{ due: "2026-07-05", size: "s", children: [] }],
    };
    const subDue = parent.children[0].due;
    parent.due = "2026-06-22";
    h.commitBarDrag(parent, "r", h.barSpan(parent).s, h.dayN("2026-06-22"), h.barSpan(parent).s, h.barSpan(parent).e);
    expect(parent.children[0].due).toBe(subDue);
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

  it("resizes a leaf bar start and end independently", () => {
    const leaf = { due: "2026-06-30", start: "2026-06-20", size: "m", children: [] };
    h.commitBarDrag(leaf, "l", 5, 18, 10, 18);
    expect(h.dayN(leaf.start)).toBe(5);
    expect(h.dayN(leaf.due)).toBe(18);
    h.commitBarDrag(leaf, "r", 5, 12, 5, 18);
    expect(h.dayN(leaf.due)).toBe(12);
  });
});
