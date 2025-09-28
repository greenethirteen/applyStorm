// ESM + Modular Admin SDK (Node.js 20)
import { initializeApp } from "firebase-admin/app";
import { getDatabase, ServerValue } from "firebase-admin/database";
import { getStorage } from "firebase-admin/storage";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onValueWritten } from "firebase-functions/v2/database";
import { logger } from "firebase-functions";
import fetch from "node-fetch";
import { Resend } from "resend";

// --- Init ---
initializeApp();
const db = getDatabase();
const BRAND_BASE = process.env.BRAND_BASE_URL || "https://sojobless.live";

// Resend (for user summary + employer emails)
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL = process.env.FROM_EMAIL || "So Jobless BH <team@sojobless.live>";
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// ---------------- Helpers ----------------
function textOfJob(j) {
  const parts = [
    j?.jobTitle || j?.title || "",
    j?.jobDescription || j?.description || "",
    j?.jobCategory || "",
    j?.company || j?.companyName || "",
  ];
  return parts.join(" ").toLowerCase();
}

function titleTagMap() {
  const m = {
    "barista": [/barista/],
    "waiter": [/waiter|waitress|server/],
    "kitchen helper": [/kitchen helper|commis|steward/],
    "chef": [/chef|cook|commis/i],
    "baker": [/baker|pastry/],
    "receptionist": [/receptionist/],
    "sales executive": [/sales(\s|-)executive|sales rep|salesperson|sales associate/],
    "cashier": [/cashier/],
    "storekeeper": [/storekeeper|store keeper|warehouse assistant/],
    "merchandiser": [/merchandiser/],
    "telesales": [/telesales|call center|callcentre|contact center/],
    "driver (light)": [/light\s*driver|delivery driver|motorbike|car driver/],
    "driver (heavy)": [/heavy\s*driver|trailer|truck driver|crane/],
    "electrician": [/electrician/],
    "plumber": [/plumber/],
    "ac technician": [/ac tech|hvac|air ?conditioning/],
    "carpenter": [/carpenter/],
    "mason": [/mason/],
    "painter": [/painter/],
    "welder": [/welder/],
    "mechanic": [/mechanic|technician auto/],
    "auto electrician": [/auto\s*electric/],
    "cctv technician": [/cctv/],
    "security guard": [/security guard|watchman/],
    "admin assistant": [/admin(istrative)? assistant|office assistant|secretary/],
    "data entry": [/data entry/],
    "hr assistant": [/hr assistant|human resources/],
    "accountant": [/accountant/],
    "it technician": [/it support|it technician|desktop support/],
    "web developer": [/web developer|frontend|front-end|javascript developer/],
    "software engineer": [/software engineer|backend developer|nodejs|java developer/],
    "qa/qc engineer": [/qa|qc|quality assurance|quality control/],
    "civil engineer": [/civil engineer/],
    "mechanical engineer": [/mechanical engineer/],
    "electrical engineer": [/electrical engineer/],
    "site engineer": [/site engineer/],
    "draftsman": [/draftsman|draughtsman|autocad/],
    "estimator": [/estimator|quantity surveyor|qs/],
    "foreman": [/foreman|supervisor/],
    "nurse": [/nurse/],
    "pharmacist": [/pharmacist/],
    "teacher": [/teacher|tutor/],
    "hairdresser": [/hairdresser|barber|stylist/],
    "beautician": [/beautician/],
    "butcher": [/butcher/],
    "printer (offset/gto)": [/gto|offset printer/],
  };
  for (const k in m) m[k] = m[k].map((x) => (x instanceof RegExp ? x : new RegExp(x, "i")));
  return m;
}

function getAiTag(job) {
  const ai = job?.ai || job?.AI || job?.ml || null;
  let tag = ai && (ai.titleTag || ai.role || ai.predicted || ai.primaryTag);
  return tag ? String(tag).trim().toLowerCase() : null;
}

function matchesSelection(job, wantedLower) {
  const ai = getAiTag(job);
  if (ai && wantedLower.includes(ai)) return true;

  const txt = textOfJob(job);
  const map = titleTagMap();
  for (const [tag, regs] of Object.entries(map)) {
    if (wantedLower.includes(tag)) {
      if (regs.some((r) => r.test(txt))) return true;
    }
  }
  return false;
}

// --------- Email building (shared) ----------
function brandHeader() {
  return `<table role="presentation" width="100%" style="background:#ffffff;border-bottom:1px solid #eee"><tr><td style="padding:24px 0;text-align:center">
  <div style="display:inline-block;background:#fd2f4b;color:#fff;border-radius:14px;padding:10px 12px;font-weight:700;font-family:Inter,Arial,sans-serif">SJ</div>
  <div style="font-family:Inter,Arial,sans-serif;font-size:14px;color:#fd2f4b;font-weight:800">So Jobless BH</div>
  </td></tr></table>`;
}

function profileCard(p) {
  const uid = p?.userId || p?.uid || "";
  const hasImg = !!(p?.profileImageUrl || p?.photoURL);
  const hasCV = !!(p?.userCV || p?.cvURL);
  const img = hasImg && uid ? `${BRAND_BASE}/i/${uid}` : "";
  const cv = hasCV && uid ? `${BRAND_BASE}/cv/${uid}` : "";
  const name = p?.fullName || p?.name || "";
  const title = p?.profession || p?.title || "";
  const about = p?.about || "";
  return `<div style="text-align:center;padding:16px 0">
    ${img ? `<img src="${img}" alt="${name}" style="width:84px;height:84px;border-radius:12px;object-fit:cover;display:inline-block;border:1px solid #eee" />` : ``}
    <div style="font-family:Inter,Arial,sans-serif;font-weight:700;font-size:18px;margin-top:8px">${name}</div>
    <div style="font-family:Inter,Arial,sans-serif;color:#555;font-size:13px">${title}</div>
    <div style="font-family:Inter,Arial,sans-serif;color:#666;font-size:13px;margin-top:6px;max-width:480px;margin-left:auto;margin-right:auto">${about}</div>
    ${cv ? `<div style="margin-top:10px"><a href="${cv}" style="display:inline-block;background:#fd2f4b;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:700;font-family:Inter,Arial,sans-serif">View CV</a></div>` : ``}
  </div>`;
}

function summaryEmailHTML(profile, summary) {
  return `<!doctype html><html><body style="margin:0;background:#f7f7f9">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:16px;overflow:hidden">
    ${brandHeader()}
    ${profileCard(profile)}
    <div style="padding:16px 20px;font-family:Inter,Arial,sans-serif">
      <div style="font-weight:800;font-size:18px">Summary</div>
      <div style="margin-top:8px;color:#444;font-size:14px">Type: <b>${summary.kind}</b></div>
      <div style="margin-top:4px;color:#444;font-size:14px">Applied today: <b>${summary.appliedToday}</b></div>
      ${typeof summary.totalApplied === "number" ? `<div style="margin-top:4px;color:#444;font-size:14px">Total applied: <b>${summary.totalApplied}</b></div>` : ""}
      ${summary.selectedTitleTags?.length ? `<div style="margin-top:4px;color:#444;font-size:14px">Roles: <b>${summary.selectedTitleTags.join(", ")}</b></div>` : ""}
    </div>
    <div style="text-align:center;padding:16px 0;color:#999;font-family:Inter,Arial,sans-serif;font-size:12px;border-top:1px solid #eee">© So Jobless BH</div>
  </div>
  </body></html>`;
}

async function sendUserSummaryEmail(profile, summaryHtml, subject) {
  if (!resend) return { skipped: true };
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: profile?.email,
      subject,
      html: summaryHtml,
      reply_to: "team@sojobless.live",
      headers: {
        "List-Unsubscribe": "<mailto:unsubscribe@sojobless.live?subject=unsubscribe>, <https://sojobless.live/unsubscribe>",
      },
    });
    return { ok: true };
  } catch (e) {
    logger.error("Resend summary error", e);
    return { ok: false, error: e?.message || String(e) };
  }
}

async function sendUserSummaryResend(profile, summary) {
  const html = summaryEmailHTML(profile, summary);
  const subject = `[So Jobless BH] ${summary.kind}: ${summary.appliedToday} applied`;
  return await sendUserSummaryEmail(profile, html, subject);
}

// Create application nodes (triggers employer sender)
async function writeApplicationNodes(profile, items) {
  const uid = profile?.userId || profile?.uid;
  const now = Date.now();
  const runId = `run_${now}`;
  let written = 0;

  for (const it of items) {
    const jobId = it?.jobId || it?.id;
    if (!jobId) continue;

    // de-dupe per user
    const already = await db.ref(`/users/${uid}/applied/${jobId}`).get();
    if (already.exists()) continue;

    const payload = {
      userId: uid,
      userEmail: profile?.email || "",
      createdAt: ServerValue.TIMESTAMP,
      runId,
      source: "auto-apply",
      selectedCategories: profile?.selectedCategories || null,
      selectedTitleTags: profile?.selectedTitleTags || null,
    };

    await db.ref(`/expats_jobs/${jobId}/applications/${uid}`).set(payload);
    await db.ref(`/users/${uid}/applied/${jobId}`).set(now);
    written++;
  }
  return { written, runId };
}

// Load profile from legacy "Users" or new "users"
async function loadUserProfile(uid) {
  const snap1 = await db.ref(`/Users/${uid}/info`).get();
  if (snap1.exists()) return snap1.val();
  const snap2 = await db.ref(`/users/${uid}/profile`).get();
  if (snap2.exists()) return snap2.val();
  return { userId: uid };
}

function freshJobsForApply(profile, jobs, selectedTitleTags) {
  const wantedLower = (selectedTitleTags || []).map((s) => String(s).toLowerCase());
  const out = [];
  for (const [jobId, job] of Object.entries(jobs || {})) {
    if (!matchesSelection(job, wantedLower)) continue;
    out.push({ jobId, ...job });
  }
  return out;
}

// ---------------- HTTPS: Apply Now ----------------
export const applyNow = onRequest({ cors: true, timeoutSeconds: 540 }, async (req, res) => {
  try {
    const { uid, categories = [], titleTags = [] } =
      req.method === "POST" ? (req.body || {}) : (req.query || {});
    if (!uid) return res.status(400).json({ error: "uid required" });

    const profile = await loadUserProfile(uid);

    if (titleTags?.length) await db.ref(`/users/${uid}/selectedTitleTags`).set(titleTags);
    if (categories?.length) await db.ref(`/users/${uid}/selectedCategories`).set(categories);

    const jobsSnap = await db.ref("/expats_jobs").get();
    const jobs = jobsSnap.exists() ? jobsSnap.val() : {};
    const selected = titleTags.length ? titleTags : (profile.selectedTitleTags || []);
    const fresh = freshJobsForApply(profile, jobs, selected);

    if (fresh.length) await writeApplicationNodes(profile, fresh);

    await sendUserSummaryResend(profile, {
      kind: fresh.length ? "Manual Apply — Confirmation" : "Manual Apply — No new jobs",
      appliedToday: fresh.length,
      totalApplied: null,
      selectedTitleTags: selected,
    });

    return res.json({ ok: true, attempted: fresh.length });
  } catch (e) {
    logger.error(e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

// ---------------- Scheduler: Daily Auto-Apply ----------------
export const applyDaily = onSchedule(
  { schedule: "every day 09:00", timeZone: "Asia/Bahrain" },
  async () => {
    try {
      const usersSnap = await db.ref("/users").get();
      if (!usersSnap.exists()) return;
      const allUsers = usersSnap.val();

      const jobsSnap = await db.ref("/expats_jobs").get();
      const jobs = jobsSnap.exists() ? jobsSnap.val() : {};
      let appliedTodayTotal = 0;

      for (const [uid, userNode] of Object.entries(allUsers)) {
        const profile = await loadUserProfile(uid);
        const selected = userNode?.selectedTitleTags || [];
        if (!selected || !selected.length) continue;

        const fresh = freshJobsForApply(profile, jobs, selected);
        if (!fresh.length) continue;

        await writeApplicationNodes(profile, fresh);
        appliedTodayTotal += fresh.length;

        await sendUserSummaryResend(profile, {
          kind: "Daily Auto-Apply — Summary",
          appliedToday: fresh.length,
          totalApplied: null,
          selectedTitleTags: selected,
        });
      }

      // public stats for homepage widget
      try {
        const refStat = db.ref("/public/apply_stats");
        const snap = await refStat.get();
        const prev = snap.exists() ? snap.val() : { yesterday: 0, total: 0 };
        const total = (prev.total || 0) + appliedTodayTotal;
        await refStat.update({ yesterday: appliedTodayTotal, total });
      } catch (e) {
        logger.error("public stats error", e);
      }
    } catch (e) {
      logger.error("applyDaily error", e);
    }
  }
);

// ---------------- AI Categorization (optional) ----------------
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

function makePromptForJob(job) {
  const title = job.jobTitle || job.title || "";
  const kws = Array.isArray(job.keywords) ? job.keywords.join(", ") : job.keywords || "";
  const desc = job.jobDescription || job.description || "";
  const company = job.company || job.companyName || "";
  const ROLE_TAXONOMY = [
    "Barista", "Waiter/Waitress", "Kitchen Helper", "Cook", "Chef", "Baker", "Receptionist",
    "Sales Executive", "Cashier", "Storekeeper", "Merchandiser", "Telesales/Call Center Agent",
    "Driver (Light)", "Driver (Heavy)", "Electrician", "Plumber", "AC Technician", "Carpenter",
    "Mason", "Painter", "Welder", "Mechanic", "Auto Electrician", "CCTV Technician",
    "Security Guard", "Admin Assistant", "Data Entry Clerk", "HR Assistant", "Accountant",
    "IT Technician", "Web Developer", "Software Engineer", "QA/QC Engineer", "Civil Engineer",
    "Mechanical Engineer", "Electrical Engineer", "Site Engineer", "Draftsman", "Estimator",
    "Foreman", "Nurse", "Pharmacist", "Teacher", "Hairdresser", "Beautician", "Butcher",
    "Printer (Offset/GTO)", "Other"
  ];
  return `You are a strict job-role classifier for GCC job postings.
Return a JSON object: {"titleTag": <one of ROLE_TAXONOMY>, "altTags": [up to 3], "confidence": 0..1}
ROLE_TAXONOMY = ${JSON.stringify(ROLE_TAXONOMY)}
Prefer the most specific role. If unsure, pick the closest rather than "Other".
Output JSON ONLY.

Title: ${title}
Company: ${company}
Keywords: ${kws}
Description: ${desc}`;
}

async function classifyWithOpenAI(job) {
  // Fallback heuristic if no key
  if (!OPENAI_API_KEY) {
    const txt = textOfJob(job);
    const map = titleTagMap();
    for (const [tag, regs] of Object.entries(map)) {
      if (regs.some((r) => r.test(txt))) {
        return { titleTag: tag, altTags: [], confidence: 0.65, provider: "heuristic", model: "regex" };
      }
    }
    return { titleTag: "Other", altTags: [], confidence: 0.2, provider: "heuristic", model: "regex" };
  }

  const body = {
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: "You classify GCC job postings into a fixed role taxonomy and return JSON only." },
      { role: "user", content: makePromptForJob(job) },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  };

  const resp = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify(body),
  });

  const data = await resp.json().catch(() => ({}));
  const text = data?.choices?.[0]?.message?.content || "{}";
  let parsed = {};
  try { parsed = JSON.parse(text); } catch {}
  const titleTag = parsed.titleTag || "Other";
  return {
    titleTag,
    altTags: Array.isArray(parsed.altTags) ? parsed.altTags.slice(0, 3) : [],
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.55,
    provider: OPENAI_API_KEY ? "openai" : "heuristic",
    model: body.model,
  };
}

async function upsertAiForJob(jobId, job) {
  const res = await classifyWithOpenAI(job);
  const payload = {
    titleTag: res.titleTag,
    altTags: res.altTags || [],
    confidence: res.confidence || 0,
    provider: res.provider || "heuristic",
    model: res.model || "",
    version: "v1-2025-09-27",
    ts: ServerValue.TIMESTAMP,
  };
  await db.ref(`/expats_jobs/${jobId}/ai`).set(payload);
  return payload;
}

export const aiCategorizeNow = onRequest({ cors: true, timeoutSeconds: 540 }, async (req, res) => {
  try {
    const limit = Number(req.query.limit || req.body?.limit || 100);
    const onlyMissing = String(req.query.onlyMissing || req.body?.onlyMissing || "true") !== "false";

    const snap = await db.ref("/expats_jobs").get();
    const val = snap.exists() ? snap.val() : {};
    const keys = Object.keys(val);

    let processed = 0, updated = 0;

    for (const id of keys) {
      if (processed >= limit) break;
      const j = val[id];
      if (onlyMissing && j?.ai?.titleTag) continue;
      processed++;
      try { await upsertAiForJob(id, j); updated++; }
      catch (e) { logger.error("AI classify error for job", id, e); }
    }

    return res.json({ ok: true, processed, updated });
  } catch (e) {
    logger.error(e);
    return res.status(500).json({ error: e.message || String(e) });
  }
});

export const aiCategorizeDaily = onSchedule(
  { schedule: "every day 08:30", timeZone: "Asia/Bahrain" },
  async () => {
    try {
      const snap = await db.ref("/expats_jobs").get();
      const val = snap.exists() ? snap.val() : {};
      const keys = Object.keys(val).slice(0, 500);
      for (const id of keys) {
        const j = val[id];
        if (j?.ai?.titleTag) continue;
        try { await upsertAiForJob(id, j); }
        catch (e) { logger.error("AI classify error for job", id, e); }
      }
    } catch (e) {
      logger.error("aiCategorizeDaily error", e);
    }
  }
);

// ---------------- Proxies for domain-first links ----------------
export const imgProxy = onRequest({ cors: true }, async (req, res) => {
  try {
    const uid = req.path.split("/").pop();
    if (!uid) return res.status(400).send("bad request");

    const file = getStorage().bucket().file(`profilePics/${uid}`);
    const [exists] = await file.exists();
    if (!exists) return res.status(404).send("not found");

    const [meta] = await file.getMetadata().catch(() => [{}]);
    res.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
    res.set("Content-Type", meta?.contentType || "image/jpeg");
    file.createReadStream().on("error", () => res.status(500).end()).pipe(res);
  } catch (e) {
    res.status(500).send("error");
  }
});

export const cvProxy = onRequest({ cors: true }, async (req, res) => {
  try {
    const uid = req.path.split("/").pop();
    if (!uid) return res.status(400).send("bad request");

    const [files] = await getStorage().bucket().getFiles({ prefix: `userCVs/${uid}_` });
    if (!files || !files.length) return res.status(404).send("not found");

    files.sort((a, b) => new Date(b.metadata.timeCreated) - new Date(a.metadata.timeCreated));
    const [url] = await files[0].getSignedUrl({ action: "read", expires: Date.now() + 60 * 60 * 1000 });

    res.set("Cache-Control", "private, max-age=300");
    return res.redirect(302, url);
  } catch (e) {
    res.status(500).send("error");
  }
});

// ---------------- Employer email trigger (replacement) ----------------
function extractEmailsFromText(txt) {
  if (!txt) return [];
  const regex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const found = txt.match(regex) || [];
  return [...new Set(found.map((e) => e.trim()))];
}

function employerEmailsFromJob(job) {
  const candidates = [
    job?.applyEmail, job?.apply_email, job?.email, job?.employerEmail, job?.contactEmail,
    job?.contact_email, job?.companyEmail
  ].filter(Boolean);

  const hay = [
    job?.jobDescription, job?.description, job?.requirements, job?.details,
    job?.contact, job?.company, job?.jobTitle, job?.title
  ].filter(Boolean).join(" ");

  const parsed = extractEmailsFromText(hay);
  const all = [...candidates, ...parsed].map((s) => s.trim().toLowerCase());
  const clean = all.filter((e) => !/example\.com|no-?reply@/i.test(e));
  return [...new Set(clean)].slice(0, 3);
}

function employerEmailHTML(profile, job) {
  const uid = profile?.userId || profile?.uid || "";
  const cvUrl = uid ? `${BRAND_BASE}/cv/${uid}` : "#";
  const header = `
    <div style="text-align:center;margin-bottom:8px">
      <div style="display:inline-block;background:#fd2f4b;color:#fff;border-radius:14px;padding:8px 10px;font-weight:700;font-family:Inter,Arial,sans-serif">SJ</div>
      <div style="font-family:Inter,Arial,sans-serif;font-size:13px;color:#fd2f4b;font-weight:800">So Jobless BH</div>
    </div>`;
  const intro = `
    <p style="font-family:Inter,Arial,sans-serif;color:#222;font-size:14px;line-height:1.55;margin:10px 0">
      Hello Hiring Team,<br/><br/>
      I’d like to apply for the <b>${job?.jobTitle || job?.title || "open position"}</b>.
      I’m ${profile?.fullName || profile?.name || "a candidate"} — ${profile?.profession || profile?.title || ""}.
    </p>`;
  const centeredProfile = profileCard(profile);
  const cta = `
    <div style="text-align:center;margin:14px 0">
      <a href="${cvUrl}" style="display:inline-block;background:#fd2f4b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:700;font-family:Inter,Arial,sans-serif">View CV</a>
    </div>`;
  const footer = `
    <div style="text-align:center;color:#999;font-size:12px;font-family:Inter,Arial,sans-serif;margin-top:12px">
      Sent via <b>So Jobless BH</b> — Bahrain jobs, auto-apply daily.
    </div>`;
  return `<!doctype html><html><body style="margin:0;background:#fff">
    <div style="max-width:640px;margin:0 auto;padding:14px 16px">
      ${header}
      ${intro}
      ${centeredProfile}
      ${cta}
      ${footer}
    </div>
  </body></html>`;
}

export const sendApplicationEmail = onValueWritten(
  { ref: "/expats_jobs/{jobId}/applications/{uid}" },
  async (event) => {
    try {
      // only on create
      if (event.data.before.exists() || !event.data.after.exists()) return;

      const { jobId, uid } = event.params;
      const node = event.data.after.val() || {};

      // idempotency: skip if already emailed
      if (node.emailed) return;

      // load job + user profile
      const jobSnap = await db.ref(`/expats_jobs/${jobId}`).get();
      if (!jobSnap.exists()) return;
      const job = jobSnap.val();

      const profile = await loadUserProfile(uid);

      // recipients
      const to = employerEmailsFromJob(job);
      if (!to.length || !resend) {
        logger.warn("No employer email found or Resend not configured", { jobId, uid });
        await db.ref(`/expats_jobs/${jobId}/applications/${uid}/emailed`).set(ServerValue.TIMESTAMP);
        return;
      }

      const html = employerEmailHTML(profile, job);
      const subject =
        `Application: ${profile?.profession || profile?.title || "Candidate"} — ` +
        `${profile?.fullName || profile?.name || ""}`;

      await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject,
        html,
        reply_to: profile?.email || "team@sojobless.live",
      });

      await db.ref(`/expats_jobs/${jobId}/applications/${uid}/emailed`).set(ServerValue.TIMESTAMP);
      logger.info("Employer email sent", { jobId, uid, to });
    } catch (e) {
      logger.error("sendApplicationEmail error", e);
    }
  }
);
