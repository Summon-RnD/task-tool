import {
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
import { startBoardSync } from "../lib/board-sync.js";
import { buildSampleTasks } from "../data/sample-tasks.js";

/* ================= sample data ================= */
/* al = ASR aliases: common Whisper mishearings of each name.
   In production this mapping is done by the extraction LLM given the roster,
   plus Whisper initial_prompt biasing ("Team: Jean, Florian, Iannis, …"). */
const RESP_MAP_TEXT = buildRespMapText();
const VOCAB_TEXT = buildVocabText();

const { T, setUid, getUid } = createTaskFactory();

const DATA = [];

const findPath = (id, nodes = DATA, path = []) => findPathIn(id, nodes, path);
const depthOf = (id) => depthOfIn(id, DATA);
const fitsDepth = (node, destId) => fitsDepthIn(node, destId, DATA);

/* ================= helpers ================= */
/* size-weighted progress (0..1): done size-points / total size-points across the leaves */
const progFrac = (n) => { let done = 0, tot = 0; flat([n], (x) => { if (x.children.length) return; const w = SIZE_PTS[x.size || "m"]; tot += w; if (x.done) done += w; }); return tot ? done / tot : 0; };
function dueChip(due,done){ if(!due||done) return "";
  const dd=Math.round((new Date(due)-TODAY)/864e5);
  const cls=dd<0?"overdue":dd<=3?"soon":"";
  const lbl=dd<0?`${-dd}d overdue`:dd===0?"Due today":dd===1?"Due tomorrow":"Due "+new Date(due).toLocaleDateString("en-GB",{day:"numeric",month:"short"});
  return `<span class="chip due ${cls}">${lbl}</span>`; }
const prChip=p=>({high:'<span class="chip p-high">High</span>',med:'<span class="chip p-med">Medium</span>',low:'<span class="chip p-low">Low</span>'})[p];
const av=(pid,cls="sm")=>{const p=PEOPLE[pid];return p.photo
  ? `<span class="av ${cls}" style="background-image:url(${p.photo});background-size:cover;background-position:center"></span>`
  : `<span class="av ${cls}" style="background:${p.color}">${p.initials}</span>`;};
const GRIP_SVG='<svg width="11" height="17" viewBox="0 0 11 17" fill="currentColor"><circle cx="2.2" cy="2.5" r="1.8"/><circle cx="2.2" cy="8.5" r="1.8"/><circle cx="2.2" cy="14.5" r="1.8"/><circle cx="8.8" cy="2.5" r="1.8"/><circle cx="8.8" cy="8.5" r="1.8"/><circle cx="8.8" cy="14.5" r="1.8"/></svg>';

/* ================= undo (ctrl/cmd+Z) ================= */
const UNDO=[];
let requestSave = () => {};
function snap(){ UNDO.push(JSON.stringify(DATA)); if(UNDO.length>60) UNDO.shift(); requestSave(); }
function undo(){ if(!UNDO.length) return;
  DATA.splice(0,DATA.length,...JSON.parse(UNDO.pop()));
  closeSheet(); ding(0); renderAll(); requestSave(); }
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){ closeSheet(); closeCapture(); closeTeam(); closeBarMenu(); closeTranscript(); closeReview(); hideTip(); return; }
  if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==="z"){
    if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return; // let fields keep their own undo
    e.preventDefault(); undo(); }});

/* ================= dashboard ================= */
let lastTilt=0, ownerFilter="all";
const want=o=>ownerFilter==="all"||o===ownerFilter;
function setFilter(k){ ownerFilter=k; closeFlyouts(); setTimeout(renderAll,0); }
/* one roll-out open at a time; expandable icons stay lit while their options are out */
function closeFlyouts(exceptId){
  document.querySelectorAll(".gfctl.open").forEach(c=>{ if(c.id!==exceptId){ c.classList.remove("open");
    if(c.classList.contains("gfexp")){ const b=c.querySelector(".gficon"); if(b)b.classList.remove("on"); } } });
}
function toggleFlyout(name){
  const c=document.getElementById("ctl-"+name); if(!c) return;
  const willOpen=!c.classList.contains("open");
  closeFlyouts(willOpen?c.id:null);
  c.classList.toggle("open",willOpen);
  const b=c.querySelector(".gficon"); if(b) b.classList.toggle("on",willOpen);
}
let _descTimer=null;
/* toggles flash a one-line description, then it rolls back in */
function flashDesc(name,text){
  const c=document.getElementById("ctl-"+name); if(!c) return;
  closeFlyouts(c.id);
  const dd=c.querySelector(".gfdesc"); if(dd&&text) dd.textContent=text;
  c.classList.add("open"); clearTimeout(_descTimer);
  _descTimer=setTimeout(()=>c.classList.remove("open"),1800);
}
/* click anywhere outside a control closes any open roll-out */
document.addEventListener("pointerdown",e=>{ if(!e.target.closest(".gfctl")) closeFlyouts(); },true);
/* owners are an always-visible segmented row of avatars (built once, re-rendered on change) */
function renderFilter(){
  const pop=document.getElementById("gfilterPop");
  if(pop) pop.innerHTML=
    `<button class="${ownerFilter==='all'?'active':''}" title="Everyone" onclick="setFilter('all')"><span class="av" style="background:#aeb4bf;color:#fff;font-size:9px">All</span></button>`+
    Object.entries(PEOPLE).map(([k,p])=>
      `<button class="${ownerFilter===k?'active':''}" title="${p.name}" onclick="setFilter('${k}')">${av(k)}</button>`).join("");
  // light the collapsed owner icon when a specific person is filtered (so it's clear a filter is on)
  const pb=document.getElementById("gpeoplebtn"); if(pb) pb.classList.toggle("gactive",ownerFilter!=="all");
}
let SCALE_SUB=false; // false = task view (top-level tasks), true = subtask view (leaves)
function setScaleView(sub){ SCALE_SUB=sub; renderDash(); }
const taskDoneAt = (n) => taskDoneAtIn(n);
function renderDash(){
  renderGantt();
  if(!document.getElementById("myday")) return; // this version runs without the scale pane
  const sv=document.getElementById("scview");
  if(sv) sv.innerHTML=
    `<button class="${SCALE_SUB?'':'active'}" onclick="setScaleView(false)">Tasks</button>`+
    `<button class="${SCALE_SUB?'active':''}" onclick="setScaleView(true)">Subtasks</button>`;
  const inView=(n,depth)=>SCALE_SUB?!n.children.length:depth===1;
  const mine=[];
  flat(DATA,(n,depth,path)=>{ if(!inView(n,depth)||!want(n.owner)||taskDone(n)) return;
    const dd=n.due?Math.round((new Date(n.due)-TODAY)/864e5):null;
    mine.push({n,proj:(path[0]||n).title,dd,dn:false});
  });
  // balance scale over the selected time window: outstanding work weighs the left arm,
  // work finished within the window counterweights on the right
  const HZ=ZOOMS[ZOOM].h;
  const myLate=mine.filter(x=>x.dd!==null&&x.dd<0).sort((a,b)=>a.dd-b.dd);
  const myToday=mine.filter(x=>x.dd===0);
  const upcoming=HZ>0?mine.filter(x=>x.dd!==null&&x.dd>0&&x.dd<=HZ).sort((a,b)=>a.dd-b.dd):[];
  const banked=[];
  flat(DATA,(n,depth,path)=>{ if(!inView(n,depth)||!want(n.owner)||!taskDone(n)) return;
    const da=taskDoneAt(n); if(!da) return;
    const ago=Math.round((TODAY-new Date(da))/864e5);
    if(ago>=0&&ago<=Math.max(HZ,0)) banked.push({n,proj:(path[0]||n).title,dn:true}); });
  const PT=x=>SIZE_PTS[x.n.size||"m"];
  const pill=(x,cls,side)=>`<div class="pill ${cls} side-${side} sz-${x.n.size||'m'}" data-full="${x.n.title} — ${PEOPLE[x.n.owner].name} · ${x.proj}">
      <button class="pop ${x.dn?'on':''}" onclick="ding(4);toggleDone(${x.n.id})" aria-label="${x.dn?'Undo':'Mark done'}">${x.dn?'✓':''}</button>
      <button class="pbody" onclick="openDetail(${x.n.id})"><span class="t">${x.n.title}</span></button>
      ${av(x.n.owner,"xs")}
    </div>`;
  let lt=0,rt=0;
  // angry-birds physics: late = heaviest arm (3×), start-today middle (2×), due-today lightest (1×)
  const leftHtml=[
    ...myLate.map(x=>{lt+=PT(x)*3;return pill(x,"late","l");}),
    ...myToday.map(x=>{lt+=PT(x)*2;return pill(x,"today","l");}),
    ...upcoming.map(x=>{lt+=PT(x)*1;return pill(x,"soon","l");})].join("");
  const rightHtml=banked.map(x=>{rt+=PT(x)*2;return pill(x,"done","r");}).join("");
  let tilt=Math.max(-9,Math.min(9,(lt-rt)*0.8));
  document.getElementById("myday").innerHTML=`
    <div class="scalewrap" id="scaleEl">
      <div class="beam" id="beamEl" style="transform:translateX(-50%) rotate(${-lastTilt}deg)">
        <div class="pile" id="pileEl">${leftHtml}${rightHtml}</div>
        <div class="bar"></div>
      </div>
      <div class="fulcrum" id="fulcrumEl"></div>
    </div>
    <div class="verdict"><span style="color:var(--red)">late</span> · <span style="color:var(--accent)">due today</span>${HZ>0?` · <span style="color:var(--green)">${({7:"due this week",21:"due in 3 weeks",42:"due in 6 weeks"})[HZ]}</span>`:""} · <span style="color:var(--ink-3)">${HZ>0?"done this period":"done today"} ✓</span></div>`;
  sizeScale();
  settleScale(lastTilt);   // position pills synchronously, then animate to the new tilt
  if(typeof requestAnimationFrame!=="undefined")
    requestAnimationFrame(()=>requestAnimationFrame(()=>applyTilt(tilt)));
  lastTilt=tilt;
}
const SPLIT_MQ="(min-width:1100px) and (orientation:landscape)";
function applyTilt(tilt){
  const b=document.getElementById("beamEl"); if(!b) return;
  b.style.transform=`translateX(-50%) rotate(${-tilt}deg)`;
  settleScale(tilt);
}
/* physics layout, in plank coordinates: u = distance along the beam, v = height above it.
   Pills lie parallel to the plank and slide along it; on the dipping side they jam
   against the card wall (which, seen from the plank, is a slanted line — so the wall
   column staircases: each box rests a little further up-plank than the one below it).
   On the raised side they slide down against the fulcrum. */
function layoutScale(tilt){
  const wrap=document.getElementById("scaleEl"), beam=document.getElementById("beamEl"),
        pile=document.getElementById("pileEl");
  if(!wrap||!beam||!pile) return 999;
  const W=wrap.clientWidth||600, H=wrap.clientHeight||235;
  const B=beam.offsetWidth||W*0.96, C=B/2;
  const tan=Math.tan(Math.abs(tilt)*Math.PI/180);
  const els=s=>[...pile.querySelectorAll(".pill.side-"+s)];
  const boxes=[];
  const place=(list,wall,dir,limit,stairs)=>{
    const base=84+(Math.min(Math.abs(tilt),9)/9)*Math.max(H-230,0); // steeper tilt → taller jam
    let i=0,col=0,u=wall;
    while(i<list.length&&col<14){
      const last=dir>0?u>limit-170:u<limit+170;     // no room up-plank → last column takes the rest
      const cap=last?1e9:Math.max(56,base*Math.pow(0.6,col)); // heap shallows away from the wall
      let colW=0,v=0;
      while(i<list.length){
        const el=list[i], w=el.offsetWidth||140, h=el.offsetHeight||36;
        if(v>0&&v+h>cap) break;                     // column full → next column up-plank
        let u0=dir>0?u:u-w;
        if(stairs) u0=dir>0?Math.max(u0,wall+v*tan):Math.min(u0,wall-w-v*tan); // wall staircase
        u0=dir>0?Math.min(Math.max(u0,0),limit-w):Math.max(Math.min(u0,B-w),limit);
        el.style.left=u0+"px"; el.style.bottom=(7+v)+"px";
        boxes.push({u:u0,v,w,h});
        v+=h+5; colW=Math.max(colW,w); i++;
      }
      u+=dir*(colW+8); col++;
    }
  };
  const FW=36; // fulcrum keep-out
  if(tilt>=-0.5) place(els("l"),0,1,C-FW,tilt>0.5);  else place(els("l"),C-FW,-1,0,false);
  if(tilt<= 0.5) place(els("r"),B,-1,C+FW,tilt<-0.5); else place(els("r"),C+FW,1,B,false);
  // highest pile point in screen space (used to grow the stacked card)
  const phi=-tilt*Math.PI/180, cy=H-70;
  let minTop=cy;
  boxes.forEach(b=>{const yl=-(b.v+b.h+7);
    [b.u-C,b.u+b.w-C].forEach(xl=>{
      const y=cy+xl*Math.sin(phi)+yl*Math.cos(phi);
      if(y<minTop) minTop=y; });});
  return minTop;
}
/* lay out, and in the stacked "Everyone" view grow the card if the heap pokes out the top */
function settleScale(tilt){
  let minTop=layoutScale(tilt);
  const split=typeof matchMedia!=="undefined"&&matchMedia(SPLIT_MQ).matches;
  if(!split&&ownerFilter==="all"&&minTop<8){
    const wrap=document.getElementById("scaleEl");
    const H=(wrap.clientHeight||235)+(8-minTop);
    wrap.style.height=H+"px";
    document.getElementById("beamEl").style.top=(H-77)+"px";
    document.getElementById("fulcrumEl").style.top=(H-71)+"px";
    layoutScale(tilt);
  }
}
/* scale height — fills the whole left pane in the landscape split; fixed base otherwise */
function sizeScale(){
  const wrap=document.getElementById("scaleEl"); if(!wrap) return;
  const split=typeof matchMedia!=="undefined"&&matchMedia(SPLIT_MQ).matches;
  let H=235;
  if(split){ wrap.style.height=""; H=Math.max(wrap.clientHeight||235,200); }
  else wrap.style.height=H+"px";
  document.getElementById("beamEl").style.top=(H-77)+"px";
  document.getElementById("fulcrumEl").style.top=(H-71)+"px";
}
/* gantt — projects are groups with a flag pole on the due date and a wash behind their
   bars. Bar height tracks t-shirt size; each bar has a done-dot (left) and owner bubble
   (right). The window scrolls horizontally; zoom buttons set how many days fit on screen. */
/* chart starts at today - no dead space on the left */
let ZOOM = 2, showDone = false;
const {
  dayN, dayIso, barSpan, workDays, barColor, barGeom,
  rollupSpan, spanFor, leafWeight, progWD, isUrgent, fmtD,
} = createDateHelpers(TODAY);
/* bars carry only FOUR urgency colors (owner identity is in the bubble) */
/* vivid, candy-bright status palette (like the reference) */
/* a parent task's bar always spans its subtasks (start = earliest sub start, due = latest sub due),
   so a parent can never appear to start after its own subtasks */
/* effort weight = working days (Mon–Fri) inside a leaf's bar span, so the team doesn't have
   to size every item — a longer subtask simply weighs more. A set size still counts, because
   size feeds the bar's span via LEAD, which feeds this. Min 1 so a single-day or weekend-only
   item never weighs zero. */
/* duration-weighted completion (0..1) across a node's leaves — used for BOTH the project
   summary fill and the in-bar task fill, so "progress" means one consistent thing everywhere */
/* "today's priority" = work that has started, is due today, or is overdue (its bar start ≤ today) */
/* the today column has a FIXED pixel width at every zoom level; the other days share
   the remaining screen. TW = today's width expressed in "normal day" units, recomputed
   each render from the panel width. */
let TW = 2.2, SPAN_EFFV = SPAN_G + 1.2;
const uDay=t=>t<0?t:(t<1?t*TW:TW+(t-1));       // day → stretched-day units
const gx=t=>(uDay(t)-R0G)/SPAN_EFFV*100;       // day → % position on the track
/* a due date means END of that day, and open work never lives in the past:
   — done tasks keep their historical span
   — late and due-today tasks ALL span exactly the today box, ending ON the today line
   — future tasks start today at the earliest and end at the end of their due day */
/* re-renders triggered by clicks are deferred out of the input event: mutating the DOM
   while Chrome is still dispatching the click can wedge its hover/input pipeline
   (frozen cursor + dead hover until a tab switch) */
const defer=fn=>setTimeout(fn,0);
function toggleShowDone(){ showDone=!showDone; const b=$id("gdonebtn"); if(b)b.classList.toggle("on",showDone);
  defer(renderGantt); }
/* the control cluster is FIXED to the viewport so it stays put while the chart scrolls under it.
   At the top it sits just under the date ribbon; as the ribbon scrolls away it rises to the top. */
function placeFloat(){ const g=document.querySelector(".gantt"), fl=$id("gfloat");
  if(!g||!fl) return; const gr=g.getBoundingClientRect(), ax=document.querySelector(".gaxis");
  let top=gr.top+10;
  if(ax){ const ar=ax.getBoundingClientRect(); top=Math.max(top,ar.bottom+8); }
  fl.style.position="fixed";
  fl.style.right=Math.max(14,(window.innerWidth-gr.right)+14)+"px";
  fl.style.top=top+"px"; }
window.addEventListener("resize",()=>placeFloat());
const EXP=new Set(); // individually EXPANDED tasks (when the global toggle is off)
const COL=new Set(); // individually COLLAPSED tasks (when the global toggle is on)
/* a task's subtasks are open if: global toggle on AND not individually collapsed, OR
   global toggle off AND individually expanded — so the chevron always works either way */
const subOpen=id=>subsAll?!COL.has(id):EXP.has(id);
function toggleExp(id){ if(subsAll){ COL.has(id)?COL.delete(id):COL.add(id); }
  else { EXP.has(id)?EXP.delete(id):EXP.add(id); } defer(renderGantt); }
let subsAll=false;   // global show/hide all subtasks
function toggleSubs(){ subsAll=!subsAll; COL.clear();   // start each "show all" fully expanded
  const b=$id("gsubbtn"); if(b)b.classList.toggle("on",subsAll);
  defer(renderGantt); }
let focusToday=false;   // show only today's priorities (late + due today + started)
function toggleFocus(){ focusToday=!focusToday; const b=$id("gfocusbtn"); if(b)b.classList.toggle("on",focusToday);
  defer(renderGantt); }
let GVIEW="proj"; // "proj" | "tasks" | "subs"
function setGView(v){ GVIEW=v; defer(renderGantt); }
function setZoom(i){ ZOOM=i; setTimeout(renderAll,0); }   // drives the scale window and the gantt zoom
function renderGantt(){
  const VIS=ZOOMS[ZOOM].v;
  // fixed-width today box: convert TODAY_PX into day units for the current zoom + panel width.
  // On phones the box is narrower so the rest of the timeline isn't squeezed off-screen.
  const TPX=(typeof window!=="undefined"&&window.innerWidth<=740)?150:TODAY_PX;
  const host=document.querySelector(".gscroll")||document.getElementById("gantt");
  const PW=Math.max((host&&host.clientWidth)||0,360);
  const dayPx=Math.max((PW-TPX)/Math.max(VIS-1,1),3);
  TW=TPX/dayPx; SPAN_EFFV=SPAN_G+(TW-1);
  // calendar axis: month headers + one weekday-letter + number per day (weekly when too tight)
  const showDaily=dayPx>=20;
  const months=[]; let lastM=-1;
  for(let d=0;d<=R1G;d++){ const dt=new Date(dayIso(d)), m=dt.getFullYear()*12+dt.getMonth();
    if(m!==lastM){ lastM=m; months.push({d,label:dt.toLocaleDateString("en-GB",{month:"short",year:"numeric"})}); } }
  const dticks=[];
  for(let d=0;d<=R1G;d++){ const dt=new Date(dayIso(d)), wknd=dt.getDay()%6===0;
    if(showDaily||dt.getDay()===1||d===0) dticks.push({d,wd:"SMTWTFS"[dt.getDay()],num:dt.getDate(),wknd,today:d===0}); }
  const zoomEl=document.getElementById("gzoom");
  if(zoomEl){ // build once; afterwards only toggle classes (keeps the clicked button alive)
    if(!zoomEl.childElementCount)
      zoomEl.innerHTML=ZOOMS.map((z,i)=>`<button title="${z.l}" onclick="setZoom(${i})">${["D","1W","3W","6W"][i]}</button>`).join("");
    [...zoomEl.children].forEach((b,i)=>b.classList.toggle("active",ZOOM===i));
  }
  // keep the three toggle pictograms lit in line with their state
  [["gdonebtn",showDone],["gsubbtn",subsAll],["gfocusbtn",focusToday]].forEach(([id,on])=>{
    const b=document.getElementById(id); if(b) b.classList.toggle("on",on); });
  const gv=document.getElementById("gview"), GVKEYS=["proj","tasks"];
  if(gv){
    if(!gv.childElementCount)
      gv.innerHTML=[["proj","By project"],["tasks","Prioritized tasks"]]
        .map(([k,l])=>`<button onclick="setGView('${k}')">${l}</button>`).join("");
    [...gv.children].forEach((b,i)=>b.classList.toggle("active",GVIEW===GVKEYS[i]));
  }
  // calendar grid: faint day lines, firmer Monday lines, alternate weeks washed
  const wk=[0];
  for(let d=1;d<=R1G;d++) if(new Date(dayIso(d)).getDay()===1) wk.push(d);
  wk.push(R1G);
  const deco=[];
  for(let i=0;i<wk.length-1;i++) if(i%2===1)
    deco.push(`<div class="gwkband" style="left:${gx(wk[i])}%;width:${gx(wk[i+1])-gx(wk[i])}%"></div>`);
  for(let d=1;d<R1G;d++){ const mon=new Date(dayIso(d)).getDay()===1;
    deco.push(`<div class="${mon?'gweek':'gday'}" style="left:${gx(d)}%"></div>`); }
  months.forEach(m=>{ if(m.d>0) deco.push(`<div class="gmonthline" style="left:${gx(m.d)}%"></div>`); });
  const td=new Date(dayIso(0));
  const ord=n=>{const s=["th","st","nd","rd"],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);};
  const todayStr="Today, "+td.toLocaleDateString("en-GB",{weekday:"long"})+" "+ord(td.getDate())+" "+td.toLocaleDateString("en-GB",{month:"long"});
  const todayMid=(gx(0)+gx(1))/2;
  const rows=[deco.join("")+
    `<div class="gband" style="left:${gx(0)}%;width:${gx(1)-gx(0)}%"></div>
    <div class="gribbon">
    <div class="gmonths">${months.map((m,i)=>{const end=i+1<months.length?months[i+1].d:R1G+1;
      return `<span class="gmonth" style="left:${(gx(m.d)+gx(end))/2}%">${m.label}</span>`;}).join("")}</div>
    <div class="gtrack gaxis">${dticks.map(t=> t.today
      ? `<span class="gdaylbl today" style="left:${(gx(t.d)+gx(t.d+1))/2}%">${todayStr}</span>`
      : `<span class="gdaylbl ${t.wknd?'wknd':''}" style="left:${(gx(t.d)+gx(t.d+1))/2}%"><i class="wd">${t.wd}</i><i class="num">${t.num}</i></span>`).join("")}</div></div>`];
  let any=false;
  /* ctx (priority views only): {proj, parent, col} — bar takes the project colour and the
     tooltip carries the full story: where it lives, how big, how important */
  const barRow=(n,extra,isSub,ctx)=>{       // one chart row for a task or a subtask
    if(!n.due) return "";
    const {s,e}=spanFor(n), done=isSub?n.done:taskDone(n);
    if(e<R0G-14||s>R1G) return "";
    const late=!done&&e<0, [tcs,tce]=barGeom(s,e,done), sz=n.size||"m";
    const h=isSub?Math.max(15,Math.round(GBAR_H[sz]*0.62)):GBAR_H[sz]; // subtasks shorter than tasks
    // a task with subtasks shows its duration-weighted completion as a darker fill inside its
    // own bar (same two-tone idea as the project summary bar, applied in place)
    const hasKids=!isSub&&n.children.length>0, donePct=hasKids?Math.round(progWD(n)*100):0;
    const col=barColor(e,s,done);
    const fillBg=(hasKids&&!done&&donePct>0)
      ? `background-color:${col};background-image:linear-gradient(90deg,rgba(0,0,0,.26) 0 ${donePct}%,rgba(0,0,0,0) ${donePct}% 100%)`
      : `background:${col}`;
    const tip=`${n.title} · ${SIZE_NAMES[sz]} · ${fmtD(dayIso(e))}${late?' (late)':''}${hasKids?` · ${donePct}% done`:""}`+(ctx
      ?` — ${ctx.proj}${ctx.parent?" › "+ctx.parent:""} · ${({high:"high",med:"medium",low:"low"})[n.priority||"med"]} priority · ${PEOPLE[n.owner].name}`
      :"");
    return `<div class="grow"><div class="gtrack" data-full="${tip}" style="height:${h+4}px">
        <div class="gbar gsz-${sz} ${done?'gdone':''} ${isSub?'gsub':''}" data-tid="${n.id}" onpointerdown="barDown(event,${n.id},'move')"
          oncontextmenu="barContext(event,${n.id},this.getBoundingClientRect())"
          data-full="${tip}"
          style="height:${h}px;left:${gx(tcs)}%;width:${gx(tce)-gx(tcs)}%;${isSub
            ?`background:#fff;border:2px solid ${col};color:${col}`
            :fillBg}">
          <i class="ear el" onpointerdown="barDown(event,${n.id},'l')"></i>
          <span class="gava">${av(n.owner,"xs")}</span>
          <span class="ttl">${n.title}</span>
          <button class="gdot ${done?'on':''}" onpointerdown="event.stopPropagation()"
            onclick="event.stopPropagation();ding(4);toggleDone(${n.id})" aria-label="${done?'Undo done':'Mark done'}">${done?'✓':''}</button>
          <i class="ear er" onpointerdown="barDown(event,${n.id},'r')"></i>
        </div>${extra?`<div class="gexpw" style="left:calc(${gx(tce)}% + 5px)">${extra}</div>`:""}
        </div></div>`;
  };
  const chevFor=t=>{ const exp=subOpen(t.id);
    return t.children.length?`<button class="gexp" onpointerdown="event.stopPropagation()"
        onclick="event.stopPropagation();toggleExp(${t.id})" aria-label="${exp?'Hide':'Show'} subtasks">${exp?"▴":"▾"}</button>`:""; };
  // subtask visibility is controlled only by Show subtasks / per-task expansion — NOT by focus.
  // When focus is on AND subtasks are visible, only the urgent subtasks are included.
  const subRows=(t,ctx)=>(!subOpen(t.id))?"":t.children
      .filter(c=>want(c.owner)&&(showDone||!c.done)&&(!focusToday||isUrgent(c)))
      .map(c=>barRow(c,"",true,ctx?{proj:ctx.proj,parent:t.title,col:ctx.col}:null)).join("");
  if(GVIEW==="proj") DATA.forEach(p=>{
    let open=0, maxE=1, anyLeaf=false;
    flat([p],n=>{ if(n.children.length||!want(n.owner)) return;
      anyLeaf=true;
      if(!n.done) open++;
      if(n.due) maxE=Math.max(maxE,dayN(n.due)); });
    if(!anyLeaf&&!want(p.owner)) return;
    const col=PEOPLE[p.owner].color;
    // thin summary bar spanning the project's whole task range (earliest start → latest due)
    const sp=rollupSpan(p);
    const scs=Math.max(sp.s,R0G), sce=Math.max(Math.min(sp.e+1,R1G),scs+0.5);
    const taskRows=[...p.children]
      .filter(t=>{ let rel=want(t.owner);
        flat([t],x=>{ if(!x.children.length&&want(x.owner)) rel=true; }); return rel; })
      .filter(t=>showDone||!taskDone(t))
      .filter(t=>!focusToday||isUrgent(t))
      /* render in the project's own task order (no date sort) so manual reordering —
         from the project window or by dragging a bar — is reflected directly */
      .map(t=>barRow(t,chevFor(t),false,null)+subRows(t,null)).join("");
    if(focusToday&&!taskRows) return;     // nothing urgent in this project — hide it
    any=true;
    const prog=progWD(p), ppc=Math.round(prog*100), spanW=gx(sce)-gx(scs);
    // project bar thickness scales with the project's total weight (sum of its leaf size points)
    let pPts=0; flat([p],x=>{ if(x.children.length) return; pPts+=SIZE_PTS[x.size||"m"]; });
    const ph=Math.max(7,Math.min(20,Math.round(5+Math.sqrt(pPts)*2.2)));
    rows.push(`<div class="pgroup" data-pid="${p.id}">
      <div class="grow gsumrow" style="min-height:${18+ph+16}px"><div class="gtrack">
        <button class="gsumlbl" style="left:${gx(scs)}%" onpointerdown="projDown(event,${p.id})"
          data-full="${p.title} — ${ppc}% done · ${pPts} pts · ${open} open · due ${p.due?fmtD(p.due):"no date"} — click to manage, drag to reorder">${p.title}</button>
        <div class="gsumline" style="left:${gx(scs)}%;width:${spanW}%;height:${ph}px"></div>
        <div class="gsumfill" style="left:${gx(scs)}%;width:${spanW*prog}%;height:${ph}px"></div>
        <span class="gsumpct" style="left:${gx(sce)}%;top:${Math.round(18+ph/2-6)}px">${ppc}%</span>
      </div></div>
      ${taskRows}</div>`);
  });
  else{
    // priority views: project boxes drop away; the most urgent & biggest work floats to the top
    const wantTask=GVIEW==="tasks", PRW={high:0,med:1,low:2}, cand=[];
    flat(DATA,(n,depth,path)=>{
      if(wantTask?depth!==1:n.children.length>0) return;
      let rel=want(n.owner);
      if(wantTask&&!rel) flat([n],x=>{ if(!x.children.length&&want(x.owner)) rel=true; });
      if(!rel) return;
      if((wantTask?taskDone(n):n.done)&&!showDone) return;
      if(!n.due) return;
      const {s,e}=barSpan(n);
      if(e<R0G-14||s>R1G) return;
      const root=path[0]||n, par=path.length>1?path[path.length-2]:null;
      cand.push({n,e,root,par});
    });
    cand.sort((a,b)=>a.e-b.e
      ||SIZE_PTS[b.n.size||"m"]-SIZE_PTS[a.n.size||"m"]
      ||PRW[a.n.priority||"med"]-PRW[b.n.priority||"med"]);
    any=cand.length>0;
    rows.push('<div class="pflat">');
    cand.forEach(({n,root,par})=>{
      const ctx={proj:root.title,col:PEOPLE[root.owner].color,
                 parent:(!wantTask&&par&&par!==root)?par.title:null};
      rows.push(barRow(n,wantTask?chevFor(n):"",!wantTask,ctx));
      if(wantTask) rows.push(subRows(n,ctx));
    });
    rows.push('</div>');
  }
  document.getElementById("gantt").innerHTML=
    `<div class="gscroll"><div class="ginner" style="min-width:${(SPAN_EFFV/(VIS-1+TW)*100).toFixed(1)}%">`+
    rows.join("")+
    (any?"":'<div class="grow"><span style="color:var(--ink-3);font-size:13.5px;padding:6px 0">No scheduled tasks for this filter.</span></div>')+
    `</div></div>`;
  const sc=document.querySelector(".gscroll");
  sc.addEventListener("scroll",pinFlags,{passive:true});
  const gpane=document.querySelector(".gantt");
  if(gpane&&!gpane._floatBound){ gpane._floatBound=true; gpane.addEventListener("scroll",placeFloat,{passive:true}); }
  pinFlags(); placeFloat(); placeOverflowTitles();
  // unstick Chromium's hover hit-testing after the DOM swap (otherwise tooltips/hover
  // stay dead until you move the mouse or switch tabs)
  if(typeof requestAnimationFrame!=="undefined")
    requestAnimationFrame(kickHover);
}
/* After replacing #gantt's innerHTML, nudge native :hover (the done-dot and resize ears) back
   to life with a synchronous reflow. The TOOLTIP is intentionally NOT synthesized here — it is
   driven only by real hover events (see the hover module below). Synthesizing it from
   elementFromPoint made the tip pop on clicks (e.g. when a filter flyout closed and the
   hit-test fell through to a bar behind it). We only clear a now-stale tip. */
function kickHover(){
  try{
    document.body.style.pointerEvents="none";
    void document.body.offsetHeight;          // force synchronous reflow → refresh native :hover
    document.body.style.pointerEvents="";
  }catch(e){}
  if(typeof tipEl!=="undefined" && tipEl && !tipEl.isConnected) hideTip(); // hovered bar was replaced
}
/* keep project names visible: if a flag's pole is outside the scrolled viewport,
   pin the flag to the nearest edge with an arrow; it snaps back when the pole returns */
/* when a bar is too narrow to show even half its title, hide the inner label and print the
   full title as plain text just to the right of the bar (no background) */
function placeOverflowTitles(){
  document.querySelectorAll("#gantt .gttlout").forEach(x=>x.remove());
  document.querySelectorAll("#gantt .gtrack").forEach(track=>{
    track.querySelectorAll(":scope > .gbar").forEach(bar=>{
      const ttl=bar.querySelector(".ttl"); if(!ttl) return;
      const full=ttl.scrollWidth, vis=ttl.clientWidth;
      if(full>4 && vis<full*0.5){
        ttl.style.visibility="hidden";
        const off=track.querySelector(".gexpw")?34:8;   // clear the subtask chevron (5px gap + 26px button + slack)
        const right=parseFloat(bar.style.left||0)+parseFloat(bar.style.width||0);
        const lab=document.createElement("span");
        lab.className="gttlout"; lab.textContent=ttl.textContent.trim();
        lab.style.left="calc("+right+"% + "+off+"px)";
        track.appendChild(lab);
      } else ttl.style.visibility="";
    });
  });
}
function pinFlags(){
  const sc=document.querySelector(".gscroll"); if(!sc) return;
  const v0=sc.scrollLeft;
  sc.querySelectorAll(".gsumrow").forEach(row=>{
    const lbl=row.querySelector(".gsumlbl"), line=row.querySelector(".gsumline");
    if(!lbl||!line) return;
    // keep the project name visible: slide the label to the viewport's left edge as its
    // range line scrolls past, but never beyond the line's right end
    const ll=line.offsetLeft, lr=ll+line.offsetWidth;
    let left=Math.max(ll,v0+4);
    left=Math.min(left,Math.max(lr-46,ll));
    lbl.style.left=left+"px";
  });
}
window.addEventListener("resize",()=>{ sizeScale(); applyTilt(lastTilt); defer(renderGantt); });

/* --- floating "gripped pill" ghost, shared by bar drags and pop-up task drags --- */
function makeGhost(text,color){ const g=document.createElement("div");
  g.className="dragghost"; g.textContent=text;
  if(color) g.style.background=color;
  document.body.appendChild(g); return g; }
function placeGhost(g,e){ g.style.left=(e.clientX+16)+"px"; g.style.top=(e.clientY-34)+"px"; }
const rootOf=id=>findPath(id)[0];
function projUnder(e,dragId){
  const t=document.elementFromPoint(e.clientX,e.clientY)?.closest?.(".pgroup[data-pid]");
  return t&&+t.dataset.pid!==rootOf(dragId).id?t:null; }
function dropInto(groupEl,id){ const node=detach(id);
  findPath(+groupEl.dataset.pid).pop().children.push(node); }

/* --- bar dragging: move / resize ears / drop on a project pill --- */
let G=null, suppressCtx=0;
const siblingsOf=id=>{ const p=findPath(id); p.pop(); const par=p.pop(); return par?par.children:DATA; };
/* right-click (desktop) opens the quick menu — but a touch long-press also fires contextmenu,
   and that case already opened the detail popup, so swallow it for ~0.8s after a long-press */
function barContext(ev,id,rect){ ev.preventDefault();
  if(Date.now()-suppressCtx<800) return; openBarMenu(id,rect); }
function barDown(e,id,mode){
  if(e.button!==undefined && e.button>0) return; // right/middle mouse → let oncontextmenu open the quick menu
  e.preventDefault(); e.stopPropagation(); hideTip();
  const el=e.target.closest(".gbar"), track=el.parentElement;
  const n=findPath(id).pop(), {s,e:en}=barSpan(n);
  const touch=e.pointerType==="touch";
  el.classList.add("dragging");
  G={id,mode,el,n,touch,longTimer:null,ppd:track.getBoundingClientRect().width/SPAN_EFFV,
     x0:e.clientX,y0:e.clientY,s0:s,e0:en,s,e:en,moved:false,overProj:null,
     axis:mode==="move"?null:"date",reTo:null,reRow:null,  // move starts axis-undecided
     ghost:mode==="move"?makeGhost(n.title,el.style.background):null};
  if(G.ghost) G.ghost.style.display="none"; // appears once the bar actually moves
  // touch: a LONG-PRESS on a bar opens the full detail popup (a short tap opens the quick menu)
  if(touch && mode==="move"){
    G.longTimer=setTimeout(()=>{ if(!G||G.moved) return;
      document.removeEventListener("pointermove",barMove);
      document.removeEventListener("pointerup",barUp);
      document.removeEventListener("pointercancel",barUp);
      G.el.classList.remove("dragging"); G.el.style.opacity=""; if(G.ghost) G.ghost.remove();
      const nid=G.id; G=null; suppressCtx=Date.now();   // swallow the contextmenu this long-press will also fire
      if(navigator.vibrate){ try{navigator.vibrate(8);}catch(_){} } openDetail(nid);
    },480);
  }
  document.addEventListener("pointermove",barMove,{passive:false});
  document.addEventListener("pointerup",barUp);
  document.addEventListener("pointercancel",barUp);
}
function clearReMark(){ document.querySelectorAll(".grow.reinsb,.grow.reinsa")
  .forEach(x=>x.classList.remove("reinsb","reinsa")); }
/* vertical drag of a bar = reorder among its siblings (or drop into another project) */
function barReorderMove(ev){
  G.moved=true; G.el.style.opacity=".45";
  if(G.ghost){ G.ghost.style.display=""; G.ghost.textContent="⇅ "+G.n.title; placeGhost(G.ghost,ev); }
  clearReMark(); G.reTo=null; G.reRow=null;
  if(G.overProj){ G.overProj.classList.remove("gdropover"); G.overProj=null; }
  const el=document.elementFromPoint(ev.clientX,ev.clientY);
  const bar=el?.closest?.(".gbar[data-tid]"), sibs=siblingsOf(G.id);
  if(bar&&+bar.dataset.tid!==G.id&&sibs.some(s=>s.id===+bar.dataset.tid)){
    const row=bar.closest(".grow"), r=bar.getBoundingClientRect(), after=ev.clientY>r.top+r.height/2;
    row.classList.add(after?"reinsa":"reinsb"); G.reRow=row;
    G.reTo=sibs.findIndex(s=>s.id===+bar.dataset.tid)+(after?1:0);
  } else {                       // not over a sibling → offer to move into another project
    const t=projUnder(ev,G.id); G.overProj=t; if(t) t.classList.add("gdropover");
  }
}
function barMove(ev){
  if(!G) return;
  ev.preventDefault();
  // any real movement cancels a pending long-press (it's a drag, not a press)
  if(G.longTimer&&(Math.abs(ev.clientX-G.x0)>5||Math.abs(ev.clientY-G.y0)>5)){ clearTimeout(G.longTimer); G.longTimer=null; }
  if(G.axis===null){                         // decide intent on first real movement
    const dx=ev.clientX-G.x0, dy=ev.clientY-G.y0;
    if(Math.max(Math.abs(dx),Math.abs(dy))<5) return;
    G.axis=Math.abs(dy)>Math.abs(dx)*1.25?"reorder":"date";
  }
  if(G.axis==="reorder") return barReorderMove(ev);
  const dd=Math.round((ev.clientX-G.x0)/G.ppd);
  if(dd!==0) G.moved=true;
  if(G.mode==="move"){ G.s=G.s0+dd; G.e=G.e0+dd; }
  else if(G.mode==="l"){ G.s=Math.min(G.s0+dd,G.e0); }
  else { G.e=Math.max(G.e0+dd,G.s0); }
  const [cs,ce]=barGeom(G.s,G.e,G.n.done);
  G.el.style.left=gx(cs)+"%";
  G.el.style.width=(gx(ce)-gx(cs))+"%";
  if(G.ghost){ G.ghost.style.display=G.moved?"":"none";
    G.ghost.textContent=G.n.title+" · due "+fmtD(dayIso(G.e));
    placeGhost(G.ghost,ev); }
  if(G.mode==="move"){
    const t=projUnder(ev,G.id);
    if(G.overProj&&G.overProj!==t) G.overProj.classList.remove("gdropover");
    G.overProj=t; if(t) t.classList.add("gdropover");
  }
}
function barUp(e){
  document.removeEventListener("pointermove",barMove);
  document.removeEventListener("pointerup",barUp);
  document.removeEventListener("pointercancel",barUp);
  if(!G) return;                                   // long-press already handled it
  if(G.longTimer){ clearTimeout(G.longTimer); G.longTimer=null; }
  G.el.classList.remove("dragging"); G.el.style.opacity="";
  if(G.ghost) G.ghost.remove();
  clearReMark();
  if(e&&e.type==="pointercancel"){ if(G.overProj)G.overProj.classList.remove("gdropover"); G=null; return; }
  // vertical reorder / cross-project move
  if(G.axis==="reorder"){
    const dropped=G.overProj; if(dropped) dropped.classList.remove("gdropover");
    if(dropped&&fitsDepth(G.n,+dropped.dataset.pid)){ snap(); dropInto(dropped,G.id); G=null; ding(2); renderAll(); return; }
    const arr=siblingsOf(G.id), from=arr.findIndex(s=>s.id===G.id); let to=G.reTo;
    if(to!=null&&from>-1){ if(to>from) to--; if(to!==from){ snap(); const [nd]=arr.splice(from,1); arr.splice(to,0,nd); ding(2); } }
    G=null; renderAll(); return;
  }
  const n=G.n, dropped=G.overProj;
  if(dropped) dropped.classList.remove("gdropover");
  if(!G.moved&&!dropped){            // a tap/click that didn't drag
    const r=G.el.getBoundingClientRect(), touch=G.touch, mode=G.mode, nid=n.id; G=null;
    if(mode!=="move") return;        // tap on a resize ear → do nothing
    if(touch) openBarMenu(nid,r);    // mobile: tap = quick menu (long-press already gives the popup)
    else openDetail(nid);            // desktop: left-click = full detail popup
    return; }
  snap();
  if(G.mode==="move"){ n.due=dayIso(G.e); if(n.start) n.start=dayIso(G.s); }
  else if(G.mode==="l"){ n.start=dayIso(G.s); }
  else { if(!n.start) n.start=dayIso(G.s0); n.due=dayIso(G.e); }
  if(dropped) dropInto(dropped,n.id);
  G=null; ding(2); renderAll();
}

/* --- grip a row in a pop-up. Stay inside the pop-up → reorder the list.
       Drag outside it → the pop-up closes and you assign the item to another
       project (drop on its box) or task (drop on its bar), depth rules permitting. --- */
let RD=null;
function rowDown(e,id){
  e.preventDefault(); e.stopPropagation(); hideTip();
  const path=findPath(id), n=path[path.length-1], parent=path[path.length-2];
  RD={id,n,parentId:parent?parent.id:null,box:document.querySelector(".tbox"),
      mode:"reorder",over:null,toIdx:null,
      ghost:makeGhost(n.title,PEOPLE[n.owner].color)};
  placeGhost(RD.ghost,e);
  document.addEventListener("pointermove",rowMove,{passive:false});
  document.addEventListener("pointerup",rowUp);
  document.addEventListener("pointercancel",rowUp);
}
function clearRowMark(){ document.querySelectorAll(".ptask.insb,.ptask.insa")
  .forEach(x=>x.classList.remove("insb","insa")); }
function rowMove(e){
  e.preventDefault(); placeGhost(RD.ghost,e);
  if(RD.mode==="reorder"){
    const r=RD.box&&RD.box.getBoundingClientRect();
    if(!r||e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){
      RD.mode="assign"; RD.over=null; RD.toIdx=null;
      clearRowMark(); closeSheet();           // left the pop-up → reveal the timeline targets
    }else{
      clearRowMark(); RD.over=null; RD.toIdx=null;
      const t=document.elementFromPoint(e.clientX,e.clientY)?.closest?.(".ptask[data-cid]");
      if(t&&+t.dataset.cid!==RD.id){
        const tr=t.getBoundingClientRect(), after=e.clientY>tr.top+tr.height/2;
        t.classList.add(after?"insa":"insb");
        RD.over=t;
        RD.toIdx=[...RD.box.querySelectorAll(".ptask[data-cid]")].indexOf(t)+(after?1:0);
      }
      return;
    }
  }
  // assign mode: task bars first (finer target), then project boxes
  const el=document.elementFromPoint(e.clientX,e.clientY);
  let t=el?.closest?.(".gbar[data-tid]")||null;
  if(t){ const tid=+t.dataset.tid;
    if(tid===RD.id||tid===RD.parentId||contains(RD.n,tid)||!fitsDepth(RD.n,tid)) t=null; }
  if(!t){ const g=el?.closest?.(".pgroup[data-pid]");
    if(g){ const pid=+g.dataset.pid;
      if(pid!==RD.parentId&&fitsDepth(RD.n,pid)) t=g; } }
  if(RD.over&&RD.over!==t) RD.over.classList.remove("gdropover");
  RD.over=t; if(t) t.classList.add("gdropover");
}
function rowUp(){
  document.removeEventListener("pointermove",rowMove);
  document.removeEventListener("pointerup",rowUp);
  document.removeEventListener("pointercancel",rowUp);
  clearRowMark(); RD.ghost.remove();
  const S=RD; RD=null;
  if(S.mode==="reorder"){
    if(S.toIdx!=null&&S.parentId!=null){
      const parent=findPath(S.parentId).pop();
      const from=parent.children.findIndex(c=>c.id===S.id);
      let to=S.toIdx; if(to>from) to--;
      if(from>-1&&to!==from){ snap();
        const [nd]=parent.children.splice(from,1);
        parent.children.splice(to,0,nd);
        ding(2); renderAll(); openDetail(S.parentId); }
    }
    return; // released inside the pop-up: nothing moved, pop-up stays open
  }
  if(S.over){ S.over.classList.remove("gdropover");
    snap(); const node=detach(S.id);
    findPath(+(S.over.dataset.tid||S.over.dataset.pid)).pop().children.push(node);
    ding(2); renderAll(); }
}

/* --- drag a project flag vertically to reorder projects; a plain click opens the popup --- */
let PD=null;
function projDown(e,pid){
  e.preventDefault(); e.stopPropagation(); hideTip();
  PD={pid,started:false,x0:e.clientX,y0:e.clientY,over:null,pos:null,ghost:null};
  document.addEventListener("pointermove",projMove,{passive:false});
  document.addEventListener("pointerup",projUp);
  document.addEventListener("pointercancel",projUp);
}
function clearProjMark(){ document.querySelectorAll(".pgroup.insb,.pgroup.insa")
  .forEach(x=>x.classList.remove("insb","insa")); }
function projMove(e){
  e.preventDefault();
  if(!PD.started){
    if(Math.hypot(e.clientX-PD.x0,e.clientY-PD.y0)<6) return; // click tolerance
    PD.started=true;
    const p=DATA.find(x=>x.id===PD.pid);
    PD.ghost=makeGhost("⇅ "+p.title,PEOPLE[p.owner].color);
  }
  placeGhost(PD.ghost,e);
  clearProjMark(); PD.over=null;
  const t=document.elementFromPoint(e.clientX,e.clientY)?.closest?.(".pgroup[data-pid]");
  if(t&&+t.dataset.pid!==PD.pid){
    const r=t.getBoundingClientRect();
    PD.pos=e.clientY<r.top+r.height/2?"before":"after";
    t.classList.add(PD.pos==="before"?"insb":"insa"); PD.over=t;
  }
}
function projUp(){
  document.removeEventListener("pointermove",projMove);
  document.removeEventListener("pointerup",projUp);
  document.removeEventListener("pointercancel",projUp);
  clearProjMark();
  if(PD.ghost) PD.ghost.remove();
  const {pid,started,over,pos}=PD; PD=null;
  if(!started){ openDetail(pid); return; }
  if(!over) return;
  snap();
  const from=DATA.findIndex(x=>x.id===pid), [proj]=DATA.splice(from,1);
  let to=DATA.findIndex(x=>x.id===+over.dataset.pid);
  if(pos==="after") to++;
  DATA.splice(to,0,proj);
  ding(2); renderAll();
}

/* ---- moving tasks between projects/parents (via modal "Move to") ---- */
/* strict 3-level hierarchy: project (0) -> task (1) -> subtask (2) */
function detach(id){ const p=findPath(id), node=p.pop(), parent=p.pop();
  const arr=parent?parent.children:DATA; arr.splice(arr.indexOf(node),1); return node; }
function moveInto(id,dest){ if(!dest||id===dest||contains(findPath(id).pop(),dest))return false;
  if(!fitsDepth(findPath(id).pop(),dest)) return false; // would exceed 3 levels
  const target=findPath(dest).pop(); const node=detach(id);
  target.children.push(node); target.open=true; return true; }
function moveTask(id,dest){ snap();
  if(moveInto(id,+dest)){ renderAll(); openDetail(id); } else UNDO.pop(); }

function toggleDone(id){ snap(); const n=findPath(id).pop();
  const stamp=x=>x.doneAt=x.done?TODAY.toISOString().slice(0,10):null;
  if(!n.children.length){ n.done=!n.done; stamp(n); }
  else { const target=pct(n)!==100; flat([n],x=>{if(!x.children.length){x.done=target;stamp(x);}}); }
  renderAll(); }

/* ================= task modal — comprehensive & editable ================= */
/* ===== on-the-go bar menu: quick edits without the full detail sheet ===== */
let BARMENU=null;
const BM=document.createElement("div"); BM.id="barMenu"; BM.className="barmenu"; document.body.appendChild(BM);
function openBarMenu(id,anchor){
  const path=findPath(id); if(!path) return; const n=path.pop();
  if(anchor&&anchor.getBoundingClientRect) anchor=anchor.getBoundingClientRect();
  if(anchor) BM._anchor={left:anchor.left,right:anchor.right,top:anchor.top,bottom:anchor.bottom};
  const a=BM._anchor||{left:100,right:160,top:100,bottom:130};
  BM.innerHTML=`
    <div class="bm-lbl">Owner</div>
    <div class="bm-chips">${Object.entries(PEOPLE).map(([k,p])=>`<button class="bm-chip ${n.owner===k?'on':''}" title="${p.name}" onclick="updTask(${id},'owner','${k}',true);refreshBarMenu(${id})"><span class="av xs" style="background:${p.color}">${p.initials}</span></button>`).join("")}</div>
    <div class="bm-rw"><span class="bm-lbl">Size</span><span class="szseg">${["s","m","l","xl"].map(z=>`<button class="szb ${n.size===z?'on':''}" onclick="updTask(${id},'size','${n.size===z?'':z}',true);refreshBarMenu(${id})">${SIZE_NAMES[z]}</button>`).join("")}</span></div>
    <div class="bm-rw"><span class="bm-lbl">Due</span><input type="date" value="${n.due||''}" onchange="updTask(${id},'due',this.value,true)"></div>`;
  BM.classList.add("show"); BARMENU=id;
  const mw=BM.offsetWidth||236, mh=BM.offsetHeight||170, gap=8, vw=window.innerWidth, vh=window.innerHeight;
  // sit to the RIGHT of the pill (flip left only if there's no room)
  let left=a.right+gap; if(left+mw>vw-8) left=Math.max(8,a.left-mw-gap);
  // align with the pill's top and roll down; if that would overflow, align to its bottom and roll up
  let top=(a.top+mh<=vh-8)?a.top:Math.max(8,a.bottom-mh);
  top=Math.max(8,Math.min(top,vh-mh-8));
  BM.style.left=left+"px"; BM.style.top=top+"px";
}
function refreshBarMenu(id){ if(BARMENU===id) openBarMenu(id); }
function closeBarMenu(){ BM.classList.remove("show"); BARMENU=null; }
document.addEventListener("pointerdown",e=>{ if(BARMENU&&!e.target.closest("#barMenu")) closeBarMenu(); },true);

function updTask(id,f,v,quiet){ snap(); const n=findPath(id).pop();
  if(f==="title") n.title=v.trim()||n.title;
  else if(f==="owner") n.owner=v;
  else if(f==="priority") n.priority=v;
  else if(f==="due") n.due=v||null;
  else if(f==="start") n.start=v||null;
  else if(f==="size") n.size=v||null;
  renderAll(); if(!quiet&&f!=="title") openDetail(id); }
function deleteTask(id){ const n=findPath(id).pop();
  if(typeof confirm!=="undefined"&&!confirm('Delete "'+n.title+'"'+(n.children.length?" and its subtasks":"")+"?")) return;
  snap(); detach(id); closeSheet(); renderAll(); }
function addChild(id){ const el=document.getElementById("dSubNew"), v=el.value.trim(); if(!v) return;
  if(findPath(id).length>=3) return; // subtasks can't have children
  snap(); const n=findPath(id).pop(); n.children.push(T(cap1(v),n.owner,{d:n.due||null}));
  renderAll(); openDetail(id); }
function openDetail(id){
  const path=findPath(id); if(!path) return;
  const n=path[path.length-1], leaf=!n.children.length;
  document.getElementById("dCrumb").innerHTML=path.length>1
    ?path.slice(0,-1).map(x=>`<button onclick="openDetail(${x.id})">${x.title}</button>`).join(" › ")+" ›"
    :"Project";
  const ti=document.getElementById("dTitle");
  ti.value=n.title; ti.onchange=e=>updTask(id,"title",e.target.value);
  const par=path.length>1?path[path.length-2].id:null;
  const mopts=['<option value="">Move to…</option>'];
  flat(DATA,(x,depth)=>{ if(contains(n,x.id))return;
    if(depth+1+heightOf(n)>2) return; // keep the 3-level hierarchy
    mopts.push(`<option value="${x.id}" ${x.id===par?'disabled':''}>${"&nbsp;".repeat(depth*3)}${x.title}${x.id===par?" (current)":""}</option>`); });
  // Size: leaves carry an editable t-shirt size; projects/parent tasks SHOW the rolled-up
  // point total (sum of their leaves' size points) — not a field the user fills in.
  let _szPts=0; flat([n],x=>{ if(x.children.length) return; _szPts+=SIZE_PTS[x.size||"m"]; });
  const sizeFld=leaf
    ? `<div class="frow"><span class="lbl">Size</span><select onchange="updTask(${id},'size',this.value)">
        <option value="">—</option>${["s","m","l","xl"].map(z=>`<option value="${z}" ${n.size===z?'selected':''}>${SIZE_NAMES[z]} · ${SIZE_PTS[z]} pts</option>`).join("")}</select></div>`
    : `<div class="frow"><span class="lbl">Size</span><span style="flex:1;font-size:15px;font-weight:700;color:var(--ink)">${_szPts} pts</span></div>`;
  document.getElementById("dBody").innerHTML=`
    <div class="frow"><span class="lbl">Owner</span>${av(n.owner)}<select onchange="updTask(${id},'owner',this.value)">
      ${Object.entries(PEOPLE).map(([k,pp])=>`<option value="${k}" ${k===n.owner?'selected':''}>${pp.name}</option>`).join("")}</select></div>
    <div class="frow"><span class="lbl">Due</span><input type="date" value="${n.due||""}" onchange="updTask(${id},'due',this.value)">${dueChip(n.due,leaf&&n.done)}</div>
    ${sizeFld}
    ${leaf?`<div class="frow"><span class="lbl">Status</span>
      <button class="chip" style="${n.done?'background:var(--green-soft);color:var(--green)':'background:#eef0f4;color:var(--ink-2)'}"
          onclick="toggleDone(${id});openDetail(${id})">${n.done?"Done ✓ — tap to reopen":"In progress — tap to complete"}</button></div>`:""}
    <div class="frow"><span class="lbl">Move to</span><select onchange="moveTask(${id},this.value)">${mopts.join("")}</select></div>
    ${path.length>=3?"":`<div class="subhdr">${path.length>1?"Subtasks":"Tasks — grip ⠿ to drag onto another project"}</div>`}
    ${n.children.map(ch=>{ const lp=pct(ch), lleaf=!ch.children.length;
      let _cp=0; flat([ch],x=>{ if(x.children.length) return; _cp+=SIZE_PTS[x.size||"m"]; });
      const szCtl=lleaf
        ? `<select class="rowsz" title="Weight (t-shirt size)" onchange="updTask(${ch.id},'size',this.value,true);openDetail(${id})"><option value="">–</option>${["s","m","l","xl"].map(z=>`<option value="${z}" ${ch.size===z?"selected":""}>${SIZE_NAMES[z]}</option>`).join("")}</select>`
        : `<span class="rowpts" title="Rolled up from subtasks">${_cp} pts</span>`;
      return `<div class="ptask" data-cid="${ch.id}">
        <button class="grip2" onpointerdown="rowDown(event,${ch.id})" aria-label="Drag onto a project pill in the timeline">${GRIP_SVG}</button>
        <button class="check ${lleaf?(ch.done?'on':''):(lp===100?'on':'')}" onclick="toggleDone(${ch.id});openDetail(${id})">${(lleaf?ch.done:lp===100)?'✓':''}</button>
        <button class="t" style="text-align:left" onclick="openDetail(${ch.id})">${ch.title}</button>
        ${ownerPill(ch.owner,`updTask(${ch.id},'owner',this.value,true);openDetail(${id})`)}
        ${szCtl}
        ${dueChip(ch.due,lleaf&&ch.done)}</div>`;}).join("")}
    ${path.length>=3?"":`<div class="subadd" style="margin-top:10px"><input id="dSubNew" placeholder="Add a ${path.length>1?"subtask":"task"}…"><button onclick="addChild(${id})">Add</button></div>`}
    <button class="danger" onclick="deleteTask(${id})">Delete ${path.length===1?"project":path.length>=3?"subtask":"task"}</button>`;
  document.getElementById("tmodal").classList.add("show");
  document.getElementById("scrim").classList.add("show");
}
function closeSheet(){ document.getElementById("tmodal").classList.remove("show");
  document.getElementById("scrim").classList.remove("show"); }

/* ================= conversational capture ================= */
/* Real product: each turn's transcript + context (roster, project list, today) is POSTed
   to /extract, which calls the LLM (ChatGPT) with a JSON schema and returns structured
   fields + the next question. Here callExtract() falls back to a local mock so the whole
   UX is demoable; swap EXTRACT_URL for the live endpoint and nothing else changes. */
const $id=x=>document.getElementById(x);
const EXTRACT_URL=null; // e.g. "/extract" once the serverless function is live

let actx;
function ding(step=0){ try{
  actx=actx||new (window.AudioContext||window.webkitAudioContext)();
  const o=actx.createOscillator(), g=actx.createGain(), t0=actx.currentTime;
  o.type="sine"; o.frequency.setValueAtTime(740+step*80,t0); o.frequency.exponentialRampToValueAtTime(1180+step*80,t0+0.08);
  g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(0.09,t0+0.02);
  g.gain.exponentialRampToValueAtTime(0.0001,t0+0.35);
  o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0+0.4);
}catch(e){} }

let CAP=null, rec=null, listening=false, capTTS=false, capLang="en";  // input language; output is always English
function toggleCapLang(){ capLang=capLang==="en"?"fr":"en";
  $id("langBtn").textContent="🌐 "+capLang.toUpperCase();
  if(listening){ stopListen(); } }

function openCapture(){
  CAP={turns:[], history:[], draft:{}, pending:null, ready:false, busy:false}; capQueue=[];
  $id("capChat").innerHTML=""; $id("capInput").value="";
  $id("capCard").className="capcard"; $id("capActions").innerHTML="";
  updateKeyBadge(); renderCapCard({pending:null});   // show the (empty) creation card
  botSay("Hi! What would you like to do? For example: “new project Roman Pilot, first task get insurance, due Monday.”");
  $id("vmodal").classList.add("show"); $id("vmodal").classList.remove("min");
  if(!getKey()) askKey();                 // offer to connect GPT on first use
  else setTimeout(()=>$id("capInput").focus(),50);
}
function minimizeCapture(){ stopListen(); $id("vmodal").classList.add("min"); }
function restoreCapture(){ $id("vmodal").classList.remove("min"); setTimeout(()=>{const i=$id("capInput"); i&&i.focus();},50); }
function closeCapture(){ stopListen(); window.speechSynthesis&&speechSynthesis.cancel();
  $id("vmodal").classList.remove("show","min"); CAP=null; }

function bubble(text,cls){ const b=document.createElement("div");
  b.className="bub "+cls; b.textContent=text;
  const c=$id("capChat"); c.appendChild(b); c.scrollTop=c.scrollHeight; return b; }
let lastBotText="";
const normCap=s=>(s||"").toLowerCase().replace(/[^a-z0-9 ]/g,"").replace(/\s+/g," ").trim();
function botSay(text){ lastBotText=text; bubble(text,"bot"); if(capTTS) speak(text); }
function speak(text){ try{ if(!window.speechSynthesis) return;
  speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text);
  u.rate=1.05; u.lang="en-US";
  if(listening){ micPaused=true; try{rec.stop();}catch(e){} } // hard-pause the mic so it can't hear itself
  speaking=true;
  u.onend=u.onerror=()=>{ speaking=false;
    if(listening&&micPaused){ micPaused=false; try{rec.start();}catch(e){} } };
  speechSynthesis.speak(u); }catch(e){ speaking=false; micPaused=false; } }
function toggleTTS(){ capTTS=!capTTS;
  $id("ttsBtn").textContent=capTTS?"🔊 Voice on":"🔇 Voice off";
  $id("ttsBtn").classList.toggle("on",capTTS);
  if(!capTTS&&window.speechSynthesis) speechSynthesis.cancel(); }

async function sendTurn(){
  if(!CAP||CAP.busy) return;
  const el=$id("capInput"), text=el.value.trim(); if(!text) return;
  el.value=""; bubble(text,"me"); CAP.turns.push(text);
  CAP.busy=true; const think=bubble("…","bot think");
  const r=await callExtract(text,CAP.draft,CAP.pending);
  think.remove(); CAP.busy=false;
  CAP.draft=r.draft; CAP.pending=r.pending; CAP.ready=r.ready;
  botSay(r.assistantSay);
  CAP.history.push({role:"user",content:text},{role:"assistant",content:r.assistantSay});
  if(CAP.history.length>16) CAP.history=CAP.history.slice(-16);
  renderCapCard(r);
}

/* ---- sidebar popovers: search (top) and settings (bottom) ---- */
function closeSidePops(except){ ["sbsearchpop","sbsettingspop"].forEach(id=>{ if(id!==except){ const p=document.getElementById(id); if(p)p.classList.remove("show"); } }); }
function toggleSearch(){ const p=document.getElementById("sbsearchpop"); if(!p)return; closeSidePops("sbsearchpop");
  const open=p.classList.toggle("show"); if(open){ const i=document.getElementById("searchbox"); if(i){i.focus();i.select&&i.select();} } }
function toggleSettings(){ const p=document.getElementById("sbsettingspop"); if(!p)return; closeSidePops("sbsettingspop");
  const open=p.classList.toggle("show"); if(open){ const i=document.getElementById("setKeyInput"); if(i)i.value=getKey(); } }
function closeSettings(){ const p=document.getElementById("sbsettingspop"); if(p)p.classList.remove("show"); }
/* hide / show the whole left rail; the chart reclaims the space and re-lays out once it settles */
function toggleSidebar(){ const hidden=document.body.classList.toggle("sbhide"); closeSidePops();
  const b=document.querySelector(".sbtoggle"); if(b) b.title=hidden?"Show sidebar":"Hide sidebar";
  placeFloat(); setTimeout(()=>{ if(typeof renderGantt==="function") renderGantt(); placeFloat(); },240); }

/* ---- OpenAI key, kept in this browser session only (never written to the file) ---- */
let OAI_KEY="";
function getKey(){ try{ return sessionStorage.getItem("oai_key")||OAI_KEY; }catch(e){ return OAI_KEY; } }
function setKeyVal(v){ OAI_KEY=v; try{ v?sessionStorage.setItem("oai_key",v):sessionStorage.removeItem("oai_key"); }catch(e){} }
function askKey(){ const has=!!getKey();
  $id("keyInput").value=""; $id("keyInput").placeholder=has?"Key saved — paste a new one to replace":"sk-…";
  $id("clearKey").style.display=has?"inline-flex":"none";
  $id("keyModal").classList.add("show"); setTimeout(()=>$id("keyInput").focus(),50); }
function saveKey(){ const v=$id("keyInput").value.trim(); if(v) setKeyVal(v);
  $id("keyInput").value=""; $id("keyModal").classList.remove("show"); updateKeyBadge(); }
function skipKey(){ $id("keyModal").classList.remove("show"); }
function clearKey(){ setKeyVal(""); $id("keyModal").classList.remove("show"); updateKeyBadge(); }
function updateKeyBadge(){ const b=$id("keyBtn"); if(b) b.textContent=getKey()?"🔑 GPT on":"🔑 Key"; }

/* swappable extraction: a live endpoint, then OpenAI direct (browser key), then the mock */
const OWNER_IDS=[...Object.keys(PEOPLE),null]; // owner must be a real teammate id, never free text
const OAI_SCHEMA={type:"object",additionalProperties:false,
  required:["intent","project","task","tasks","remove","owner","parentId","due","size","pending","ready","assistantSay"],
  properties:{
    remove:{type:"array",items:{type:"string"}},
    intent:{type:["string","null"],enum:["create_project","create_task","create_subtask",null]},
    project:{type:["string","null"]}, task:{type:["string","null"]},
    tasks:{type:"array",items:{type:"object",additionalProperties:false,
      required:["title","owner","due","size","subs"],
      properties:{title:{type:"string"},owner:{type:["string","null"],enum:OWNER_IDS},
        due:{type:["string","null"]},size:{type:["string","null"],enum:["s","m","l","xl",null]},
        subs:{type:"array",items:{type:"object",additionalProperties:false,
          required:["title","owner","due","size"],
          properties:{title:{type:"string"},owner:{type:["string","null"],enum:OWNER_IDS},
            due:{type:["string","null"]},size:{type:["string","null"],enum:["s","m","l","xl",null]}}}}}}},
    owner:{type:["string","null"],enum:OWNER_IDS}, parentId:{type:["integer","null"]},
    due:{type:["string","null"]}, size:{type:["string","null"],enum:["s","m","l","xl",null]},
    pending:{type:["string","null"]}, ready:{type:"boolean"}, assistantSay:{type:"string"}}};
function captureContext(){ return {today:isoCap(TODAY),
  people:Object.entries(PEOPLE).map(([id,p])=>({id,name:p.name,responsibility:p.role,aka:p.al})),
  hardware:HARDWARE_VOCAB, clients:CLIENTS.map(c=>c.name),
  projects:DATA.map(p=>({id:p.id,name:p.title,tasks:p.children.map(t=>({id:t.id,name:t.title}))}))}; }
async function callExtract(text,draft,pending){
  if(EXTRACT_URL){ try{
    const res=await fetch(EXTRACT_URL,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({text,draft,pending,context:captureContext()})});
    return await res.json();
  }catch(e){ /* fall through */ } }
  const key=getKey();
  if(key){ try{ return await openaiExtract(text,draft,pending,key); }
    catch(e){ bubble("⚠︎ GPT call failed ("+e.message+") — using offline parser.","bot think"); } }
  await new Promise(r=>setTimeout(r,300)); // simulate latency
  return mockExtract(text,draft,pending);
}
async function openaiExtract(text,draft,pending,key){
  const sys=`You convert a teammate's spoken/typed request into a structured task-capture object for a 3-level planner (project > task > subtask).
LANGUAGE: the user may speak or type in English OR French — understand both perfectly. ALL OUTPUT MUST BE IN ENGLISH: translate every project/task/subtask name to English, and write assistantSay in English, regardless of the input language.
Rules:
- Merge the NEW utterance into the CURRENT draft; KEEP earlier fields unless the user changes them. Never discard the project the user is building. The user may correct any field at any time ("actually call it X", "change owner to Y").
- intent is one of create_project / create_task / create_subtask, and stays create_project while the user is still building a new project.
- When intent is create_project, collect the project's tasks in the "tasks" array. ALWAYS return the COMPLETE cumulative list — every task added so far in currentDraft.tasks PLUS any new one this turn. If the user says "add a task / first task / another task ...", append a new item; never drop previously added tasks and never switch intent or use parentId.
- Task titles are concise imperative phrases with NO leading article — "Clean the bathroom", not "a clean the bathroom". Each item has title, plus owner/due/size if stated (else null), plus a "subs" array (empty if none).
- SUBTASKS: the word "subtask" ALWAYS means an item inside some existing task's "subs" array — NEVER a new top-level task, no matter how many are added. When the user says "add subtask(s)" / "add N subtasks": if they name or imply a parent ("for the first task", "under clean the bathroom"), use it; if they DON'T name one, attach the subtasks to the LAST task currently in the tasks array. Return that task's complete subs list. Subtasks are leaves (no further subs). Never increase the number of top-level tasks when the user said "subtask".
- ASSIGNEE INFERENCE: when no owner is explicitly named for a task/subtask, look at the task's CONTENT and assign the teammate whose responsibility best matches it, using this RESPONSIBILITY MAP:
${RESP_MAP_TEXT}
  Examples: "Install RS03 motor on prototype" → Iannis or Sanket; "Implement obstacle avoidance for the Derichebourg pilot" → Akshat; "Fix D-Wave board power issue" → Leynaïck. Only when nothing in the content maps to a responsibility, fall back to the PROJECT's owner. If the user says "owners same as the project", set every task's and subtask's owner to the project owner (this overrides inference).
- DOMAIN VOCABULARY — use these EXACT spellings; never invent or mis-spell hardware or client names:
${VOCAB_TEXT}
  Map mis-heard variants to the canonical form (e.g. "RS zero three"/"RS-3" → "RS03", "dwave" → "D-Wave", "jaycee decaux" → "JCDecaux").
- When the user gives an ordered list of due dates/owners "in that order" for the tasks, apply them positionally to the tasks in their current order.
- DELETING: you CAN delete. When the user asks to remove/delete a task or subtask (e.g. "delete the two tests you just added", "remove clean the toilet"), put each item's exact current title into the "remove" array. Otherwise "remove" is []. Never say you can't delete.
- Use intent create_task / create_subtask ONLY when adding to a project/task that ALREADY EXISTS in context.projects. Then set parentId to that existing id.
- "task" (singular) is only for create_task/create_subtask; for create_project leave "task" null and use "tasks".
- owner MUST be one of the provided people ids, or null. Names are frequently MIS-HEARD by voice transcription — map any spelling variant or mishearing listed in the responsibility map to the correct id (e.g. "Janice"/"Yannis"/"Ioannis" → Iannis "ia"; "Flo"/"Florine" → Florian "fd"; "Sankeet" → Sanket "sk"). Do NOT assign the work to a different real teammate just because the heard name is fuzzy; if you genuinely cannot resolve it, use null rather than guessing the wrong person.
- due: resolve relative dates ("Monday","tomorrow","in 3 days") to absolute YYYY-MM-DD using context.today; else null. size: s/m/l/xl if stated else null.
- pending = the single most useful field still needed ("projectName","taskTitle","parent","owner"), or null if nothing required is missing. Required: create_project needs project(name); create_task/subtask need task(title) and parentId.
- ready = true when required fields are present (a project is ready once it has a name, even with zero tasks).
- assistantSay = one short, natural sentence confirming what you understood and asking the next thing (or noting it's ready). Talk like a helpful colleague, not a form. If you just appended a task, acknowledge it and invite another or Create.
- Use the prior conversation messages to resolve references: "them/those/all of them", "the first one", "same", "same for the subtasks". "Same for X" / "same for the subtasks" means apply the value MOST RECENTLY set or discussed (e.g. the due date you just applied to the tasks) to X — do NOT guess a different attribute. If the last thing set was a due date, "same for the subtasks" sets that same due date on every subtask.
Return ONLY the JSON object.`;
  const history=(typeof CAP!=="undefined"&&CAP&&CAP.history)?CAP.history.slice(-12):[];
  const body={model:"gpt-4o-mini",temperature:0,
    messages:[{role:"system",content:sys},...history,
      {role:"user",content:JSON.stringify({newUtterance:text,currentDraft:draft||{},pendingField:pending,context:captureContext()})}],
    response_format:{type:"json_schema",json_schema:{name:"capture",strict:true,schema:OAI_SCHEMA}}};
  const res=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
    body:JSON.stringify(body)});
  if(!res.ok){ throw new Error(res.status+" "+(await res.text()).slice(0,140)); }
  const o=JSON.parse((await res.json()).choices[0].message.content);
  const clean=s=>s?canonHardware(cap1(s.replace(/^(?:a|an|the)\s+/i,"").trim())):s;
  // merge by title: UPDATE fields on existing tasks (so "set size on each task" actually lands),
  // APPEND genuinely new ones, and keep tasks GPT didn't mention so nothing is dropped.
  // owner falls back to a domain guess from the title when the model left it null.
  const cleanSubs=arr=>(arr||[]).map(s=>{const ti=clean(s.title);
    return {title:ti,owner:s.owner||inferOwnerByDomain(ti),due:s.due||null,size:s.size||null};}).filter(s=>s.title);
  const wantsSub=/\bsub ?-?tasks?\b/i.test(text||"");   // user explicitly asked for subtasks
  const out=((draft&&draft.tasks)||[]).map(t=>({...t,subs:(t.subs||[]).slice()}));
  const idx=new Map(out.map((t,i)=>[(t.title||"").toLowerCase(),i]));
  const fresh=[];
  (o.tasks||[]).forEach(t=>{ const ti=clean(t.title); if(!ti) return; const k=ti.toLowerCase();
    if(idx.has(k)){ const e=out[idx.get(k)];
      if(t.owner) e.owner=t.owner; if(t.due) e.due=t.due; if(t.size) e.size=t.size;
      if(t.subs&&t.subs.length) e.subs=cleanSubs(t.subs);
    } else fresh.push({title:ti,owner:t.owner||inferOwnerByDomain(ti),due:t.due||null,size:t.size||null,subs:cleanSubs(t.subs)}); });
  // safety net: if the user said "subtask", new items belong UNDER the last task, not as top-level tasks
  if(wantsSub && out.length){ const last=out[out.length-1]; last.subs=last.subs||[];
    fresh.forEach(f=>last.subs.push({title:f.title,owner:f.owner,due:f.due,size:f.size})); }
  else fresh.forEach(f=>{ out.push(f); idx.set(f.title.toLowerCase(),out.length-1); });
  // deletions: drop any task or subtask whose title GPT listed in "remove"
  let finalTasks=out;
  const rm=new Set((o.remove||[]).map(s=>(s||"").toLowerCase().trim()).filter(Boolean));
  if(rm.size){ finalTasks=out.filter(t=>!rm.has((t.title||"").toLowerCase()));
    finalTasks.forEach(t=>{ t.subs=(t.subs||[]).filter(s=>!rm.has((s.title||"").toLowerCase())); }); }
  return {draft:{intent:o.intent,project:o.project,task:clean(o.task),tasks:finalTasks,owner:o.owner,parentId:o.parentId,due:o.due,size:o.size},
    pending:o.pending,ready:o.ready,assistantSay:o.assistantSay};
}

/* ---- local stand-in for the LLM: understands intent + fills fields across turns ---- */
function matchProject(t){ let best=null,score=0;
  DATA.forEach(p=>{ const n=p.title.toLowerCase();
    if(t.includes(n)){ if(n.length>score){ score=n.length; best=p; } } });
  return best; }

function mockExtract(text,draft,pending){
  draft=JSON.parse(JSON.stringify(draft||{}));
  const raw=text.trim(), t=" "+raw.toLowerCase()+" ";
  const newlyAsked=pending;

  // a turn that simply answers the bot's pending question routes wholesale into that field
  if(pending==="projectName"){ draft.project=cap1(raw.replace(/[.?!]+$/,"")); }
  else if(pending==="taskTitle"){ draft.task=cap1(raw.replace(/^(it'?s|its|to|the task is)\s+/i,"").replace(/[.?!]+$/,"")); }
  else if(pending==="owner"){ const o=findOwnerId(t); if(o) draft.owner=o; }
  else if(pending==="parent"){ const p=matchProject(t); if(p) draft.parentId=p.id; }
  else if(pending==="due"){ const due=findDue(t); if(due) draft.due=due; }

  // mixed-initiative: always scan for explicit signals too (user may over-specify)
  if(!draft.intent){
    if(/\bproject\b/.test(t)) draft.intent="create_project";
    else if(/\bsub ?task\b/.test(t)) draft.intent="create_subtask";
    else if(/\btask\b/.test(t)) draft.intent="create_task";
  }
  if(!draft.owner){ const o=findOwnerId(t); if(o&&/\b(owner|own|assign|for|by)\b/.test(t)) draft.owner=o; }
  const due=findDue(t); if(due) draft.due=due;
  const sz=findSize(t); if(sz) draft.size=sz;
  // project name from "(project|product) ... (called|named) X" or "project for X"
  if(draft.intent==="create_project"&&!draft.project){
    let m=raw.match(/(?:project|product)[^.]*?(?:called|named|name is|is called)\s+(.+?)(?=\s+(?:and|the task|task|due|owner|by|with|subtask)\b|[.,!?]|$)/i)
        ||raw.match(/(?:new project)\s+(?:called\s+|named\s+|for\s+)?(.+?)(?=\s+(?:and|the task|task|due|owner|by|with|subtask)\b|[.,!?]|$)/i);
    if(m) draft.project=cap1(m[1].trim().replace(/^(?:called|named|is\s+called)\s+/i,"")); }
  // explicit (re)naming at any turn — lets the user correct a wrong name ("call it X", "should be called X")
  if(draft.intent==="create_project"){
    const rn=raw.match(/(?:call it|name it|rename it to|should be called|it'?s called|the project is(?: called)?|name is(?: called)?)\s+(.+?)(?=\s+(?:and|task|due|owner|by|with|subtask)\b|[.,!?]|$)/i);
    if(rn) draft.project=cap1(rn[1].trim().replace(/^(?:called|named)\s+/i,"")); }
  draft.tasks=draft.tasks||[];
  // a task mentioned in this turn
  const tm=raw.match(/(?:add (?:a |another )?|first |second |third |next )?(?:new )?task\s+(?:called\s+|named\s+|is\s+|to\s+|:\s*)?(.+?)(?=\s+(?:and|due|owner|by|with|subtask|the project)\b|[.,!?]|$)/i);
  if(draft.intent==="create_project"){
    // building a project → append the task to its list (don't switch intent)
    if(tm){ const v=canonHardware(tm[1].trim().replace(/^(?:called|named)\s+/i,""));
      if(v.length>1) draft.tasks.push({title:cap1(v),owner:findOwnerId(t)||inferOwnerByDomain(v),due:findDue(t),size:findSize(t),subs:[]}); }
  } else if(!draft.task){
    if(tm){ const v=tm[1].trim().replace(/^(?:called|named)\s+/i,""); if(v.length>1) draft.task=cap1(v); }
  }
  // existing-project reference for create_task
  if(draft.intent==="create_task"&&!draft.parentId){ const p=matchProject(t); if(p) draft.parentId=p.id; }
  // strip a trailing "… to/in/for <project name>" the task regex may have swallowed
  if(draft.task&&draft.parentId){ const p=findPath(draft.parentId)?.pop();
    if(p){ const esc=p.title.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
      draft.task=cap1(draft.task.replace(new RegExp("\\s+(?:to|in|for|under)\\s+"+esc+"\\s*$","i"),"").trim()); } }

  return finalize(draft,newlyAsked);
}

function finalize(draft,justAsked){
  if(!draft.intent) return {draft,pending:null,ready:false,
    assistantSay:"Tell me what to create — a project, a task, or a subtask."};
  const have={ projectName:!!draft.project, taskTitle:!!draft.task,
    owner:!!draft.owner, parent:!!draft.parentId };
  let order;
  if(draft.intent==="create_project") order=[["projectName","What should the project be called?"],["owner","Who owns it?"]];
  else order=[["taskTitle","What’s the task?"],["parent","Which project does it go in?"],["owner","Who owns it?"]];
  const next=order.find(([k])=>!have[k]);
  // confirmation fragment for what we understood so far
  const bits=[];
  if(draft.project) bits.push("project “"+draft.project+"”");
  if(draft.tasks&&draft.tasks.length) bits.push(draft.tasks.length+(draft.tasks.length>1?" tasks":" task"));
  if(draft.task) bits.push("task “"+draft.task+"”");
  if(draft.parentId){ const p=findPath(draft.parentId)?.pop(); if(p) bits.push("in "+p.title); }
  if(draft.owner) bits.push("owner "+PEOPLE[draft.owner].name);
  if(draft.due) bits.push("due "+new Date(draft.due).toLocaleDateString("en-GB",{day:"numeric",month:"short"}));
  const got=bits.length?"Got it — "+bits.join(", ")+". ":"";
  if(next) return {draft,pending:next[0],ready:false,assistantSay:got+next[1]};
  return {draft,pending:null,ready:true,
    assistantSay:got+"Ready to create — review and hit Create, or keep talking to adjust."};
}

/* ---- editable creation card (middle panel) mirrors the draft; edits write to CAP.draft ---- */
function renderCapCard(r){
  const d=CAP.draft; d.tasks=d.tasks||[]; const miss=r.pending;
  const card=$id("capCard"), title=$id("buildTitle");
  // the creation form stays hidden until the assistant knows what you want to build
  const build=document.querySelector(".cappanel.build");
  if(build) build.style.display=d.intent?"flex":"none";
  if(!d.intent) return;
  const ownerChips=`<div class="ownerchips">${Object.entries(PEOPLE).map(([k,p])=>
    `<button class="ochip ${d.owner===k?'on':''}" onclick="CAP.draft.owner='${k}';refreshCard()">
      <span class="av xs" style="background:${p.color}">${p.initials}</span>${p.name}</button>`).join("")}</div>`;
  const projSel=`<select onchange="CAP.draft.parentId=+this.value||null;refreshCard()">
    <option value="">—</option>${DATA.map(p=>
      `<option value="${p.id}" ${d.parentId===p.id?'selected':''}>${p.title}</option>`).join("")}</select>`;
  const rows=[];
  const row=(key,lbl,html)=>rows.push(`<div class="crow ${miss===key?'miss':''}"><span class="clbl">${lbl}</span>${html}</div>`);
  if(d.intent==="create_project"){
    title.textContent="New project";
    row("projectName","Project",`<input value="${d.project||''}" placeholder="Project name"
      oninput="CAP.draft.project=this.value">`);
    row("owner","Owner",ownerChips);
    row("due","Due",`<input type="date" value="${d.due||''}" onchange="CAP.draft.due=this.value||null">`);
    // tasks (and their subtasks) default to the project owner when none is set
    if(d.owner) d.tasks.forEach(t=>{ if(!t.owner) t.owner=d.owner;
      (t.subs||[]).forEach(s=>{ if(!s.owner) s.owner=t.owner||d.owner; }); });
    const tl=d.tasks.length?d.tasks.map((tk,i)=>taskCardHTML(tk,i)).join("")
      :`<div class="capt-empty">No tasks yet — say “add a task called …” or type one below.</div>`;
    rows.push(`<div class="crow col"><span class="clbl">Tasks</span><div class="captasks">${tl}
      <div class="capt-add"><input id="capTaskNew" placeholder="Add a task…"
        onkeydown="if(event.key==='Enter'){event.preventDefault();addCapTask();}">
        <button class="mini" onclick="addCapTask()">＋</button></div></div></div>`);
  } else {
    title.textContent=d.intent==="create_subtask"?"New subtask":"New task";
    row("taskTitle","Task",`<input value="${d.task||''}" placeholder="Task title"
      oninput="CAP.draft.task=this.value">`);
    row("parent","Project",projSel);
    row("owner","Owner",ownerChips);
    row("due","Due",`<input type="date" value="${d.due||''}" onchange="CAP.draft.due=this.value||null">`);
  }
  card.innerHTML=rows.join(""); card.className="capcard show";
  const ready=d.intent==="create_project"?(!!d.project):(!!d.task&&!!d.parentId);
  $id("capActions").innerHTML=`<button class="create" ${ready?'':'disabled'} onclick="commitCapture()">Create</button>`;
}
function refreshCard(){ renderCapCard({pending:CAP.pending}); }
function addCapTask(){ const el=$id("capTaskNew"); if(!el) return; const v=el.value.trim(); if(!v) return;
  CAP.draft.tasks=CAP.draft.tasks||[]; CAP.draft.tasks.push({title:v[0].toUpperCase()+v.slice(1),owner:null,due:null,size:null,subs:[]});
  refreshCard(); setTimeout(()=>$id("capTaskNew")&&$id("capTaskNew").focus(),0); }
function delCapTask(i){ CAP.draft.tasks.splice(i,1); refreshCard(); }

/* a task = title + owner + due + size + its own subtasks, editably & tidily */
const escq=s=>(s||"").replace(/"/g,"&quot;");
const ownerOpts=v=>`<option value="">Owner…</option>`+Object.entries(PEOPLE).map(([k,p])=>
  `<option value="${k}" ${v===k?'selected':''}>${p.name}</option>`).join("");
function ownerPill(v,onch){ const col=v?PEOPLE[v].color:"#c2c8d2";
  return `<span class="opill" style="--oc:${col}"><span class="odot"></span>
    <select onchange="${onch}">${ownerOpts(v)}</select></span>`; }
function duePill(v,onch,sm){ return `<span class="duepill ${sm?'sm':''}"><input type="date" value="${v||''}" onchange="${onch}"></span>`; }
function szSeg(v,onch){ return `<span class="szseg">${["s","m","l","xl"].map(z=>
  `<button class="szb ${v===z?'on':''}" onclick="${onch.replace('Z',"'"+z+"'")}">${SIZE_NAMES[z]}</button>`).join("")}</span>`; }
function taskCardHTML(tk,i){ tk.subs=tk.subs||[];
  return `<div class="tcard">
    <div class="tc-top">
      <input class="tc-title" value="${escq(tk.title)}" oninput="setTask(${i},'title',this.value)" placeholder="Task title">
      <button class="tc-x" onclick="delCapTask(${i})" title="Remove">✕</button></div>
    <div class="tc-meta">
      ${ownerPill(tk.owner,`setTaskOwner(${i},this.value)`)}
      ${duePill(tk.due,`setTask(${i},'due',this.value)`)}
      ${szSeg(tk.size,`setTaskSize(${i},Z)`)}</div>
    ${tk.subs.map((s,j)=>`<div class="tc-sub">
      <input class="tc-subt" value="${escq(s.title)}" oninput="setSub(${i},${j},'title',this.value)" placeholder="Subtask">
      ${ownerPill(s.owner,`setSubOwner(${i},${j},this.value)`)}
      ${duePill(s.due,`setSub(${i},${j},'due',this.value)`,true)}
      <button class="tc-x" onclick="delSub(${i},${j})">✕</button></div>`).join("")}
    <div class="addsubrow"><input id="subNew${i}" class="addsubinput" placeholder="Add a subtask…"
      onkeydown="if(event.key==='Enter'){event.preventDefault();addSub(${i});}">
      <button class="addsubbtn" onclick="addSub(${i})">＋ Subtask</button></div>
  </div>`;
}
function setTask(i,f,v){ CAP.draft.tasks[i][f]=(f==="due"||f==="size"||f==="owner")?(v||null):v; }
function setTaskOwner(i,v){ CAP.draft.tasks[i].owner=v||null; refreshCard(); }
function setTaskSize(i,z){ const t=CAP.draft.tasks[i]; t.size=(t.size===z?null:z); refreshCard(); }
function setSub(i,j,f,v){ CAP.draft.tasks[i].subs[j][f]=(f==="due"||f==="size"||f==="owner")?(v||null):v; }
function setSubOwner(i,j,v){ CAP.draft.tasks[i].subs[j].owner=v||null; refreshCard(); }
function addSub(i){ const el=$id("subNew"+i); if(!el) return; const v=el.value.trim(); if(!v) return;
  CAP.draft.tasks[i].subs=CAP.draft.tasks[i].subs||[];
  CAP.draft.tasks[i].subs.push({title:v[0].toUpperCase()+v.slice(1),owner:null,due:null,size:null});
  refreshCard(); setTimeout(()=>$id("subNew"+i)&&$id("subNew"+i).focus(),0); }
function delSub(i,j){ CAP.draft.tasks[i].subs.splice(j,1); refreshCard(); }

function commitCapture(){
  const d=CAP.draft, owner=d.owner||"fd";
  snap();
  let focusId;
  if(d.intent==="create_project"){
    /* by default a project, its tasks and their subtasks share the same due date —
       any level left blank inherits its parent's date */
    const projDue=d.due||null;
    const proj=T(cap1(d.project||"New project"),owner,{d:projDue,open:true});
    (d.tasks||[]).forEach(tk=>{
      const tDue=tk.due||projDue||null;
      const task=T(cap1(tk.title),tk.owner||owner,{d:tDue,s:tk.size||null,open:(tk.subs&&tk.subs.length>0)});
      (tk.subs||[]).forEach(s=>task.children.push(T(cap1(s.title),s.owner||tk.owner||owner,{d:s.due||tDue||null,s:s.size||null})));
      proj.children.push(task); });
    DATA.push(proj); focusId=proj.id;
  } else {
    const parent=d.parentId?findPath(d.parentId).pop():null;
    if(!parent){ UNDO.pop(); botSay("Which project should it go in?"); CAP.pending="parent"; renderCapCard({pending:"parent"}); return; }
    const node=T(cap1(d.task||"New task"),owner,{d:d.due||parent.due||null,s:d.size||null});
    if(!fitsDepth(node,parent.id)){ UNDO.pop();
      botSay("That would nest too deep — the hierarchy stops at project › task › subtask."); return; }
    parent.children.push(node); parent.open=true; focusId=node.id;
  }
  ding(3); closeCapture(); renderAll();   // submitted — no extra screen
}

/* ================= full-transcript processing → Review & Approve ================= */
/* Paste a whole conversation; the LLM (or the offline mock) proposes MULTIPLE projects and
   tasks at once. Nothing is created until the user accepts items and hits "Push approved". */
const CLIENT_NAMES=[...CLIENTS.map(c=>c.name),null];
const OAI_PROPOSAL_SCHEMA={type:"object",additionalProperties:false,
  required:["assistantSay","projects"],
  properties:{
    assistantSay:{type:"string"},
    projects:{type:"array",items:{type:"object",additionalProperties:false,
      required:["name","client","owner","due","tasks"],
      properties:{
        name:{type:"string"},
        client:{type:["string","null"],enum:CLIENT_NAMES},
        owner:{type:["string","null"],enum:OWNER_IDS},
        due:{type:["string","null"]},
        tasks:{type:"array",items:{type:"object",additionalProperties:false,
          required:["title","owner","due","size","client","subs"],
          properties:{
            title:{type:"string"},
            owner:{type:["string","null"],enum:OWNER_IDS},
            due:{type:["string","null"]},
            size:{type:["string","null"],enum:["s","m","l","xl",null]},
            client:{type:["string","null"],enum:CLIENT_NAMES},
            subs:{type:"array",items:{type:"object",additionalProperties:false,
              required:["title","owner","due","size"],
              properties:{title:{type:"string"},owner:{type:["string","null"],enum:OWNER_IDS},
                due:{type:["string","null"]},size:{type:["string","null"],enum:["s","m","l","xl",null]}}}}
          }}}
      }}}}};
async function openaiTranscript(text,key){
  const sys=`You read a raw client/team conversation transcript and extract the NEW engineering projects and tasks it implies, for a 3-level planner (project > task > subtask).
LANGUAGE: the transcript may be English or French — ALL OUTPUT MUST BE IN ENGLISH.
- Group work into projects. A customer pilot becomes a project; set its "client" to the matching known client. Pure internal work has client=null.
- Each task: a concise imperative title (no leading article), owner, due (YYYY-MM-DD resolved from context.today, else null), size (s/m/l/xl or null), client (if the task is for a known client else null), and a subs array (usually empty).
- ASSIGNEE: infer each owner from this RESPONSIBILITY MAP using the task's content; only null if genuinely unclear:
${RESP_MAP_TEXT}
${VOCAB_TEXT}
  Use the exact hardware/client spellings above; map mis-hearings to the canonical form.
- Do NOT re-create work that already exists in context.projects — only return genuinely new items.
- assistantSay: one short sentence, e.g. "I identified 2 projects and 7 tasks from this conversation."
Return ONLY the JSON object.`;
  const body={model:"gpt-4o-mini",temperature:0,
    messages:[{role:"system",content:sys},
      {role:"user",content:JSON.stringify({transcript:text,context:captureContext()})}],
    response_format:{type:"json_schema",json_schema:{name:"proposal",strict:true,schema:OAI_PROPOSAL_SCHEMA}}};
  const res=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify(body)});
  if(!res.ok) throw new Error(res.status+" "+(await res.text()).slice(0,140));
  return JSON.parse((await res.json()).choices[0].message.content);
}
/* offline stand-in: split the transcript into action clauses, route them to per-client projects */
let PROP = null;
function normalizeProposalWrapped(raw) {
  return normalizeProposal(raw);
}
async function extractTranscript(text){
  const key=getKey();
  if(key){ try{ return normalizeProposalWrapped(await openaiTranscript(text,key)); }catch(e){ /* fall back to mock */ } }
  await new Promise(r=>setTimeout(r,400));
  return normalizeProposalWrapped(mockTranscript(text));
}
function openTranscript(){ $id("trInput").value=""; $id("transcriptModal").classList.add("show"); setTimeout(()=>$id("trInput").focus(),50); }
function closeTranscript(){ $id("transcriptModal").classList.remove("show"); }
async function runTranscript(){ const text=$id("trInput").value.trim(); if(text.length<8) return;
  const btn=$id("trGo"); btn.disabled=true; btn.textContent="Processing…";
  try{ PROP=await extractTranscript(text); } finally{ btn.disabled=false; btn.textContent="Process"; }
  closeTranscript(); openReview(); }
/* paperclip in the chat: attach a transcript file and run it straight into Review & Approve */
async function attachTranscript(input){
  const f=input.files&&input.files[0]; input.value=""; if(!f) return;
  let text=""; try{ text=await f.text(); }catch(e){}
  text=stripCaptions(text);
  if(!text||text.trim().length<8){ bubble("That file looks empty — try a transcript with some text in it.","bot think"); return; }
  bubble("📎 "+f.name,"me");
  const think=bubble("Reading the transcript…","bot think");
  try{ PROP=await extractTranscript(text); } catch(e){ PROP=null; }
  think.remove();
  if(!PROP){ bubble("I couldn't read that file.","bot think"); return; }
  openReview();
}
/* drop WebVTT/SRT timestamp + index lines so only the spoken text reaches the model */
function openReview(){ renderReview(); $id("reviewModal").classList.add("show"); }
function closeReview(){ $id("reviewModal").classList.remove("show"); PROP=null; }
function rvObj(uid){ if(!PROP) return null;
  for(const p of PROP.projects){ if(p.uid===uid) return p;
    for(const t of p.tasks){ if(t.uid===uid) return t; for(const s of t.subs){ if(s.uid===uid) return s; } } } return null; }
function rvToggle(uid){ const o=rvObj(uid); if(o){ o.accepted=!o.accepted; renderReview(); } }
function rvText(uid,f,v){ const o=rvObj(uid); if(o) o[f]=v; }          // no re-render: keep input focus
function rvOwner(uid,v){ const o=rvObj(uid); if(o){ o.owner=v||null; renderReview(); } }
function rvDue(uid,v){ const o=rvObj(uid); if(o) o.due=v||null; }
function rvSize(uid,z){ const o=rvObj(uid); if(o){ o.size=(o.size===z?null:z); renderReview(); } }
function rvTaskHTML(p,t){
  return `<div class="rvtask ${t.accepted&&p.accepted?'':'off'}">
    <button class="rv-acc ${t.accepted?'on':''}" onclick="rvToggle(${t.uid})" aria-label="Include task">${t.accepted?'✓':''}</button>
    <input class="rv-tt" value="${escq(t.title)}" oninput="rvText(${t.uid},'title',this.value)">
    <span class="rv-meta">
      <select onchange="rvOwner(${t.uid},this.value)">${ownerOpts(t.owner)}</select>
      <input type="date" value="${t.due||''}" onchange="rvDue(${t.uid},this.value)">
      ${szSeg(t.size,`rvSize(${t.uid},Z)`)}
      ${t.client?`<span class="rv-badge crm">${t.client}</span>`:''}
    </span>
    ${(t.subs||[]).map(s=>`<div class="rvsub">
        <button class="rv-acc ${s.accepted?'on':''}" onclick="rvToggle(${s.uid})" aria-label="Include subtask">${s.accepted?'✓':''}</button>
        <input class="rv-tt" value="${escq(s.title)}" oninput="rvText(${s.uid},'title',this.value)">
        <span class="rv-meta"><select onchange="rvOwner(${s.uid},this.value)">${ownerOpts(s.owner)}</select></span>
      </div>`).join("")}
  </div>`;
}
function renderReview(){ if(!PROP) return;
  let na=0,nt=0;
  PROP.projects.forEach(p=>{ if(p.accepted){ na++; p.tasks.forEach(t=>{ if(t.accepted) nt++; }); } });
  $id("rvBanner").textContent=PROP.assistantSay||`I identified ${PROP.projects.length} project(s).`;
  $id("rvBody").innerHTML=PROP.projects.map(p=>`<div class="rvproj ${p.accepted?'':'off'}">
      <div class="rv-prow">
        <button class="rv-acc ${p.accepted?'on':''}" onclick="rvToggle(${p.uid})" aria-label="Include project">${p.accepted?'✓':''}</button>
        <input class="rv-name" value="${escq(p.name)}" oninput="rvText(${p.uid},'name',this.value)">
        <span class="rv-badge ${p.client?'crm':'eng'}">${p.client?'Pilot · '+p.client:'Engineering'}</span>
      </div>
      <div class="rv-meta" style="margin:8px 0 0 32px">
        <select onchange="rvOwner(${p.uid},this.value)">${ownerOpts(p.owner)}</select>
        <input type="date" value="${p.due||''}" onchange="rvDue(${p.uid},this.value)">
      </div>
      <div class="rvtasks">${p.tasks.map(t=>rvTaskHTML(p,t)).join("")||'<div class="capt-empty">No tasks proposed for this project.</div>'}</div>
    </div>`).join("")||'<div class="capt-empty">Nothing detected. Try a more detailed transcript.</div>';
  $id("rvActions").innerHTML=`<button class="ghost" onclick="closeReview()">Cancel</button>
    <button class="create" ${na?'':'disabled'} onclick="pushApproved()">Push ${na} project${na!==1?'s':''} · ${nt} task${nt!==1?'s':''}</button>`;
}
function pushApproved(){ if(!PROP) return; snap(); let np=0;
  PROP.projects.forEach(p=>{ if(!p.accepted) return;
    const proj=T(cap1(p.name||"New project"),p.owner||"fd",{d:p.due||null,open:true});
    if(p.client) proj.client=p.client;                       // light CRM link tag
    (p.tasks||[]).forEach(t=>{ if(!t.accepted) return;
      const subsOK=(t.subs||[]).filter(s=>s.accepted);
      const task=T(cap1(t.title||"New task"),t.owner||p.owner||"fd",{d:t.due||p.due||null,s:t.size||null,open:subsOK.length>0});
      if(t.client) task.client=t.client;
      subsOK.forEach(s=>task.children.push(T(cap1(s.title||"Subtask"),s.owner||t.owner||p.owner||"fd",{d:s.due||t.due||p.due||null,s:s.size||null})));
      proj.children.push(task); });
    DATA.push(proj); np++; });
  closeReview(); ding(3); renderAll();
}

/* ---- continuous mic: stays live, auto-sends each finished sentence as a turn until you
        stop it. Finished sentences are queued so a slow extract call never drops one. ---- */
let capQueue=[], speaking=false, micPaused=false;
function setMic(on){ listening=on; const f=$id("micFab"); if(f) f.classList.toggle("live",on); }
/* the bottom-right mic is the only mic: tap to open the chat (if needed) and talk; tap again to stop */
function micFabTap(){ const m=$id("vmodal");
  if(CAP&&m&&m.classList.contains("min")){ restoreCapture(); return; }   // expand instead of toggling mic
  if(!CAP){ openCapture(); setTimeout(toggleListen,150); } else toggleListen(); }
function pushTurn(text){ capQueue.push(text); drainQueue(); }
async function drainQueue(){ if(!CAP||CAP.busy) return;
  while(capQueue.length){ $id("capInput").value=capQueue.shift(); await sendTurn(); } }
function isBotEcho(text){ const n=normCap(text), b=normCap(lastBotText);
  return n.length>5 && b && (b.includes(n)||n.includes(b)); }
function toggleListen(){ if(listening) return stopListen();
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ botSay("Speech recognition isn’t available in this browser — type your answer instead. (In production this streams to Whisper.)"); return; }
  rec=new SR(); rec.lang=capLang==="fr"?"fr-FR":"en-US"; rec.interimResults=true; rec.continuous=true;
  rec.onresult=e=>{ if(speaking||micPaused) return;   // never while the bot is talking
    let fin="",intr="";
    for(let i=e.resultIndex;i<e.results.length;i++){ const r=e.results[i];
      if(r.isFinal) fin+=r[0].transcript+" "; else intr+=r[0].transcript; }
    fin=fin.trim();
    if(fin){ $id("capInput").value=""; if(!isBotEcho(fin)) pushTurn(fin); } // drop echoes of the prompt
    else $id("capInput").value=intr; };
  rec.onend=()=>{ if(listening&&!micPaused){ try{rec.start();}catch(e){} } else if(!listening) setMic(false); };
  rec.onerror=()=>{};
  try{ rec.start(); setMic(true); }catch(e){ setMic(false); }
}
function stopListen(){ listening=false; micPaused=false; if(rec){ try{rec.stop();}catch(e){} } setMic(false); }

/* ================= team photos ================= */
function openTeam(){ renderTeam(); $id("teamModal").classList.add("show"); }
function closeTeam(){ $id("teamModal").classList.remove("show"); }
function renderTeam(){
  $id("teamList").innerHTML=Object.entries(PEOPLE).map(([k,p])=>`<div class="trow">
    ${av(k,"lg")}<span class="tname">${p.name}</span>
    <label class="tbtn"><input type="file" accept="image/*" style="display:none" onchange="uploadPhoto('${k}',this)">${p.photo?"Change":"Upload"}</label>
    ${p.photo?`<button class="tbtn tdel" onclick="removePhoto('${k}')">Remove</button>`:""}</div>`).join("");
}
function uploadPhoto(k,input){ const f=input.files&&input.files[0]; if(!f) return;
  const r=new FileReader(); r.onload=e=>{ PEOPLE[k].photo=e.target.result; renderTeam(); renderAll(); requestSave(); };
  r.readAsDataURL(f); }
function removePhoto(k){ delete PEOPLE[k].photo; renderTeam(); renderAll(); requestSave(); }

/* ================= search ================= */
function doSearch(){
  const q=document.getElementById("searchbox").value.trim().toLowerCase();
  const box=document.getElementById("searchres");
  if(q.length<2){ box.innerHTML=""; box.style.display="none"; return; }
  const hits=[];
  flat(DATA,(n,d,path)=>{ if(hits.length>=8) return;
    if(n.title.toLowerCase().includes(q)||PEOPLE[n.owner].name.toLowerCase().includes(q))
      hits.push({n,proj:path[0]?path[0].title:n.title}); });
  box.innerHTML=hits.map(h=>`<button onmousedown="pickSearch(${h.n.id})"><b>${h.n.title}</b><span>${h.proj} · ${PEOPLE[h.n.owner].name}</span></button>`).join("")
    ||'<div class="nores">No matches</div>';
  box.style.display="block";
}
function pickSearch(id){ const sb=document.getElementById("searchbox");
  sb.value=""; document.getElementById("searchres").style.display="none"; openDetail(id); }

/* ================= hover tooltip — full task names ================= */
/* IMPORTANT: which bar the cursor is over is read from each event's REAL target
   (e.target.closest("[data-full]")), never from document.elementFromPoint. That was the bug:
   after the chart's innerHTML is swapped under a stationary cursor, Chromium's elementFromPoint
   hit-test cache goes stale and keeps returning the old/wrong node until the tab is re-focused —
   so every filter change killed the tooltip and even moving the mouse didn't help, because every
   detection path read from that one poisoned source. Event targets are always live, so this
   survives re-renders with no tab switch and no synthetic-event trickery. */
const TIP=document.createElement("div"); TIP.id="gtip"; document.body.appendChild(TIP);
let MX=-1,MY=-1,tipKey=null,tipTimer=null,tipEl=null;
let PTRDOWN=false; // physical button held (i.e. a drag in progress) — suppress the tip
function hideTip(){ clearTimeout(tipTimer); tipTimer=null; tipKey=null; tipEl=null; TIP.style.display="none"; }
function placeTip(){
  TIP.style.left=Math.max(8,Math.min(MX+14,window.innerWidth-TIP.offsetWidth-10))+"px";
  TIP.style.top =Math.max(6,MY-TIP.offsetHeight-16)+"px";
}
function revealTip(){ tipTimer=null;
  if(!tipEl||!tipEl.isConnected){ hideTip(); return; }   // node vanished during the delay
  TIP.textContent=tipEl.dataset.full; TIP.style.display="block"; placeTip();
}
/* feed me the element under the pointer, taken from a live event target (or a fresh hit-test) */
function hoverOn(target){
  if(PTRDOWN){ hideTip(); return; }
  const host=(target&&target.closest)?target.closest("[data-full]"):null;
  if(!host){ hideTip(); return; }
  const key=host.dataset.tid||host.dataset.full;
  if(key!==tipKey){                              // moved onto a new bar → arm the reveal delay
    clearTimeout(tipTimer); tipKey=key; tipEl=host; TIP.style.display="none";
    tipTimer=setTimeout(revealTip,600); return;
  }
  tipEl=host;                                    // same bar (may be a fresh node after a render)
  if(TIP.style.display==="block") placeTip();    // already shown → follow the cursor
}
document.addEventListener("pointerdown",()=>{PTRDOWN=true;},true);
document.addEventListener("pointerup",()=>{PTRDOWN=false;},true);
document.addEventListener("pointercancel",()=>{PTRDOWN=false;},true);
window.addEventListener("blur",()=>{PTRDOWN=false;});
const onMove=e=>{ MX=e.clientX; MY=e.clientY; if(!e.buttons) PTRDOWN=false; hoverOn(e.target); };
document.addEventListener("pointermove",onMove,{passive:true});
document.addEventListener("pointerover",e=>{ MX=e.clientX; MY=e.clientY; hoverOn(e.target); },{passive:true});
document.addEventListener("pointerout", e=>{ if(!e.relatedTarget) hideTip(); },{passive:true});
document.addEventListener("mousemove",onMove,{passive:true});                                  // fallbacks if
document.addEventListener("mouseover",e=>{ MX=e.clientX; MY=e.clientY; hoverOn(e.target); },{passive:true}); // pointer events glitch
// scrolling hides the tip; the next real hover re-arms it
document.addEventListener("scroll",()=>hideTip(),true);
// (no idle watchdog: the tooltip appears ONLY on a real hover, never synthesized from a click/render)

function renderAll(){ renderFilter(); renderDash();
  if(typeof requestAnimationFrame!=="undefined")
    requestAnimationFrame(kickHover); // re-evaluate hover after every re-render
}
Object.defineProperty(window, "CAP", { get: () => CAP, configurable: true });

const _globals = {
  toggleSearch, openTeam, micFabTap, openTranscript, toggleSettings, toggleSidebar, closeSettings,
  toggleFlyout, toggleFocus, toggleShowDone, toggleSubs, closeCapture, toggleCapLang, minimizeCapture,
  sendTurn, restoreCapture, skipKey, saveKey, clearKey, closeTranscript, runTranscript, closeReview,
  closeTeam, closeSheet, setFilter, setScaleView, ding, toggleDone, openDetail, setZoom, setGView,
  toggleExp, updTask, refreshBarMenu, addChild, deleteTask, addCapTask, barDown, barContext, pickSearch,
  uploadPhoto, removePhoto, rvToggle, rvText, rvOwner, rvDue, rvSize, pushApproved, attachTranscript,
  doSearch, refreshCard, delCapTask, setTask, setTaskOwner, setTaskSize, setSub, setSubOwner, addSub,
  delSub, commitCapture, toggleListen, stopListen, renderAll, moveTask, setKeyVal,
};
Object.assign(window, _globals);

startBoardSync({
  data: DATA,
  getUid,
  setUid,
  renderAll,
  onReady: (save) => { requestSave = save; },
  fallback: () => { DATA.splice(0, DATA.length, ...buildSampleTasks(T)); },
});
