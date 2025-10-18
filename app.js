// app.js — Dashboard logic (Firebase v10 modular in-browser)

// 0) Config + Firebase imports
import { firebaseConfig, APPLY_FUNCTION_URL } from "./firebaseConfig.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase();

// Use absolute Cloud Run URLs for proxies (Railway doesn't have Firebase rewrites)
const IMG_PROXY_BASE = "https://imgproxy-azu6eodsrq-uc.a.run.app";
const CV_PROXY_BASE  = "https://cvproxy-azu6eodsrq-uc.a.run.app";

// 1) Helpers
const $ = (id) => document.getElementById(id);

const ui = {
  signOutBtn: $("signOutBtn"),
  profileCard: $("profileCard"),
  profileImg: $("profileImg"),
  profileName: $("profileName"),
  profileTitle: $("profileTitle"),
  profileAbout: $("profileAbout"),
  profileCvLink: $("profileCvLink"),
  categoriesPanel: $("categoriesPanel"),
  rolePicker: $("rolePicker"),
  roleChips: $("roleChips"),
  totalJobsCount: $("totalJobsCount"),
  matchedCount: $("matchedCount"),
  matchedCount2: $("matchedCount2"),
  applyBtn: $("applyBtn"),
};

// Minimal role taxonomy (Title Case; “IT” uppercase)
const ROLE_OPTIONS = [
  "Barista","Waiter/Waitress","Kitchen Helper","Cook","Chef","Baker","Receptionist",
  "Sales Executive","Cashier","Storekeeper","Merchandiser","Telesales/Call Center Agent",
  "Driver (Light)","Driver (Heavy)","Electrician","Plumber","AC Technician","Carpenter",
  "Mason","Painter","Welder","Mechanic","Auto Electrician","CCTV Technician","Security Guard",
  "Admin Assistant","Data Entry Clerk","HR Assistant","Accountant","IT Technician",
  "Web Developer","Software Engineer","QA/QC Engineer","Civil Engineer","Mechanical Engineer",
  "Electrical Engineer","Site Engineer","Draftsman","Estimator","Foreman","Nurse",
  "Pharmacist","Teacher","Hairdresser","Beautician","Butcher","Printer (Offset/GTO)"
];

// Regex map for fallback matching (when AI tag missing)
const REGEX_MAP = {
  "barista": [/barista/i],
  "waiter/waitress": [/waiter|waitress|server/i],
  "kitchen helper": [/kitchen helper|commis|steward/i],
  "cook": [/\bcook\b/i],
  "chef": [/chef|commis/i],
  "baker": [/baker|pastry/i],
  "receptionist": [/receptionist/i],
  "sales executive": [/sales(\s|-)?executive|sales rep|salesperson|sales associate/i],
  "cashier": [/cashier/i],
  "storekeeper": [/storekeeper|store keeper|warehouse assistant/i],
  "merchandiser": [/merchandiser/i],
  "telesales/call center agent": [/telesales|call center|callcentre|contact center/i],
  "driver (light)": [/light\s*driver|delivery driver|motorbike|car driver/i],
  "driver (heavy)": [/heavy\s*driver|trailer|truck driver|crane/i],
  "electrician": [/electrician/i],
  "plumber": [/plumber/i],
  "ac technician": [/ac tech|hvac|air ?conditioning/i],
  "carpenter": [/carpenter/i],
  "mason": [/mason/i],
  "painter": [/painter/i],
  "welder": [/welder/i],
  "mechanic": [/mechanic|technician auto/i],
  "auto electrician": [/auto\s*electric/i],
  "cctv technician": [/cctv/i],
  "security guard": [/security guard|watchman/i],
  "admin assistant": [/admin(istrative)? assistant|office assistant|secretary/i],
  "data entry clerk": [/data entry/i],
  "hr assistant": [/hr assistant|human resources/i],
  "accountant": [/accountant/i],
  "it technician": [/\bit\b.*(support|technician)|desktop support/i],
  "web developer": [/web developer|frontend|front-end|javascript developer/i],
  "software engineer": [/software engineer|backend developer|nodejs|java developer/i],
  "qa/qc engineer": [/qa|qc|quality assurance|quality control/i],
  "civil engineer": [/civil engineer/i],
  "mechanical engineer": [/mechanical engineer/i],
  "electrical engineer": [/electrical engineer/i],
  "site engineer": [/site engineer/i],
  "draftsman": [/draftsman|draughtsman|autocad/i],
  "estimator": [/estimator|quantity surveyor|qs/i],
  "foreman": [/foreman|supervisor/i],
  "nurse": [/nurse/i],
  "pharmacist": [/pharmacist/i],
  "teacher": [/teacher|tutor/i],
  "hairdresser": [/hairdresser|barber|stylist/i],
  "beautician": [/beautician/i],
  "butcher": [/butcher/i],
  "printer (offset/gto)": [/gto|offset printer/i],
};

function textOfJob(j) {
  const parts = [
    j?.jobTitle || j?.title || "",
    j?.jobDescription || j?.description || "",
    j?.jobCategory || "",
    j?.company || j?.companyName || ""
  ];
  return parts.join(" ").toLowerCase();
}

function aiTag(job) {
  const ai = job?.ai;
  if (!ai) return null;
  const t = ai.titleTag || ai.role || ai.predicted || ai.primaryTag;
  return t ? String(t).toLowerCase() : null;
}

function matchesRole(job, wantedLower) {
  // 1) AI tag
  const tag = aiTag(job);
  if (tag && wantedLower.includes(tag)) return true;
  // 2) Regex fallback
  const txt = textOfJob(job);
  for (const [k, regs] of Object.entries(REGEX_MAP)) {
    if (wantedLower.includes(k)) {
      if (regs.some(r => r.test(txt))) return true;
    }
  }
  return false;
}

function toLowerKey(r) {
  // Normalize role display → key used in REGEX_MAP / AI
  const s = r.trim().toLowerCase();
  return s
    .replace(/waiter\/waitress/, "waiter/waitress")
    .replace(/telesales\/call center agent/, "telesales/call center agent");
}

function renderChips(values) {
  ui.roleChips.innerHTML = values.map(v => `
    <span class="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-red-700 text-xs px-2 py-1 rounded-full">
      ${v}
    </span>
  `).join("");
}

function setMatched(n) {
  if (ui.matchedCount) ui.matchedCount.textContent = String(n);
  if (ui.matchedCount2) ui.matchedCount2.textContent = String(n);
}

function ensureApplyEnabled(values) {
  const ok = values.length >= 1 && values.length <= 3;
  ui.applyBtn.disabled = !ok;
}

// 2) Data cache
let ALL_JOBS = {};
let CURRENT_UID = null;

// 3) Auth bootstrap
if (ui.categoriesPanel) ui.categoriesPanel.classList.add("opacity-0","pointer-events-none");

onAuthStateChanged(auth, async (user) => {
  try {
    console.log("Auth state changed; user:", user?.uid || null);
    if (!user) {
      window.location.href = "auth.html";
      return;
    }
    CURRENT_UID = user.uid;

    // Sign out button
    if (ui.signOutBtn) {
      ui.signOutBtn.classList.remove("hidden");
      ui.signOutBtn.onclick = () => signOut(auth);
    }

    // Load profile (now tries ALL three locations)
    const profile = await fetchProfile(user.uid);
    console.log("Loaded profile source:", profile.__source || "none");
    renderProfile(profile);

    // Load jobs & counts
    await loadAllJobs();
    if (ui.totalJobsCount) ui.totalJobsCount.textContent = Object.keys(ALL_JOBS).length.toString();

    // Init roles UI
    initRolesUI(profile);
    ui.categoriesPanel.classList.remove("opacity-0","pointer-events-none");

  } catch (err) {
    console.error("Auth bootstrap error:", err);
  }
});

async function fetchProfile(uid) {
  // 1) Legacy capitalized path
  let s = await get(ref(db, `/Users/${uid}/info`));
  if (s.exists()) return { ...s.val(), uid, __source: "Users/info" };

  // 2) Lowercase users with info  ✅ (this was missing)
  s = await get(ref(db, `/users/${uid}/info`));
  if (s.exists()) return { ...s.val(), uid, __source: "users/info" };

  // 3) Lowercase users with profile (new schema)
  s = await get(ref(db, `/users/${uid}/profile`));
  if (s.exists()) return { ...s.val(), uid, __source: "users/profile" };

  // 4) As a last resort, try /users/{uid} directly
  s = await get(ref(db, `/users/${uid}`));
  if (s.exists()) {
    const val = s.val();
    // prefer nested objects if present
    const merged = val.info ? { ...val.info, uid } :
                   val.profile ? { ...val.profile, uid } :
                   { ...val, uid };
    return { ...merged, __source: "users/root" };
  }

  return { uid, __source: "none" };
}

function renderProfile(p) {
  if (ui.profileName) ui.profileName.textContent = p.fullName || p.name || "Your name";
  if (ui.profileTitle) ui.profileTitle.textContent = p.profession || p.title || "";
  if (ui.profileAbout) ui.profileAbout.textContent = p.about || "";

  const pid = p.userId || p.uid;
  if (ui.profileImg) {
    if ((p.profileImageUrl || p.photoURL) && pid) {
      ui.profileImg.src = `${IMG_PROXY_BASE}/${pid}`;
      ui.profileImg.classList.remove("hidden");
    } else {
      ui.profileImg.classList.add("hidden");
    }
  }
  if (ui.profileCvLink) {
    if ((p.userCV || p.cvURL) && pid) {
      ui.profileCvLink.href = `${CV_PROXY_BASE}/${pid}`;
      ui.profileCvLink.classList.remove("hidden");
    } else {
      ui.profileCvLink.classList.add("hidden");
    }
  }
}

async function loadAllJobs() {
  const snap = await get(ref(db, "/expats_jobs"));
  ALL_JOBS = snap.exists() ? snap.val() : {};
}

// 4) Roles UI
function initRolesUI(profile) {
  // Build clickable grid
  function renderRoleGrid(selected){
    const grid = document.getElementById('roleGrid');
    if (!grid) return;
    const chosen = new Set(selected || []);
    grid.innerHTML = ROLE_OPTIONS.map(name => {
      const isOn = chosen.has(name);
      const base = "role-pill inline-flex items-center justify-between gap-2 text-sm px-3 py-2 rounded-xl border transition shadow-sm";
      const on  = "bg-red-50 text-red-700 border-red-200";
      const off = "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300";
      return `<button type="button" data-role="${name}" class="${base} ${isOn?on:off}">
                <span>${name}</span>
                <span class="text-xs ${isOn?'':'opacity-0'}">✓</span>
              </button>`;
    }).join("");
    // Click handling
    grid.querySelectorAll("button[data-role]").forEach(btn => {
      btn.addEventListener("click", () => {
        const name = btn.getAttribute("data-role");
        const current = Array.from(ui.rolePicker.selectedOptions).map(o=>o.value);
        const set = new Set(current);
        if (set.has(name)) set.delete(name); else set.add(name);
        // clamp to 3 by trimming last-added if over
        if (set.size > 3) {
          // remove the oldest by converting to array and slicing
          const arr = Array.from(set);
          arr.splice(0, arr.length-3);
          set.clear(); arr.forEach(v=>set.add(v));
        }
        // sync to hidden select
        for (const opt of ui.rolePicker.options) {
          opt.selected = set.has(opt.value);
        }
        const values = Array.from(set);
        renderChips(values);
        ensureApplyEnabled(values);
        updateMatchedCount(values);
        renderRoleGrid(values); // re-render to reflect states
      });
    });
  }

  // Populate multi-select with Role Options
  ui.rolePicker.innerHTML = ROLE_OPTIONS.map(r => `<option value="${r}">${r}</option>`).join("");

  // Preselect saved roles, clamp to 3
  const saved = Array.isArray(profile.selectedTitleTags) ? profile.selectedTitleTags.slice(0,3) : [];
  for (const opt of ui.rolePicker.options) {
    opt.selected = saved.includes(opt.value);
  }
  renderChips(saved);
  renderRoleGrid(saved);
  ensureApplyEnabled(saved);
  updateMatchedCount(saved);

  // On change, clamp & recompute
  ui.rolePicker.addEventListener("change", () => {
    const selected = Array.from(ui.rolePicker.selectedOptions).map(o => o.value);
    const clamp = selected.slice(0,3);
    // unselect extras visually
    for (const opt of ui.rolePicker.options) {
      if (!clamp.includes(opt.value)) opt.selected = false;
    }
    renderChips(clamp);
    renderRoleGrid(clamp);
    ensureApplyEnabled(clamp);
    updateMatchedCount(clamp);
  });

  // Apply Now
  ui.applyBtn.addEventListener("click", async () => {
    const selected = Array.from(ui.rolePicker.selectedOptions).map(o => o.value).slice(0,3);
    if (!CURRENT_UID || !selected.length) return;

    try {
      ui.applyBtn.disabled = true;
      ui.applyBtn.textContent = "Applying…";

      // persist selection (helps daily job run)
      await set(ref(db, `/users/${CURRENT_UID}/selectedTitleTags`), selected);

      const resp = await fetch(APPLY_FUNCTION_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uid: CURRENT_UID, titleTags: selected })
      });
      const out = await resp.json().catch(() => ({}));
      const n = out?.attempted ?? 0;

      ui.applyBtn.textContent = "Applied!";
      setTimeout(() => {
        ui.applyBtn.textContent = "Apply Now";
        ensureApplyEnabled(selected);
      }, 1400);

      setMatched(n);
    } catch (e) {
      console.error(e);
      alert("Apply failed. Please try again.");
      ui.applyBtn.textContent = "Apply Now";
      ensureApplyEnabled(Array.from(ui.rolePicker.selectedOptions).map(o=>o.value));
    }
  });
}

function updateMatchedCount(selectedRoles) {
  const keys = selectedRoles.map(toLowerKey);
  const wantedLower = keys; // normalized
  let count = 0;
  for (const [, job] of Object.entries(ALL_JOBS)) {
    if (matchesRole(job, wantedLower)) count++;
  }
  setMatched(count);
}


// ===== AUTO_APPLY_TOGGLE =====
import { onValue, update } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

(function(){
  const statusPill = document.getElementById('autoStatusPill');
  const toggleBtn  = document.getElementById('autoToggleBtn');
  const nextRunEl  = document.getElementById('nextRunText');

  if (!statusPill || !toggleBtn) return;

  function setPill(enabled){
    if (enabled){
      statusPill.textContent = 'ON';
      statusPill.className = 'px-2 py-0.5 rounded-full border text-[10px] font-bold bg-red-50 text-red-700 border-red-200';
      toggleBtn.textContent = 'Pause';
      toggleBtn.className = 'px-3 py-2 rounded-lg bg-neutral-900 text-white text-sm font-semibold';
    }else{
      statusPill.textContent = 'PAUSED';
      statusPill.className = 'px-2 py-0.5 rounded-full border text-[10px] font-bold bg-neutral-50 text-neutral-700 border-neutral-300';
      toggleBtn.textContent = 'Resume';
      toggleBtn.className = 'px-3 py-2 rounded-lg bg-[--brand] text-white text-sm font-semibold';
    }
  }

  function nextNineBahrain(){
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const bahrainNow = new Date(utc + 3*3600*1000);
    const target = new Date(bahrainNow);
    target.setHours(9,0,0,0);
    if (bahrainNow >= target) target.setDate(target.getDate()+1);
    const isTomorrow = bahrainNow.getDate() != target.getDate();
    const hh = String(target.getHours()).padStart(2,'0');
    const mm = String(target.getMinutes()).padStart(2,'0');
    return hh + ':' + mm + (isTomorrow ? ' (tomorrow)' : ' (today)');
  }

  function renderNextRun(){
    if (nextRunEl) nextRunEl.textContent = nextNineBahrain();
  }
  renderNextRun();
  setInterval(renderNextRun, 60_000);

  onAuthStateChanged(auth, (user)=>{
    if (!user) return;
    const sRef = ref(db, `users/${user.uid}/settings`);
    // Keep UI in sync
    onValue(sRef, (snap)=>{
      const v = snap.val() || {};
      const enabled = v.autoApplyEnabled !== false; // default true
      setPill(enabled);
    });

    let pending = false;
    toggleBtn.addEventListener('click', async ()=>{
      if (pending) return;
      pending = true;
      toggleBtn.disabled = true;
      try {
        const curSnap = await get(sRef);
        const v = curSnap.val() || {};
        const next = !(v.autoApplyEnabled !== false);
        await update(sRef, { autoApplyEnabled: next, updatedAt: Date.now() });
      } finally {
        toggleBtn.disabled = false;
        pending = false;
      }
    });
  });
})();
