import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { PEOPLE } from "../src/data/constants.js";
import { createTaskFactory } from "../src/lib/tree.js";
import { applyBoard, startBoardSync } from "../src/lib/board-sync.js";

describe("board-sync", () => {
  const { T, setUid } = createTaskFactory();

  beforeEach(() => {
    setUid(0);
    Object.assign(PEOPLE, {
      fd: { name: "Florian", initials: "FD", color: "#3b6ef6", role: "Lead", al: [] },
    });
  });

  it("applyBoard replaces in-memory data from a server payload", () => {
    const data = [];
    const board = {
      people: { fd: { name: "Florian", initials: "FD", color: "#3b6ef6", role: "Lead", al: [] } },
      tasks: [T("Server project", "fd", { d: "2026-06-20", c: [T("Leaf", "fd", { d: "2026-06-18" })] })],
      uid: 2,
    };
    expect(applyBoard(board, data, setUid)).toBe(true);
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Server project");
  });

  it("startBoardSync renders once after loading from the server", async () => {
    const data = [];
    const renderAll = vi.fn();
    const onReady = vi.fn();
    const board = {
      people: { fd: { name: "Florian", initials: "FD", color: "#3b6ef6", role: "Lead", al: [] } },
      tasks: [T("DB project", "fd", { d: "2026-06-20", c: [T("Task", "fd", { d: "2026-06-18" })] })],
      uid: 2,
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => board,
    }));

    startBoardSync({ data, getUid: () => 0, setUid, renderAll, onReady, fallback: vi.fn() });
    await vi.waitFor(() => expect(renderAll).toHaveBeenCalledTimes(1));
    expect(data[0]?.title).toBe("DB project");
    expect(onReady).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });

  it("startBoardSync uses fallback when the server is unavailable", async () => {
    const data = [];
    const renderAll = vi.fn();
    const fallback = vi.fn(() => { data.push(T("Fallback project", "fd", { d: "2026-06-20" })); });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    startBoardSync({ data, getUid: () => 0, setUid, renderAll, onReady: () => {}, fallback });
    await vi.waitFor(() => expect(renderAll).toHaveBeenCalledTimes(1));
    expect(fallback).toHaveBeenCalledOnce();
    expect(data[0]?.title).toBe("Fallback project");

    vi.unstubAllGlobals();
  });
});
