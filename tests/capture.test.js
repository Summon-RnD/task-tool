import { describe, expect, it } from "vitest";
import { calendarToday } from "../src/lib/date-core.js";
import {
  cap1,
  findDue,
  findOwnerId,
  findSize,
  mockTranscript,
  normalizeProposal,
  stripCaptions,
} from "../src/lib/capture.js";

describe("capture", () => {
  it("capitalizes titles", () => {
    expect(cap1("install rs03 motors")).toBe("Install rs03 motors");
  });

  it("strips WebVTT caption metadata", () => {
    const raw = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Install RS03 motors for JCDecaux.`;
    expect(stripCaptions(raw)).toContain("Install RS03 motors");
    expect(stripCaptions(raw)).not.toMatch(/-->/);
  });

  it("parses relative due dates", () => {
    const today = calendarToday(new Date(2026, 5, 12));
    expect(findDue(" due tomorrow ", today)).toBe("2026-06-13");
    expect(findDue(" ship in 3 days ", today)).toBe("2026-06-15");
  });

  it("resolves owner aliases from transcript text", () => {
    expect(findOwnerId(" yannis will handle it ")).toBe("ia");
  });

  it("parses t-shirt sizes", () => {
    expect(findSize("this is a large task")).toBe("l");
    expect(findSize("extra large integration")).toBe("xl");
  });

  it("extracts projects and tasks from a conversation offline", () => {
    const raw = mockTranscript(
      "For JCDecaux, install RS03 motors and calibrate obstacle avoidance by Monday."
    );
    const proposal = normalizeProposal(raw);
    expect(proposal.projects.length).toBeGreaterThan(0);
    expect(proposal.projects[0].tasks.length).toBeGreaterThan(0);
    expect(proposal.projects[0].tasks.some((t) => t.title.includes("RS03"))).toBe(true);
  });
});
