
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getDatabase, ref, onValue, get, child, set } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";
import { firebaseConfig, APPLY_FUNCTION_URL } from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig); const auth = getAuth(app); const db = getDatabase(app);

// ---- Label helpers ----
const ACRONYMS = new Set(["IT","CCTV","ELV","GTO","HR","UAE","KSA","GCC","QA","QC"]);
function toTitleCasePreserveAcronyms(s) {
  if (!s) return s;
  const tokens = String(s).split(/([A-Za-z0-9']+)/g);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t || !/[A-Za-z0-9]/.test(t)) continue;
    const up = t.toUpperCase();
    if (ACRONYMS.has(up)) { tokens[i] = up; continue; }
    const lower = t.toLowerCase();
    tokens[i] = lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return tokens.join("").replace(/\s+/g, " ").trim();
}
function displayLabel(name) { return name ? toTitleCasePreserveAcronyms(name) : ""; }

const JOBS_PATH = "/expats_jobs";
function getAiTag(job){
  const ai = job?.ai || job?.AI || job?.ml || null;
  let tag = ai && (ai.titleTag || ai.role || ai.predicted || ai.primaryTag);
  return tag ? String(tag).trim() : null;
}

function textOfJob(j){
  const parts = [j?.jobTitle||j?.title||"", j?.jobDescription||j?.description||"", j?.jobCategory||"", j?.company||""];
  return parts.join(" ").toLowerCase();
}
function titleTagMap(){
  const m = {
    "barista":[/barista/],
    "waiter":[/waiter|waitress|server/],
    "kitchen helper":[/kitchen helper|commis|steward/],
    "chef":[/chef|cook|commis/i],
    "baker":[/baker|pastry/],
    "receptionist":[/receptionist/],
    "sales executive":[/sales(\s|-)executive|sales rep|salesperson|sales associate/],
    "cashier":[/cashier/],
    "storekeeper":[/storekeeper|store keeper|warehouse assistant/],
    "merchandiser":[/merchandiser/],
    "telesales":[/telesales|call center|callcentre|contact center/],
    "driver (light)":[/light\s*driver|delivery driver|motorbike|car driver/],
    "driver (heavy)":[/heavy\s*driver|trailer|truck driver|crane/],
    "electrician":[/electrician/],
    "plumber":[/plumber/],
    "ac technician":[/ac tech|hvac|air ?conditioning/],
    "carpenter":[/carpenter/],
    "mason":[/mason/],
    "painter":[/painter/],
    "welder":[/welder/],
    "mechanic":[/mechanic|technician auto/],
    "auto electrician":[/auto\s*electric/],
    "cctv technician":[/cctv/],
    "security guard":[/security guard|watchman/],
    "admin assistant":[/admin(istrative)? assistant|office assistant|secretary/],
    "data entry":[/data entry/],
    "hr assistant":[/hr assistant|human resources/],
    "accountant":[/accountant/],
    "it technician":[/it support|it technician|desktop support/],
    "web developer":[/web developer|frontend|front-end|javascript developer/],
    "software engineer":[/software engineer|backend developer|nodejs|java developer/],
    "qa/qc engineer":[/qa|qc|quality assurance|quality control/],
    "civil engineer":[/civil engineer/],
    "mechanical engineer":[/mechanical engineer/],
    "electrical engineer":[/electrical engineer/],
    "site engineer":[/site engineer/],
    "draftsman":[/draftsman|draughtsman|autocad/],
    "estimator":[/estimator|quantity surveyor|qs/],
    "foreman":[/foreman|supervisor/],
    "nurse":[/nurse/],
    "pharmacist":[/pharmacist/],
    "teacher":[/teacher|tutor/],
    "hairdresser":[/hairdresser|barber|stylist/],
    "beautician":[/beautician/],
    "butcher":[/butcher/],
    "printer (offset/gto)":[/gto|offset printer/],
  };
  for (const k in m) m[k] = m[k].map(x => x instanceof RegExp ? x : new RegExp(x, "i"));
  return m;
}

let totalsByTitleTag = new Map();
function computeTitleTags(all){
  totalsByTitleTag = new Map();
  const map = titleTagMap();
  for (const j of all){
    const ai = getAiTag(j);
    if (ai) {
      const key = String(ai).toLowerCase();
      totalsByTitleTag.set(key, (totalsByTitleTag.get(key)||0)+1);
      continue;
    }
    const txt = textOfJob(j);
    for (const [tag, regs] of Object.entries(map)){
      if (regs.some(r => r.test(txt))) {
        const key = String(tag).toLowerCase();
        totalsByTitleTag.set(key, (totalsByTitleTag.get(key)||0)+1);
      }
    }
  }
}

function format(n){ return new Intl.NumberFormat().format(n); }

function renderChips(){
  const chips = document.getElementById("chips");
  chips.innerHTML = "";
  const arr = Array.from(totalsByTitleTag.entries())
    .map(([name,count]) => ({ name, count }))
    .sort((a,b)=> b.count - a.count)
    .slice(0, 60);
  const selected = new Set();
  function recomputeSelection(){
    const sel = Array.from(selected);
    document.getElementById("selectedLabel").textContent = "Selected: " + (sel.length? sel.map(displayLabel).join(" + ") : "None");
  }
  for (const c of arr){
    const chip = document.createElement("button");
    chip.className = "px-3 py-1.5 rounded-full border hover:border-gray-300 text-sm";
    const label = document.createElement("span");
    label.textContent = displayLabel(c.name);
    chip.appendChild(label);
    const count = document.createElement("span");
    count.className = "ml-2 text-xs text-gray-500";
    count.textContent = format(c.count);
    chip.appendChild(count);
    chip.addEventListener("click", () => {
      if (selected.has(c.name)) selected.delete(c.name);
      else {
        if (selected.size>=3) return; // max 3
        selected.add(c.name);
      }
      chip.classList.toggle("bg-red-50");
      recomputeSelection();
    });
    chips.appendChild(chip);
  }
  recomputeSelection();

  document.getElementById("btnApply").onclick = async () => {
    const sel = Array.from(selected);
    if (!sel.length) { alert("Pick at least one role."); return; }
    const user = auth.currentUser;
    if (!user) { alert("Please sign in."); return; }
    try{
      const res = await fetch(APPLY_FUNCTION_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uid: user.uid, titleTags: sel })
      });
      const data = await res.json();
      alert(`Applied to ${data.attempted||0} jobs. You’ll receive a summary email.`);
      await set(ref(db, `users/${user.uid}/selectedTitleTags`), sel);
    }catch(e){ alert("Failed to apply. Check config."); }
  };
}

function row(name,n){ return `<div class="flex items-center justify-between rounded-lg border border-gray-100 p-3 mb-2"><div class="font-medium">${displayLabel(name)}</div><div class="text-sm text-gray-500">${format(n)} jobs</div></div>`; }

function loadAndRender(){
  const jobRef = ref(db, JOBS_PATH);
  onValue(jobRef, (snap) => {
    const obj = snap.val() || {};
    const all = Object.values(obj);
    computeTitleTags(all);
    renderChips();
    const breakdown = document.getElementById("breakdown");
    const arr = Array.from(totalsByTitleTag.entries())
      .map(([name,count]) => ({ name, count }))
      .sort((a,b)=> b.count - a.count).slice(0, 20);
    breakdown.innerHTML = arr.map(x => row(x.name, x.count)).join("");
  });
}

// Profile UI
function fillProfile(info){
  const img = document.getElementById("profImg");
  const name = document.getElementById("profName");
  const title = document.getElementById("profTitle");
  const about = document.getElementById("profAbout");
  const cv = document.getElementById("profCV");
  img.src = info?.profileImageUrl || info?.photoURL || "";
  name.textContent = info?.fullName || info?.name || "—";
  title.textContent = info?.profession || info?.title || "—";
  about.textContent = info?.about || "—";
  cv.href = info?.userCV || info?.cvURL || "#";
}

// Load legacy Users/info or new users/profile
async function loadProfile(uid){
  const snap1 = await get(child(ref(db), `Users/${uid}/info`));
  if (snap1.exists()) return snap1.val();
  const snap2 = await get(child(ref(db), `users/${uid}/profile`));
  if (snap2.exists()) return snap2.val();
  return null;
}

document.getElementById("btnSignOut").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "./auth.html"; return; }
  const p = await loadProfile(user.uid);
  if (p) fillProfile(p);
  loadAndRender();
});
