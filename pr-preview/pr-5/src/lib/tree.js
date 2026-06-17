export function createTaskFactory() {
  let uid = 0;
  const T = (title, o, opts = {}) => ({
    id: ++uid,
    title,
    owner: o,
    priority: opts.p || "med",
    due: opts.d || null,
    start: opts.st || null,
    size: opts.s || null,
    done: opts.done || false,
    doneAt: opts.doneAt || null,
    children: opts.c || [],
    open: opts.open || false,
  });
  return {
    T,
    resetUid: () => { uid = 0; },
    getUid: () => uid,
    setUid: (v) => { uid = v; },
  };
}

export const flat = (nodes, fn, depth = 0, path = []) =>
  nodes.forEach((n) => {
    fn(n, depth, path);
    flat(n.children, fn, depth + 1, [...path, n]);
  });

export function findPath(id, nodes, path = []) {
  for (const n of nodes) {
    if (n.id === id) return [...path, n];
    const r = findPath(id, n.children, [...path, n]);
    if (r) return r;
  }
  return null;
}

export function counts(n) {
  if (!n.children.length) return { done: n.done ? 1 : 0, total: 1 };
  let d = 0;
  let t = 0;
  n.children.forEach((c) => {
    const r = counts(c);
    d += r.done;
    t += r.total;
  });
  return { done: d, total: t };
}

export const pct = (n) => {
  const c = counts(n);
  return c.total ? Math.round((100 * c.done) / c.total) : 0;
};

export function progFrac(n, sizePts) {
  let done = 0;
  let tot = 0;
  flat([n], (x) => {
    if (x.children.length) return;
    const w = sizePts[x.size || "m"];
    tot += w;
    if (x.done) done += w;
  });
  return tot ? done / tot : 0;
}

export const taskDone = (n) => (!n.children.length ? n.done : pct(n) === 100);

export function taskDoneAt(n) {
  let m = null;
  flat([n], (x) => {
    if (!x.children.length && x.doneAt && (!m || x.doneAt > m)) m = x.doneAt;
  });
  return m || n.doneAt;
}

export const contains = (n, id) => n.id === id || n.children.some((c) => contains(c, id));

export const depthOf = (id, nodes) => findPath(id, nodes).length - 1;

export const heightOf = (n) =>
  n.children.length ? 1 + Math.max(...n.children.map(heightOf)) : 0;

export const fitsDepth = (node, destId, nodes) =>
  depthOf(destId, nodes) + 1 + heightOf(node) <= 2;
