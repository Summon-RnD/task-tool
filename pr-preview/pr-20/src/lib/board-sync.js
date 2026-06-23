import { CLIENTS, DOMAIN_RULES, HARDWARE_VOCAB, PEOPLE, TODAY } from "../data/constants.js?v=419f5ae";
import { todayLocalIso } from "./date-core.js?v=419f5ae";
import { flat, normalizeTaskTree } from "./tree.js?v=419f5ae";

const BOARD_STORAGE_KEY = "taskboard_board_v1";
const LOAD_TIMEOUT_MS = 10000;

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

function boardShapeOk(board) {
  return board && typeof board === "object" && board.tasks?.length && Object.keys(board.people || {}).length;
}

export function applyBoard(board, data, setUid) {
  if (!boardShapeOk(board)) return false;

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

function readStoredBoard() {
  try {
    const raw = localStorage.getItem(BOARD_STORAGE_KEY);
    if (!raw) return null;
    const board = JSON.parse(raw);
    return boardShapeOk(board) ? board : null;
  } catch {
    return null;
  }
}

function writeStoredBoard(board) {
  try {
    localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(board));
    return true;
  } catch (e) {
    console.error("Board local save failed", e);
    return false;
  }
}

function responseLooksJson(res) {
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") || ct.includes("text/json");
}

async function fetchBoardFromApi() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LOAD_TIMEOUT_MS);
  try {
    const res = await fetch("/api/board", { signal: ctrl.signal });
    if (!res.ok || !responseLooksJson(res)) throw new Error("load failed");
    const board = await res.json();
    if (!boardShapeOk(board)) throw new Error("invalid board");
    return board;
  } finally {
    clearTimeout(timer);
  }
}

async function saveBoardToApi(body) {
  const res = await fetch("/api/board", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  });
  if (!res.ok || !responseLooksJson(res)) throw new Error("save failed");
}

export function startBoardSync({ data, getUid, setUid, renderAll, onReady, fallback, hasLocalEdits }) {
  let boardReady = false;
  let saveTimer = null;
  let saveInFlight = false;
  let saveQueued = false;
  let apiAvailable = true;

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

  const persistLocal = () => writeStoredBoard(payload());

  const doSave = async () => {
    if (!boardReady) return;
    if (saveInFlight) {
      saveQueued = true;
      return;
    }
    saveInFlight = true;
    const body = payload();
    persistLocal();
    try {
      if (apiAvailable) await saveBoardToApi(body);
    } catch (e) {
      apiAvailable = false;
      console.warn("Board API save unavailable; keeping changes in this browser only.", e);
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

  function flushSave() {
    if (!boardReady) return;
    clearTimeout(saveTimer);
    const body = payload();
    persistLocal();
    if (apiAvailable) {
      fetch("/api/board", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => { apiAvailable = false; });
    }
  }

  const onPageHide = () => flushSave();
  if (typeof window !== "undefined") window.addEventListener("pagehide", onPageHide);

  (async () => {
    let loaded = false;
    let board = null;
    try {
      board = await fetchBoardFromApi();
    } catch (e) {
      console.warn("Board API load skipped.", e);
      apiAvailable = false;
    }

    const keepLocal = hasLocalEdits?.() ?? false;
    if (keepLocal) {
      console.info("Keeping local edits made while the board was loading.");
    } else if (board) {
      loaded = applyBoard(board, data, setUid);
      if (!loaded) console.warn("Board from server rejected.");
    }

    if (!loaded && !keepLocal) {
      const stored = readStoredBoard();
      if (stored) loaded = applyBoard(stored, data, setUid);
    }
    if (!loaded && !keepLocal) useFallback();

    boardReady = true;
    safeRender();
    onReady(scheduleSave);
    if (keepLocal || hasLocalEdits?.()) scheduleSave();
  })();

  return () => {
    if (typeof window !== "undefined") window.removeEventListener("pagehide", onPageHide);
  };
}
