export {
  PEOPLE,
  TODAY,
  CLIENTS,
  HARDWARE_VOCAB,
  DOMAIN_RULES,
  DATA,
} from "./board-store.js";

export const SIZE_PTS = { s: 1, m: 2, l: 4, xl: 8 };
export const SIZE_NAMES = { s: "S", m: "M", l: "L", xl: "XL" };
export const LEAD = { s: 1, m: 3, l: 7, xl: 14 };

export const ZOOMS = [
  { l: "Day", h: 0, v: 3 },
  { l: "Week", h: 7, v: 7 },
  { l: "3 weeks", h: 21, v: 21 },
  { l: "6 weeks", h: 42, v: 42 },
];

export const GBAR_H = { s: 26, m: 34, l: 44, xl: 56 };
export const R0G = 0;
export const R1G = 90;
export const SPAN_G = R1G - R0G;
export const TODAY_PX = 240;

export const C_LATE = "#ff5d5d";
export const C_TODAY = "#2f80ff";
export const C_RADAR = "#16c79a";
export const C_LATER = "#9b8cff";
export const C_DONE = "#c8cdd6";
