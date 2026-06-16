import { describe, expect, it } from "vitest";
import { calendarToday, dayN, parseLocalIso, todayLocalIso } from "../src/lib/date-core.js";

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
});
