import { describe, expect, it } from "vitest";
import { calendarToday, dayN, parseLocalIso, todayLocalIso, barSpan } from "../src/lib/date-core.js";

describe("date-core", () => {
  it("normalizes to local calendar midnight", () => {
    const d = calendarToday(new Date(2026, 5, 16, 15, 30));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(todayLocalIso(d)).toBe("2026-06-16");
  });

  it("parses iso dates in local time", () => {
    const today = calendarToday(new Date(2026, 5, 16));
    expect(dayN("2026-06-16", today)).toBe(0);
    expect(dayN("2026-06-15", today)).toBe(-1);
    expect(parseLocalIso("2026-06-16").getDate()).toBe(16);
  });

  it("barSpan tolerates missing due dates", () => {
    const today = calendarToday(new Date(2026, 5, 16));
    const lead = { s: 1, m: 3, l: 7, xl: 14 };
    expect(barSpan({ due: null, size: "m" }, today, lead)).toEqual({ s: -2, e: 0 });
  });
});
