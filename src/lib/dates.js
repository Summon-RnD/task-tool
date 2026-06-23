import { LEAD } from "../data/constants.js?v=aa6139c";
import { C_DONE, C_LATE, C_LATER, C_RADAR, C_TODAY } from "../data/constants.js?v=aa6139c";
import { barSpan as _barSpan, dayIso, dayN, parseLocalIso } from "./date-core.js?v=aa6139c";
import { flat, kids } from "./tree.js?v=aa6139c";
import { taskDone } from "./tree.js?v=aa6139c";

export { dayN, dayIso } from "./date-core.js?v=aa6139c";

export function createDateHelpers(today, getRoots = () => null) {
  const dayNLocal = (iso) => dayN(iso, today);
  const dayIsoLocal = (d) => dayIso(d, today);

  const barSpan = (n) => _barSpan(n, today, LEAD);

  function nodeDepth(n) {
    const roots = getRoots();
    if (!roots) return null;
    let found = null;
    const walk = (nodes, d) => {
      for (const x of nodes) {
        if (x === n) {
          found = d;
          return true;
        }
        if (walk(kids(x), d + 1)) return true;
      }
      return false;
    };
    walk(roots, 0);
    return found;
  }

  /** True for depth-1 tasks whose children are all subtask leaves. */
  function taskWithSubtasks(n) {
    const ch = kids(n);
    if (!ch.length || !ch.every((c) => !kids(c).length)) return false;
    const d = nodeDepth(n);
    return d === null ? true : d === 1;
  }

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
      // overdue / due today: keep the real start so resize ears work; stretch through today
      rs = s;
      re = Math.max(e + 1, 1);
    } else {
      rs = Math.max(s, 0);
      re = e + 1;
    }
    const cs = !done && e <= 0 ? rs : Math.max(rs, r0g);
    return [cs, Math.min(Math.max(re, cs + 0.5), r1g)];
  }

  function childEnvelope(n) {
    let s = Infinity;
    let e = -Infinity;
    flat([n], (x) => {
      if (kids(x).length || !x.due) return;
      const sp = barSpan(x);
      if (sp.s < s) s = sp.s;
      if (sp.e > e) e = sp.e;
    });
    return e === -Infinity ? null : { s, e };
  }

  /** Parent tasks use their own dates on the gantt; projects roll up descendant leaves. */
  function rollupSpan(n) {
    const env = childEnvelope(n);
    if (!env) return barSpan(n);
    if (taskWithSubtasks(n) && n.due) return barSpan(n);
    return env;
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

  /** Apply a bar move/resize; each node's dates change independently except parent moves. */
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
      n.start = dayIsoLocal(s);
      return;
    }
    n.due = dayIsoLocal(e);
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
    taskWithSubtasks,
  };
}
