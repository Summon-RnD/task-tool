let boardReady = false;
let saveTimer = null;
let saveInFlight = false;
let saveQueued = false;

export function isBoardReady() {
  return boardReady;
}

export function scheduleSave(saveBoard) {
  if (!boardReady) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveBoard, 500);
}

export async function saveBoard(boardPayload) {
  if (!boardReady) return;
  if (saveInFlight) {
    saveQueued = true;
    return;
  }
  saveInFlight = true;
  try {
    const res = await fetch("/api/board", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(boardPayload()),
    });
    if (!res.ok) throw new Error("save failed");
  } catch (e) {
    console.error("Board save failed", e);
  } finally {
    saveInFlight = false;
    if (saveQueued) {
      saveQueued = false;
      scheduleSave(() => saveBoard(boardPayload));
    }
  }
}

export async function initApp({ applyBoard, boardPayload, renderAll }) {
  const doSave = () => saveBoard(boardPayload);
  let useServer = false;
  try {
    const res = await fetch("/api/board");
    if (!res.ok) throw new Error("load failed");
    applyBoard(await res.json());
    useServer = true;
  } catch (e) {
    console.warn("Board load skipped, using local sample data.", e);
  }
  boardReady = useServer;
  renderAll();
  return () => scheduleSave(doSave);
}
