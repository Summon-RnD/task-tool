import { LEAD } from "../data/constants.js?v=d3ce510";
import { C_DONE, C_LATE, C_LATER, C_RADAR, C_TODAY } from "../data/constants.js?v=d3ce510";
import { barSpan as _barSpan, dayIso, dayN, parseLocalIso } from "./date-core.js?v=d3ce510";
import { flat, kids } from "./tree.js?v=d3ce510";
import { taskDone } from "./tree.js?v=d3ce510";

export { dayN, dayIso } from "./date-core.js?v=d3ce510";

export function createDateHelpers(today) {
  const dayNLocal = (iso) => dayN(iso, today);
  const dayIsoLocal = (d) => dayIso(d, today);

  const barSpan = (n) => _barSpan(n, today, LEAD);

  function workDays(s, e) {
    if (isNaN(s) || isNaN(e) || e < s) return 0;
    let c = 0;
    for (let d = s; d <= e; d++) {
      const wd = parseLocalIso(dayIsoLocal(d)).getDay();
      if (wd !== 0 && wd !== 6) c++;
    }
    return c;
  }

  function barColor(e, s, done) {
    if (done) return C_DONE;
    if (e < 0) return C_LATE;
    if (e === 0) return C_TODAY;
    if (s <= 0) return C_RADAR;
    return C_LATER;
  }

  function barGeom(s, e, done, r0g = 0, r1g = 90) {
    let rs;
    let re;
    if (done) {
      rs = s;
      re = e + 1;
    } else if (e <= 0) {
      rs = 0;
      re = 1;
    } else {
      rs = Math.max(s, 0);
      re = e + 1;
    }
    const cs = Math.max(rs, r0g);
    return [cs, Math.min(Math.max(re, cs + 0.5), r1g)];
  }

  function rollupSpan(n) {
    let s = Infinity;
    let e = -Infinity;
    flat([n], (x) => {
      if (kids(x).length || !x.due) return;
      const sp = barSpan(x);
      if (sp.s < s) s = sp.s;
      if (sp.e > e) e = sp.e;
    });
    return e === -Infinity ? barSpan(n) : { s, e };
  }

  const spanFor = (n) => (kids(n).length ? rollupSpan(n) : barSpan(n));

  function leafWeight(n) {
    const { s, e } = barSpan(n);
    const w = workDays(s, e);
    return w > 0 ? w : 1;
  }

  function progWD(n) {
    let done = 0;
    let tot = 0;
    flat([n], (x) => {
      if (kids(x).length) return;
      const w = leafWeight(x);
      tot += w;
      if (x.done) done += w;
    });
    return tot ? done / tot : 0;
  }

  function isUrgent(n) {
    const done = kids(n).length ? taskDone(n) : n.done;
    if (done) return false;
    const { s } = spanFor(n);
    return !isNaN(s) && s <= 0;
  }

  const fmtD = (iso) =>
    parseLocalIso(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  const shiftIso = (iso, dd) => dayIsoLocal(dayNLocal(iso) + dd);

  function shiftSubtreeDates(n, dd) {
    if (!dd) return;
    if (n.start) n.start = shiftIso(n.start, dd);
    if (n.due) n.due = shiftIso(n.due, dd);
    kids(n).forEach((c) => shiftSubtreeDates(c, dd));
  }

  function rollupLeaves(n) {
    const leaves = [];
    flat([n], (x) => {
      if (!kids(x).length && x.due) leaves.push(x);
    });
    return leaves;
  }

  /** Apply a bar move/resize; parent tasks with subtasks shift the rollup envelope. */
  function commitBarDrag(n, mode, s, e, s0, e0) {
    if (!kids(n).length) {
      if (mode === "move") {
        n.due = dayIsoLocal(e);
        if (n.start) n.start = dayIsoLocal(s);
      } else if (mode === "l") {
        n.start = dayIsoLocal(s);
      } else {
        if (!n.start) n.start = dayIsoLocal(s0);
        n.due = dayIsoLocal(e);
      }
      return;
    }
    const old = spanFor(n);
    if (mode === "move") {
      shiftSubtreeDates(n, s - old.s);
      return;
    }
    if (mode === "l") {
      const dd = s - old.s;
      if (!dd) return;
      const leaves = rollupLeaves(n);
      let minS = Infinity;
      leaves.forEach((l) => {
        const ls = barSpan(l).s;
        if (ls < minS) minS = ls;
      });
      leaves.forEach((l) => {
        if (barSpan(l).s !== minS) return;
        if (l.start) l.start = shiftIso(l.start, dd);
        else l.due = shiftIso(l.due, dd);
      });
      n.start = dayIsoLocal(s);
      return;
    }
    const dd = e - old.e;
    if (!dd) return;
    const leaves = rollupLeaves(n);
    let maxE = -Infinity;
    leaves.forEach((l) => {
      const le = barSpan(l).e;
      if (le > maxE) maxE = le;
    });
    leaves.forEach((l) => {
      if (barSpan(l).e === maxE) l.due = shiftIso(l.due, dd);
    });
    n.due = dayIsoLocal(e);
    if (!n.start) n.start = dayIsoLocal(old.s);
  }

  return {
    dayN: dayNLocal,
    dayIso: dayIsoLocal,
    barSpan,
    workDays,
    barColor,
    barGeom,
    rollupSpan,
    spanFor,
    leafWeight,
    progWD,
    isUrgent,
    fmtD,
    commitBarDrag,
  };
}
