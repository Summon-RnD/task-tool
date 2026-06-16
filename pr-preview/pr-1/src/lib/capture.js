import { CLIENTS, PEOPLE, TODAY } from "../data/constants.js";
import { canonHardware, findClient, inferOwnerByDomain, norm } from "./domain.js";

export const cap1 = (s) => (s ? s.replace(/^[a-z]/, (c) => c.toUpperCase()) : s);

export function isoCap(d) {
  return d.toISOString().slice(0, 10);
}

export function stripCaptions(t) {
  if (!t) return t;
  return t
    .replace(/^WEBVTT.*$/im, "")
    .split(/\r?\n/)
    .filter((l) => !/^\s*\d+\s*$/.test(l) && !/^\s*[\d:.,]+\s*-->\s*[\d:.,]+/.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function findOwnerId(t) {
  let best = null;
  let pos = -1;
  for (const [k, p] of Object.entries(PEOPLE)) {
    for (const a of p.al) {
      const i = t.indexOf(a);
      if (i > pos) {
        pos = i;
        best = k;
      }
    }
  }
  return best;
}

export function findDue(t, today = TODAY) {
  const d = new Date(today);
  const wd = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const inDays = t.match(/in (\d+) days?/);
  if (/\btoday\b/.test(t)) return isoCap(d);
  if (/\btomorrow\b/.test(t)) {
    d.setDate(d.getDate() + 1);
    return isoCap(d);
  }
  if (/\bnext week\b/.test(t)) {
    d.setDate(d.getDate() + 7);
    return isoCap(d);
  }
  if (inDays) {
    d.setDate(d.getDate() + +inDays[1]);
    return isoCap(d);
  }
  const wi = wd.findIndex((w) => new RegExp("\\b" + w + "\\b").test(t));
  if (wi > -1) {
    const delta = (wi - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + delta);
    return isoCap(d);
  }
  return null;
}

export function findSize(t) {
  const m = t.match(/\b(extra large|x-?large|xl|small|medium|large)\b/);
  if (!m) return null;
  return (
    {
      small: "s",
      medium: "m",
      large: "l",
      xl: "xl",
      "x-large": "xl",
      xlarge: "xl",
      "extra large": "xl",
    }[m[1]] || null
  );
}

export function normalizeProposal(raw) {
  let ruid = 0;
  const projects = (raw.projects || [])
    .map((p) => ({
      uid: ++ruid,
      accepted: true,
      name: cap1(p.name || "New project"),
      owner: p.owner || null,
      due: p.due || null,
      client: p.client || findClient(" " + (p.name || "") + " ") || null,
      tasks: (p.tasks || []).map((t) => {
        const ti = canonHardware(cap1(t.title || ""));
        return {
          uid: ++ruid,
          accepted: true,
          title: ti,
          owner: t.owner || inferOwnerByDomain(ti) || null,
          due: t.due || null,
          size: t.size || null,
          client: t.client || null,
          subs: (t.subs || []).map((s) => {
            const si = canonHardware(cap1(s.title || ""));
            return {
              uid: ++ruid,
              accepted: true,
              title: si,
              owner: s.owner || inferOwnerByDomain(si) || null,
              due: s.due || null,
              size: s.size || null,
            };
          }),
        };
      }),
    }))
    .filter((p) => p.name);
  return { assistantSay: raw.assistantSay || "", projects };
}

export function mockTranscript(text) {
  const lc = norm(text);
  const mentioned = CLIENTS.filter(
    (c) => lc.includes(norm(c.name)) || c.al.some((a) => lc.includes(norm(a)))
  );
  const VSRC =
    "install|build|fix|implement|test|deploy|order|write|design|integrate|ship|prepare|configure|run|benchmark|schedule|review|deliver|set ?up|mount|wire|calibrate|debug|develop|create|add|update|replace|repair|assemble|program|tune|investigate|source|procure";
  const VERBS = new RegExp("\\b(" + VSRC + ")\\b", "i");
  const splitAnd = new RegExp(
    "(?:,\\s*)?\\b(?:and|then|also)\\b\\s+(?=(?:we\\s+|i\\s+|they\\s+|the client\\s+|please\\s+|to\\s+)?(?:" +
      VSRC +
      ")\\b)",
    "i"
  );
  const clauses = text
    .split(/[.;\n]+/)
    .flatMap((c) => c.split(splitAnd))
    .map((s) => (s || "").trim())
    .filter(Boolean);
  const tasks = [];
  clauses.forEach((cl) => {
    if (!VERBS.test(cl)) return;
    const FILLER =
      /^(?:the client wants us to|the client wants|they want us to|they want to|they want|we need to|we should|we'?ll|we|i need to|i'?ll|i|and|then|also|so|separately|additionally|internally|meanwhile|next|first|second|third|finally|please|can you|make sure to|let'?s|for)[,]?\s+/i;
    let frag = cl.trim();
    let prev;
    do {
      prev = frag;
      frag = frag.replace(FILLER, "").trim();
    } while (frag !== prev);
    CLIENTS.forEach((c) => {
      frag = frag.replace(new RegExp("^" + c.name + "\\s*,?\\s*", "i"), "").trim();
    });
    frag = frag.replace(/^to\s+/i, "").trim();
    if (frag.length < 4) return;
    frag = canonHardware(frag);
    const client = findClient(" " + cl.toLowerCase() + " ");
    tasks.push({
      title: cap1(frag).slice(0, 90),
      owner: inferOwnerByDomain(frag),
      due: findDue(" " + cl.toLowerCase() + " "),
      size: findSize(cl.toLowerCase()),
      client,
      subs: [],
    });
  });
  const projects = [];
  const getProj = (name, client) => {
    let p = projects.find((x) => x.name === name);
    if (!p) {
      p = { name, client: client || null, owner: null, due: null, tasks: [] };
      projects.push(p);
    }
    return p;
  };
  if (mentioned.length) {
    tasks.forEach((tk) => {
      const cl = tk.client || mentioned[0].name;
      getProj("Pilot - " + cl, cl).tasks.push(tk);
    });
    mentioned.forEach((c) => getProj("Pilot - " + c.name, c.name));
  } else {
    const p = getProj("New engineering work", null);
    tasks.forEach((tk) => p.tasks.push(tk));
  }
  projects.forEach((p) => {
    const cnt = {};
    p.tasks.forEach((t) => {
      if (t.owner) cnt[t.owner] = (cnt[t.owner] || 0) + 1;
    });
    p.owner = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || null;
  });
  const nT = projects.reduce((a, p) => a + p.tasks.length, 0);
  return {
    assistantSay: `I identified ${projects.length} project${projects.length !== 1 ? "s" : ""} and ${nT} task${nT !== 1 ? "s" : ""} from this conversation.`,
    projects,
  };
}
