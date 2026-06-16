import {
  DEFAULT_CLIENTS,
  DEFAULT_DOMAIN_RULES,
  DEFAULT_HARDWARE_VOCAB,
  DEFAULT_PEOPLE,
  DEFAULT_TODAY,
} from "./defaults.js";
import { flat } from "../lib/tree.js";

export const PEOPLE = {};
export const DATA = [];
export const CLIENTS = [];
export const HARDWARE_VOCAB = [];
export const DOMAIN_RULES = [];
export let TODAY = new Date(DEFAULT_TODAY);

function maxTaskId(nodes) {
  let m = 0;
  flat(nodes, (n) => {
    if (n.id > m) m = n.id;
  });
  return m;
}

export function applyBoard(board, setUid) {
  Object.keys(PEOPLE).forEach((k) => delete PEOPLE[k]);
  Object.assign(PEOPLE, board.people || {});

  DATA.splice(0, DATA.length, ...(board.tasks || []));

  CLIENTS.splice(0, CLIENTS.length, ...(board.clients || []));
  HARDWARE_VOCAB.splice(0, HARDWARE_VOCAB.length, ...(board.hardware_vocab || []));
  DOMAIN_RULES.splice(0, DOMAIN_RULES.length, ...(board.domain_rules || []));

  const uid = Math.max(board.uid || 0, maxTaskId(DATA));
  if (setUid) setUid(uid);

  if (board.today) TODAY = new Date(board.today);
}

export function boardPayload(getUid) {
  return {
    people: PEOPLE,
    tasks: DATA,
    clients: CLIENTS,
    hardware_vocab: HARDWARE_VOCAB,
    domain_rules: DOMAIN_RULES,
    uid: getUid ? getUid() : maxTaskId(DATA),
    today: TODAY.toISOString().slice(0, 10),
  };
}

export function initBoardDefaults(setUid, buildTasks) {
  Object.keys(PEOPLE).forEach((k) => delete PEOPLE[k]);
  Object.assign(PEOPLE, structuredClone(DEFAULT_PEOPLE));
  CLIENTS.splice(0, CLIENTS.length, ...structuredClone(DEFAULT_CLIENTS));
  HARDWARE_VOCAB.splice(0, HARDWARE_VOCAB.length, ...DEFAULT_HARDWARE_VOCAB);
  DOMAIN_RULES.splice(0, DOMAIN_RULES.length, ...structuredClone(DEFAULT_DOMAIN_RULES));
  TODAY = new Date(DEFAULT_TODAY);

  const tasks = buildTasks ? buildTasks() : [];
  DATA.splice(0, DATA.length, ...tasks);

  const uid = maxTaskId(DATA);
  if (setUid) setUid(uid);
}

initBoardDefaults();
