import { CLIENTS, DOMAIN_RULES, HARDWARE_VOCAB, PEOPLE, TODAY } from "../data/constants.js?v=0c0320f";
import { todayLocalIso } from "./date-core.js?v=0c0320f";
import { flat, normalizeTaskTree } from "./tree.js?v=0c0320f";

function maxTaskId(nodes) {
  let m = 0;
  flat(nodes, (n) => {
    if (n.id > m) m = n.id;
  });
  return m;
}

export function boardPayload(data, getUid) {
  return {
    people: PEOPLE,
    tasks: data,
    clients: CLIENTS,
    hardware_vocab: HARDWARE_VOCAB,
    domain_rules: DOMAIN_RULES,
    uid: getUid ? getUid() : maxTaskId(data),
    today: todayLocalIso(TODAY),
  };
}

export function applyBoard(board, data, setUid) {
  if (!board || typeof board !== "object") return false;
  if (!board.tasks?.length || !Object.keys(board.people || {}).length) return false;

  let leaves = 0;
  let withDue = 0;
  flat(board.tasks, (n) => {
    if (!n.children?.length) {
      leaves += 1;
      if (n.due) withDue += 1;
    }
  });
  if (!leaves || withDue < leaves * 0.3) return false;

  const peopleKeys = new Set(Object.keys(board.people || {}));
  let badOwner = false;
  flat(board.tasks, (n) => {
    if (n.owner && !peopleKeys.has(n.owner)) badOwner = true;
  });
  if (badOwner) return false;

  Object.keys(PEOPLE).forEach((k) => delete PEOPLE[k]);
  Object.assign(PEOPLE, board.people);

  data.splice(0, data.length, ...board.tasks);
  normalizeTaskTree(data);

  if (Array.isArray(board.clients)) {
    CLIENTS.splice(0, CLIENTS.length, ...board.clients);
  }
  if (Array.isArray(board.hardware_vocab)) {
    HARDWARE_VOCAB.splice(0, HARDWARE_VOCAB.length, ...board.hardware_vocab);
  }
  if (Array.isArray(board.domain_rules)) {
    DOMAIN_RULES.splice(0, DOMAIN_RULES.length, ...board.domain_rules);
  }

  const uid = Math.max(board.uid || 0, maxTaskId(data));
  if (setUid) setUid(uid);
  return true;
}

const LOAD_TIMEOUT_MS = 10000;

async function fetchBoard() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LOAD_TIMEOUT_MS);
  try {
    const res = await fetch("/api/board", { signal: ctrl.signal });
    if (!res.ok) throw new Error("load failed");
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function startBoardSync({ data, getUid, setUid, renderAll, onReady, fallback, hasLocalEdits }) {
  let boardReady = false;
  let saveTimer = null;
  let saveInFlight = false;
  let saveQueued = false;

  const payload = () => boardPayload(data, getUid);

  const useFallback = () => {
    if (!fallback) return;
    data.splice(0, data.length);
    fallback();
  };

  const safeRender = () => {
    try {
      renderAll();
    } catch (e) {
      console.error("Board render failed, using fallback data.", e);
      if (!hasLocalEdits?.()) useFallback();
      renderAll();
    }
  };

  const doSave = async () => {
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
        body: JSON.stringify(payload()),
      });
      if (!res.ok) throw new Error("save failed");
    } catch (e) {
      console.error("Board save failed", e);
    } finally {
      saveInFlight = false;
      if (saveQueued) {
        saveQueued = false;
        scheduleSave();
      }
    }
  };

  function scheduleSave() {
    if (!boardReady) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 500);
  }

  (async () => {
    let loaded = false;
    let board = null;
    try {
      board = await fetchBoard();
    } catch (e) {
      console.warn("Board load skipped, using built-in sample data.", e);
    }

    const keepLocal = hasLocalEdits?.() ?? false;
    if (keepLocal) {
      console.info("Keeping local edits made while the board was loading.");
    } else if (board) {
      loaded = applyBoard(board, data, setUid);
      if (!loaded) console.warn("Board from server rejected, using fallback data.");
    }
    if (!loaded && !keepLocal) useFallback();
    boardReady = true;
    safeRender();
    onReady(scheduleSave);
  })();
}
