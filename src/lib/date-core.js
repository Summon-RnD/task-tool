/** Local calendar midnight for the given instant (defaults to now). */
export function calendarToday(from = new Date()) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** YYYY-MM-DD in local time (avoids UTC off-by-one from toISOString). */
export function todayLocalIso(d = new Date()) {
  const x = calendarToday(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalIso(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return calendarToday(new Date(y, m - 1, d));
}

export function dayN(iso, today) {
  return Math.round((parseLocalIso(iso) - today) / 864e5);
}

export function dayIso(d, today) {
  const x = new Date(today);
  x.setDate(x.getDate() + d);
  return todayLocalIso(x);
}

export function barSpan(n, today, lead) {
  const e = dayN(n.due, today);
  return { s: n.start ? dayN(n.start, today) : e - (lead[n.size || "m"] - 1), e };
}
