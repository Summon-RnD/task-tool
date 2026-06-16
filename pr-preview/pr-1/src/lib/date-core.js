export function dayN(iso, today) {
  return Math.round((new Date(iso) - today) / 864e5);
}

export function dayIso(d, today) {
  const x = new Date(today);
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
}

export function barSpan(n, today, lead) {
  const e = dayN(n.due, today);
  return { s: n.start ? dayN(n.start, today) : e - (lead[n.size || "m"] - 1), e };
}
