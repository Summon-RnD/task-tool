import { calendarToday } from "../lib/date-core.js";

export const PEOPLE = {
  jn: { name: "Jean", initials: "JN", color: "#27a468", role: "Finances", al: ["jean"] },
  fd: { name: "Florian", initials: "FD", color: "#3b6ef6", role: "Customer outreach, raising money, and recruitment", al: ["florian", "flo", "fluorine", "florine", "florent", "floriane"] },
  ia: { name: "Iannis", initials: "IA", color: "#e8930c", role: "Building the robot and operating system", al: ["iannis", "yannis", "yanis", "ianis", "ioannis", "janice", "janis", "yanni", "ennis"] },
  ak: { name: "Akshat", initials: "AK", color: "#9b59d0", role: "Obstacle avoidance and autonomous locomotion", al: ["akshat", "akshad", "akshot", "axat", "akshut"] },
  sk: { name: "Sanket", initials: "SK", color: "#d4488e", role: "Control and embedded systems", al: ["sanket", "sankeet", "sankit", "sunket", "sanke"] },
  lm: { name: "Liam", initials: "LM", color: "#0ea5b7", role: "General / operations", al: ["liam", "leam"] },
  ly: { name: "Leynaïck", initials: "LY", color: "#647acb", role: "Electronics (intern)", al: ["leynaïck", "leynaick", "lenaick", "laynaick", "leinaick", "lenix", "laynick"] },
};

export const TODAY = calendarToday();

export const HARDWARE_VOCAB = [
  "Robstride motors: RS00, RS02, RS03, RS04, EL05",
  "Feetech motors (all models)",
  "Hub motors (used for the wheels - primary locomotion)",
  "D-Wave board (custom hardware board in the current robots)",
];

export const CLIENTS = [
  { name: "Onet", al: ["onet", "o net", "onnet", "aunet"] },
  { name: "Derichebourg", al: ["derichebourg", "de riche bourg", "derichbourg", "derich bourg", "deurichebourg"] },
  { name: "NSI", al: ["nsi", "n s i", "ensi", "n.s.i"] },
  { name: "Areas", al: ["areas", "aréas", "arias", "ariane", "arrears"] },
  { name: "JCDecaux", al: ["jcdecaux", "jc decaux", "jcd", "jic decaux", "jaycee decaux", "jay c decaux"] },
];

export const DOMAIN_RULES = [
  { o: "ak", kw: ["obstacle", "avoidance", "autonom", "navigation", "locomot", "path planning", "slam", "perception", "mapping"] },
  { o: "sk", kw: ["control", "embedded", "firmware", "motor control", "pid", "actuator", "can bus", "servo", "rs0", "rs00", "rs02", "rs03", "rs04", "el05", "feetech", "hub motor", "motor"] },
  { o: "ia", kw: ["operating system", " os ", "assembly", "chassis", "mechanical", "integration", "build the robot", "robot build", "frame"] },
  { o: "ly", kw: ["electronic", "d-wave", "dwave", "board", "power", "wiring", "pcb", "circuit", "battery", "soldering", "harness"] },
  { o: "jn", kw: ["budget", "invoice", "finance", "cost", "payment", "accounting", "payroll"] },
  { o: "fd", kw: ["client", "outreach", "fundrais", "recruit", "hiring", "pilot", "sales", "demo", "investor", "contract"] },
];

export const SIZE_KEYS = ["s", "m", "l", "xl", "xxl"];
export const SIZE_PTS = { s: 1, m: 2, l: 4, xl: 6, xxl: 8 };
export const SIZE_NAMES = { s: "S", m: "M", l: "L", xl: "XL", xxl: "XXL" };
export const LEAD = { s: 1, m: 3, l: 7, xl: 14, xxl: 28 };

/** Map legacy/invalid sizes onto the active scale (same rules for tasks and subtasks). */
export function normalizeSize(size) {
  if (size && SIZE_KEYS.includes(size)) return size;
  if (size === "xs") return "s";
  return "m";
}

export const sizePts = (size) => SIZE_PTS[normalizeSize(size)];
export const barHeight = (size) => GBAR_H[normalizeSize(size)];

export const ZOOMS = [
  { l: "Last 6 weeks", s: "−6 weeks", h: 42, v: 42, r0: -41, r1: 0 },
  { l: "Last 3 weeks", s: "−3 weeks", h: 21, v: 21, r0: -20, r1: 0 },
  { l: "2 weeks back to 3 weeks ahead", s: "−2 wks to +3 wks", h: 35, v: 36, r0: -14, r1: 21 },
  { l: "Next week", s: "+1 week", h: 7, v: 7, r0: 0, r1: 6 },
  { l: "Next 3 weeks", s: "+3 weeks", h: 21, v: 21, r0: 0, r1: 20 },
  { l: "Next 6 weeks", s: "+6 weeks", h: 42, v: 42, r0: 0, r1: 41 },
];

/** Visible gantt day range for a zoom preset (day offsets from today). */
export function ganttRange(zoom) {
  if (zoom?.r0 != null && zoom?.r1 != null) return { r0: zoom.r0, r1: zoom.r1 };
  return { r0: R0G, r1: R1G };
}

export const GBAR_H = { s: 26, m: 34, l: 44, xl: 56, xxl: 68 };
export const R0G = 0;
export const R1G = 90;
export const SPAN_G = R1G - R0G;
export const TODAY_PX = 240;

export const C_LATE = "#ff5d5d";
export const C_TODAY = "#2f80ff";
export const C_RADAR = "#16c79a";
export const C_LATER = "#9b8cff";
export const C_DONE = "#c8cdd6";
