import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

describe("project layout", () => {
  it("loads the app as an ES module", () => {
    const html = readFileSync("index.html", "utf8");
    expect(html).toContain('<script type="module" src="src/app/main.js">');
    expect(html).not.toContain("<script>\n/* ================= sample data");
    expect(html).toContain('onclick="addProject()"');
  });

  it("exports gantt drag handlers to window", () => {
    const main = readFileSync("src/app/main.js", "utf8");
    const globalsBlock = main.match(/const _globals = \{([\s\S]*?)\};/);
    expect(globalsBlock).not.toBeNull();
    const exported = globalsBlock[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const name of ["projDown", "rowDown", "barDown", "openDetail"]) {
      expect(exported, `${name} must be in _globals for inline handlers`).toContain(name);
    }
  });

  it("exports core lib modules", async () => {
    const domain = await import("../src/lib/domain.js");
    const tree = await import("../src/lib/tree.js");
    const dates = await import("../src/lib/dates.js");
    const capture = await import("../src/lib/capture.js");
    expect(domain.inferOwnerByDomain).toBeTypeOf("function");
    expect(tree.createTaskFactory).toBeTypeOf("function");
    expect(dates.createDateHelpers).toBeTypeOf("function");
    expect(capture.mockTranscript).toBeTypeOf("function");
  });
});
