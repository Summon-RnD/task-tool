import { LEAD } from "../data/constants.js";
import { C_DONE, C_LATE, C_LATER, C_RADAR, C_TODAY } from "../data/constants.js";
import { barSpan as _barSpan, dayIso, dayN } from "./date-core.js";
import { flat } from "./tree.js";
import { taskDone } from "./tree.js";

export { dayN, dayIso } from "./date-core.js";

export function createDateHelpers(today) {
  const dayNLocal = (iso) => dayN(iso, today);
  const dayIsoLocal = (d) => dayIso(d, today);

  const barSpan = (n) => _barSpan(n, today, LEAD);

  function workDays(s, e) {
    if (isNaN(s) || isNaN(e) || e < s) return 0;
    let c = 0;
    for (let d = s; d <= e; d++) {
      const wd = new Date(dayIsoLocal(d)).getDay();
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
      if (x.children.length || !x.due) return;
      const sp = barSpan(x);
      if (sp.s < s) s = sp.s;
      if (sp.e > e) e = sp.e;
    });
    return e === -Infinity ? barSpan(n) : { s, e };
  }

  const spanFor = (n) => (n.children.length ? rollupSpan(n) : barSpan(n));

  function leafWeight(n) {
    const { s, e } = barSpan(n);
    const w = workDays(s, e);
    return w > 0 ? w : 1;
  }

  function progWD(n) {
    let done = 0;
    let tot = 0;
    flat([n], (x) => {
      if (x.children.length) return;
      const w = leafWeight(x);
      tot += w;
      if (x.done) done += w;
    });
    return tot ? done / tot : 0;
  }

  function isUrgent(n) {
    const done = n.children.length ? taskDone(n) : n.done;
    if (done) return false;
    const { s } = spanFor(n);
    return !isNaN(s) && s <= 0;
  }

  const fmtD = (iso) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

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
  };
}
