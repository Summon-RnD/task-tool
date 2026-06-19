import { describe, expect, it } from "vitest";
import { createTaskFactory, counts, findPath, normalizeTaskTree, pct, progFrac, taskDone, taskDoneAt } from "../src/lib/tree.js";
import { SIZE_PTS } from "../src/data/constants.js";

describe("tree", () => {
  const { T } = createTaskFactory();

  it("counts leaf completion", () => {
    const root = T("Project", "ia", {
      c: [
        T("A", "sk", { done: true }),
        T("B", "sk", { done: false }),
      ],
    });
    expect(counts(root)).toEqual({ done: 1, total: 2 });
    expect(pct(root)).toBe(50);
  });

  it("finds node path by id", () => {
    const child = T("Child", "sk");
    const root = T("Root", "ia", { c: [child] });
    const path = findPath(child.id, [root]);
    expect(path.map((n) => n.title)).toEqual(["Root", "Child"]);
  });

  it("weights progress by size points", () => {
    const root = T("Project", "ia", {
      c: [
        T("Small done", "sk", { s: "s", done: true }),
        T("Large open", "sk", { s: "l", done: false }),
      ],
    });
    expect(progFrac(root, SIZE_PTS)).toBeCloseTo(1 / 5);
  });

  it("marks parent done when all children complete", () => {
    const root = T("Project", "ia", {
      c: [T("A", "sk", { done: true }), T("B", "sk", { done: true })],
    });
    expect(taskDone(root)).toBe(true);
  });

  it("tracks latest doneAt among leaves", () => {
    const root = T("Project", "ia", {
      c: [
        T("A", "sk", { doneAt: "2026-06-10", children: [] }),
        T("B", "sk", { doneAt: "2026-06-12", children: [] }),
      ],
    });
    expect(taskDoneAt(root)).toBe("2026-06-12");
  });

  it("normalizes missing children arrays on loaded nodes", () => {
    const leaf = { id: 1, title: "Leaf", owner: "fd", due: "2026-06-20" };
    const root = { id: 2, title: "Root", owner: "fd", children: [leaf] };
    normalizeTaskTree([root]);
    expect(leaf.children).toEqual([]);
    expect(findPath(1, [root]).map((n) => n.title)).toEqual(["Root", "Leaf"]);
  });

  it("migrates legacy xs size to s", () => {
    const root = { id: 1, title: "Root", owner: "fd", size: "xs", children: [] };
    normalizeTaskTree([root]);
    expect(root.size).toBe("s");
  });

  it("normalizes blank comments to null", () => {
    const root = { id: 1, title: "Root", owner: "fd", comment: "  ", children: [] };
    normalizeTaskTree([root]);
    expect(root.comment).toBeNull();
  });

  it("stores comments on created tasks", () => {
    const task = T("Task", "sk", { comment: "Needs review" });
    expect(task.comment).toBe("Needs review");
  });
});
