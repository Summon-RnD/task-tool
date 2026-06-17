import { CLIENTS, DOMAIN_RULES, HARDWARE_VOCAB, PEOPLE } from "../data/constants.js";

export function norm(s) {
  return " " + (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " ";
}

export function inferOwnerByDomain(t) {
  const s = " " + (t || "").toLowerCase() + " ";
  for (const r of DOMAIN_RULES) {
    for (const k of r.kw) {
      if (s.includes(k)) return r.o;
    }
  }
  return null;
}

export function canonHardware(s) {
  if (!s) return s;
  return s
    .replace(/\bel[\s-]?0?5\b/ig, "EL05")
    .replace(/\brs[\s-]?0*(\d{1,2})\b/ig, (m, n) => "RS" + String(n).padStart(2, "0"))
    .replace(/\bd[\s-]?wave\b/ig, "D-Wave")
    .replace(/\bfeetech\b/ig, "Feetech")
    .replace(/\brobstride\b/ig, "Robstride");
}

export function findClient(t) {
  const s = norm(t);
  for (const c of CLIENTS) {
    if (s.includes(norm(c.name))) return c.name;
    for (const a of c.al) {
      if (s.includes(norm(a))) return c.name;
    }
  }
  return null;
}

export function buildRespMapText() {
  return Object.entries(PEOPLE)
    .map(([id, p]) => `- ${p.name} (id "${id}"; voice transcription often mis-hears this name as: ${p.al.join(", ")}): ${p.role}`)
    .join("\n");
}

export function buildVocabText() {
  return (
    `HARDWARE (use these exact spellings):\n- ${HARDWARE_VOCAB.join("\n- ")}\n` +
    `KNOWN CLIENTS (use these exact spellings):\n- ${CLIENTS.map((c) => c.name).join("\n- ")}`
  );
}
