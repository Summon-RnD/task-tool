import { readFileSync, writeFileSync } from "fs";

const mainPath = "src/app/main.js";
let src = readFileSync(mainPath, "utf8");

const preamble = `import {
  PEOPLE, TODAY, HARDWARE_VOCAB, CLIENTS,
  SIZE_PTS, SIZE_NAMES, LEAD, ZOOMS, GBAR_H,
  R0G, R1G, SPAN_G, TODAY_PX,
  C_LATE, C_TODAY, C_RADAR, C_LATER, C_DONE,
} from "../data/constants.js";
import { inferOwnerByDomain, canonHardware, findClient, buildRespMapText, buildVocabText, norm as _norm } from "../lib/domain.js";
import {
  createTaskFactory, flat, findPath as findPathIn, counts, pct, taskDone,
  taskDoneAt as taskDoneAtIn, contains, depthOf as depthOfIn, heightOf, fitsDepth as fitsDepthIn,
} from "../lib/tree.js";
import { createDateHelpers } from "../lib/dates.js";
import {
  cap1, stripCaptions, findOwnerId, findDue, findSize,
  normalizeProposal, mockTranscript, isoCap,
} from "../lib/capture.js";

`;

const dataStart = src.indexOf("/* ================= sample data ================= */");
src = preamble + src.slice(dataStart);

// Remove constants and domain helpers now imported from modules (through RESP_MAP_TEXT block)
src = src.replace(
  /const PEOPLE = \{[\s\S]*?const VOCAB_TEXT=[\s\S]*?;\n\n/,
  `const RESP_MAP_TEXT = buildRespMapText();\nconst VOCAB_TEXT = buildVocabText();\n\n`
);

src = src.replace(
  /let UID = 0; const T=\(title,o,opts=\{\}\)=>[\s\S]*?;\nconst SIZE_PTS=\{s:1,m:2,l:4,xl:8\}, SIZE_NAMES=\{s:"S",m:"M",l:"L",xl:"XL"\};\nconst LEAD=\{s:1,m:3,l:7,xl:14\};[^\n]*\n\n/,
  `const { T } = createTaskFactory();\n\n`
);

// Tree helpers
src = src.replace(
  /const flat=\(nodes,fn,depth=0,path=\[\]\)=>[\s\S]*?;\nconst findPath=\(id,nodes=DATA,path=\[\]\)=>[\s\S]*?;\nfunction counts\(n\)[\s\S]*?return \{done:d,total:t\}; \}\nconst pct=n=>[\s\S]*?;\n/,
  ""
);

src = src.replace(
  /function progFrac\(n\)\{ let done=0,tot=0; flat\(\[n\],x=>[\s\S]*?return tot\?done\/tot:0; \}\n/,
  "const progFrac = (n) => { let done = 0, tot = 0; flat([n], (x) => { if (x.children.length) return; const w = SIZE_PTS[x.size || \"m\"]; tot += w; if (x.done) done += w; }); return tot ? done / tot : 0; };\n"
);

src = src.replace(
  /const taskDone=n=>!n\.children\.length\?n\.done:pct\(n\)===100;\nconst taskDoneAt=n=>\{ let m=null;[\s\S]*?return m; \};\n/,
  "const taskDoneAt = (n) => taskDoneAtIn(n, TODAY);\n"
);

// Gantt date helpers
src = src.replace(
  /const R0G=0, R1G=90, SPAN_G=R1G-R0G;[^\n]*\nconst ZOOMS=\[[\s\S]*?;\nlet ZOOM=2, showDone=false;\nconst GBAR_H=\{s:26,m:34,l:44,xl:56\};\nconst dayN=iso=>[\s\S]*?;\nconst dayIso=d=>[\s\S]*?;\nconst barSpan=n=>[\s\S]*?;\n/,
  `let ZOOM = 2, showDone = false;\nconst {\n  dayN, dayIso, barSpan, workDays, barColor, barGeom,\n  rollupSpan, spanFor, leafWeight, progWD, isUrgent, fmtD,\n} = createDateHelpers(TODAY);\n`
);

src = src.replace(
  /const C_LATE="[^"]*", C_TODAY="[^"]*", C_RADAR="[^"]*", C_LATER="[^"]*", C_DONE="[^"]*";\nfunction barColor\(e,s,done\)\{[\s\S]*?return C_LATER;[^\n]*\n\}\n/,
  ""
);

src = src.replace(
  /function rollupSpan\(n\)\{[\s\S]*?return e===-Infinity\?barSpan\(n\):\{s,e\}; \}\nconst spanFor=n=>n\.children\.length\?rollupSpan\(n\):barSpan\(n\);\n/,
  ""
);

src = src.replace(
  /function workDays\(s,e\)\{[\s\S]*?return c; \}\nfunction leafWeight\(n\)\{[\s\S]*?return w>0\?w:1; \}\n/,
  ""
);

src = src.replace(
  /function progWD\(n\)\{[\s\S]*?return tot\?done\/tot:0; \}\n/,
  ""
);

src = src.replace(
  /function isUrgent\(n\)\{[\s\S]*?return !isNaN\(s\)&&s<=0; \}\n/,
  ""
);

src = src.replace(
  /const fmtD=iso=>new Date\(iso\)\.toLocaleDateString\("en-GB",\{day:"numeric",month:"short"\}\);\n/,
  ""
);

src = src.replace(
  /function barGeom\(s,e,done\)\{[\s\S]*?return \[cs,Math\.min\(Math\.max\(re,cs\+0\.5\),R1G\)\];\n\}\n/,
  ""
);

// Tree depth helpers near detach
src = src.replace(
  /const contains=\(n,id\)=>n\.id===id\|\|n\.children\.some\(c=>contains\(c,id\)\);\nconst depthOf=id=>findPath\(id\)\.length-1;\nconst heightOf=n=>n\.children\.length\?1\+Math\.max\(\.\.\.n\.children\.map\(heightOf\)\):0;\nconst fitsDepth=\(node,destId\)=>depthOf\(destId\)\+1\+heightOf\(node\)<=2;\n/,
  `const findPath = (id, nodes = DATA, path = []) => findPathIn(id, nodes, path);\nconst depthOf = (id) => depthOfIn(id, DATA);\nconst fitsDepth = (node, destId) => fitsDepthIn(node, destId, DATA);\n`
);

// Capture helpers
src = src.replace(
  /function findOwnerId\(t\)\{ let best=null,pos=-1;[\s\S]*?return best; \}\nfunction findDue\(t\)\{[\s\S]*?return null; \}\nfunction findSize\(t\)\{[\s\S]*?return \{small:"s"[\s\S]*?\}\[m\[1\]\]\|\|null; \}\nconst cap1=s=>s\? s\.replace\(\/\^\[a-z\]\/,c=>c\.toUpperCase\(\)\):s;\n/,
  ""
);

src = src.replace(
  /function mockTranscript\(text\)\{[\s\S]*?return \{assistantSay:`I identified \$\{projects\.length\} project\$\{projects\.length!==1\?"s":""\} and \$\{nT\} task\$\{nT!==1\?"s":""\} from this conversation\.`,projects\};\n\}\n/,
  ""
);

src = src.replace(
  /function normalizeProposal\(raw\)\{ RUID=0;[\s\S]*?return \{assistantSay:raw\.assistantSay\|\|"",projects\};\n\}\n/,
  "let RUID = 0;\nfunction normalizeProposalWrapped(raw) { RUID = 0; return normalizeProposal(raw); }\n"
);

src = src.replace(/normalizeProposal\(/g, "normalizeProposalWrapped(");

src = src.replace(
  /function stripCaptions\(t\)\{ if\(!t\) return t;[\s\S]*?\.trim\(\); \}\n/,
  ""
);

// isoCap used in captureContext - check if defined in main
if (!src.includes("function isoCap")) {
  // isoCap imported from capture.js
}

const globals = `
const _globals = {
  toggleSearch, openTeam, micFabTap, openTranscript, toggleSettings, toggleSidebar, closeSettings,
  toggleFlyout, toggleFocus, toggleShowDone, toggleSubs, closeCapture, toggleCapLang, minimizeCapture,
  sendTurn, restoreCapture, skipKey, saveKey, clearKey, closeTranscript, runTranscript, closeReview,
  closeTeam, closeSheet, setFilter, setScaleView, ding, toggleDone, openDetail, setZoom, setGView,
  toggleExp, updTask, refreshBarMenu, addChild, addProject, deleteTask, addCapTask, barDown, barContext, pickSearch,
  projDown, rowDown,
  uploadPhoto, removePhoto, rvToggle, rvText, rvOwner, rvDue, rvSize, pushApproved, attachTranscript,
  doSearch, refreshCard, delCapTask, setTask, setTaskOwner, setTaskSize, setSub, setSubOwner, addSub,
  delSub, commitCapture, openTranscript, openReview, openTeam, openCapture, openDetail, toggleListen,
  stopListen, renderAll, setGView, toggleSubs, toggleFocus, toggleShowDone, setZoom, moveTask,
};
Object.assign(window, _globals);
`;

src = src.replace(/renderAll\(\);\s*$/, `renderAll();\n${globals}`);

writeFileSync(mainPath, src);
console.log("Patched", mainPath);
