/**
 * Cloud Functions for So Jobless BH — Auto Apply
 * Node.js 20 / Firebase Functions v2 (https)
 *
 * Exports:
 *  - applyNow: apply immediately for a given user & selected roles
 *  - applyDaily: scheduled daily auto-apply for all opted-in users
 *  - aiCategorizeNow / aiCategorizeDaily: optional role tagging
 *  - imgProxy / cvProxy: robust proxies for profile image & CV
 *  - sendApplicationEmailHttp: passthrough to Resend (optional)
 */

import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";

// --- firebase-admin v12+ scoped imports (replaces `* as admin from "firebase-admin"`) ---
import { initializeApp, getApps } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

// Initialize admin (guard if already initialized)
if (!getApps().length) {
  initializeApp();
}
const rtdb = getDatabase();

// --- Secrets ---------------------------------------------------------------
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const FROM_EMAIL     = defineSecret("FROM_EMAIL");
const BRAND_BASE_URL = defineSecret("BRAND_BASE_URL");
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY"); // optional
const OPENAI_MODEL   = defineSecret("OPENAI_MODEL");   // optional

// --- Helpers ---------------------------------------------------------------
const REGION = "us-central1";
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// Extract emails in free text (very permissive)
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig;

function getContactEmails(job) {
  const fields = [
    job.email, job.contactEmail, job.applyEmail, job.companyEmail,
    job.contact, job.hrEmail, job.hrContact, job.recruiterEmail,
    job.description, job.jobDescription
  ].filter(Boolean);

  let found = [];
  for (const f of fields) {
    if (typeof f === "string") {
      const m = f.match(EMAIL_RE);
      if (m) found.push(...m);
    } else if (Array.isArray(f)) {
      for (const v of f) {
        if (typeof v === "string") {
          const m = v.match(EMAIL_RE);
          if (m) found.push(...m);
        }
      }
    }
  }
  const uniq = Array.from(new Set(found.map(s => s.trim().toLowerCase())));
  return uniq.filter(e => !e.endsWith("@example.com"));
}

// Role taxonomy (lowercase keys)
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
  "printer (offset/gto)": [/gto|offset printer/i]
};

function aiTag(job) {
  const ai = job?.ai;
  const t = ai?.titleTag || ai?.role || ai?.predicted || ai?.primaryTag;
  return t ? String(t).toLowerCase() : null;
}
function textOfJob(j) {
  const parts = [
    j?.jobTitle || j?.title || "",
    j?.jobDescription || j?.description || "",
    j?.jobCategory || "",
    j?.company || j?.companyName || ""
  ];
  return parts.join(" ").toLowerCase();
}
function matchesRole(job, wantedLower) {
  const tag = aiTag(job);
  if (tag && wantedLower.includes(tag)) return true;
  const txt = textOfJob(job);
  for (const [k, regs] of Object.entries(REGEX_MAP)) {
    if (wantedLower.includes(k)) {
      if (regs.some(r => r.test(txt))) return true;
    }
  }
  return false;
}

// --- User loading (lowercase `/users` only; case-sensitive keys) -----------
async function loadUserRecord(uid) {
  // Prefer `/users/{uid}/info`, fallback to `/users/{uid}`
  const paths = [`/users/${uid}/info`, `/users/${uid}`];
  for (const p of paths) {
    const snap = await rtdb.ref(p).get();
    if (snap.exists()) {
      const val = snap.val();
      if (p.endsWith("/info")) return { data: { info: val }, path: p };
      return { data: val, path: p };
    }
  }
  return null;
}

function firstTruthy(obj, keys) {
  for (const k of keys) {
    const parts = k.split(".");
    let cur = obj;
    for (const p of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
      else { cur = undefined; break; }
    }
    if (cur) return cur;
  }
  return undefined;
}

// Build application email HTML
function appEmailHTML({ brandUrl, user, job }) {
  const profileImg = user.profileImageUrl || user.photoURL || "";
  const cvUrl = user.userCV || user.cvURL || "#";
  const safe = (s) => (s || "").toString().replace(/</g,"&lt;").replace(/>/g,"&gt;");

  return `
  <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background:#f7f7f8;padding:24px 0;font-family:Inter,Segoe UI,Arial,sans-serif;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="background:#fff;border-radius:16px;border:1px solid #eee;overflow:hidden">
          <tr>
            <td style="padding:20px 24px;border-bottom:1px solid #eee;background:#fff">
              <table width="100%"><tr>
                <td align="left">
                  <span style="display:inline-flex;align-items:center;gap:10px">
                    <span style="width:36px;height:36px;border-radius:10px;background:#fd2f4b;display:inline-grid;place-items:center;color:#fff;font-weight:800">SJ</span>
                    <span style="font-weight:800;color:#fd2f4b">So Jobless BH</span>
                  </span>
                </td>
              </tr></table>
            </td>
          </tr>

          <tr><td style="padding:28px 24px">
            <h1 style="margin:0 0 8px 0;font-size:20px;line-height:28px">Application for: ${safe(job.jobTitle || job.title || "Position")}</h1>
            <p style="margin:0 0 16px 0;color:#555">Dear Hiring Team,</p>
            <p style="margin:0 0 16px 0;color:#555">
              I’d like to apply for the <strong>${safe(job.jobTitle || job.title || "role")}</strong> at ${safe(job.company || job.companyName || "")}.
              Below are my details. I’d be grateful for the opportunity to interview.
            </p>

            <table width="100%" cellspacing="0" cellpadding="0" style="margin:12px 0 16px 0">
              <tr>
                <td width="72" valign="top">
                  ${profileImg ? `<img src="${profileImg}" width="64" height="64" style="border-radius:12px;object-fit:cover;border:1px solid #eee" />` : ""}
                </td>
                <td valign="top" style="font-size:14px;color:#111">
                  <div style="font-weight:800">${safe(user.fullName || user.name || "")}</div>
                  <div style="color:#666;margin-top:2px">${safe(user.profession || user.title || "")}</div>
                  <div style="color:#444;margin-top:8px">${safe(user.about || "")}</div>
                </td>
              </tr>
            </table>

            ${cvUrl && cvUrl !== "#" ? `
              <div style="margin:12px 0 6px 0">
                <a href="${cvUrl}" style="background:#111;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:600" target="_blank">
                  View CV
                </a>
              </div>
              <div style="font-size:12px;color:#888;margin-top:4px">If the button doesn’t work, paste this in your browser:<br>${cvUrl}</div>
            ` : ""}
          </td></tr>

          <tr>
            <td style="padding:16px 24px;border-top:1px solid #eee;color:#888;font-size:12px">
              Sent via <strong>So Jobless BH</strong> — we match jobseekers with 1,300+ live jobs in Bahrain.
              <div style="margin-top:6px">
                <a href="${brandUrl}" style="color:#888;text-decoration:underline" target="_blank">${brandUrl}</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  `;
}

// Send an email through Resend
async function sendWithResend({ apiKey, from, to, subject, html }) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from, to, subject, html })
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Resend failed ${resp.status}: ${t}`);
  }
  return resp.json();
}

// --- shared core used by both applyNow & applyDaily ------------------------
async function processApply({ uid, titleTags, brandUrl, from, apiKey }) {
  const wantedLower = titleTags.map(s => String(s).trim().toLowerCase());

  const rec = await loadUserRecord(uid);
  if (!rec) return { ok:false, attempted:0, error:"user profile not found" };
  const user = rec.data.info ? rec.data.info : rec.data;

  const jobsSnap = await rtdb.ref("/expats_jobs").get();
  const jobs = jobsSnap.exists() ? jobsSnap.val() : {};

  let attempted = 0;
  const applyLogRef = rtdb.ref(`/applyLog/${uid}`);
  const appliedSnap = await applyLogRef.get();
  const already = appliedSnap.exists() ? appliedSnap.val() : {};

  for (const [jobId, job] of Object.entries(jobs)) {
    if (already[jobId]) continue;
    if (!matchesRole(job, wantedLower)) continue;

    const toList = getContactEmails(job);
    if (toList.length === 0) continue;

    const subject = `Application — ${user.fullName || user.name || user.email || "Candidate"} for ${job.jobTitle || job.title || "position"}`;
    const html = appEmailHTML({ brandUrl, user, job });

    try {
      await sendWithResend({ apiKey, from, to: toList[0], subject, html });
      attempted++;
      await applyLogRef.child(jobId).set({ ts: Date.now(), to: toList[0], title: job.jobTitle || job.title || "" });
      await wait(150);
    } catch (e) {
      console.error("Email send failed:", jobId, e);
    }
  }

  // summary to the user
  const userEmail = user.email || user.contactEmail || null;
  if (userEmail && attempted > 0) {
    const subj = `Applied to ${attempted} job(s) — So Jobless BH`;
    const sumHtml = `
      <div style="font-family:Inter,Arial,sans-serif">
        <p>Hi ${user.fullName || user.name || ""},</p>
        <p>We just applied to <strong>${attempted}</strong> job(s) on your behalf.</p>
        <p>Selected roles: ${titleTags.join(", ")}</p>
        <p>We'll keep auto-applying daily as new matches arrive.</p>
        <p style="color:#888">So Jobless BH</p>
      </div>`;
    try { await sendWithResend({ apiKey, from, to: userEmail, subject: subj, html: sumHtml }); } catch {}
  }

  return { ok:true, attempted };
}

// --- HTTP: Apply Now -------------------------------------------------------
export const applyNow = onRequest(
  { region: REGION, secrets: [RESEND_API_KEY, FROM_EMAIL, BRAND_BASE_URL] },
  async (req, res) => {
    // ---- CORS headers & preflight ----
    {
      const origin = req.headers.origin || "";
      const allowed = ["https://sojobless.live", "http://localhost:8080", "http://localhost:3000"];
      const allowOrigin = allowed.includes(origin) ? origin : allowed[0];
      res.setHeader("Access-Control-Allow-Origin", allowOrigin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Max-Age", "3600");
      if (req.method === "OPTIONS") {
        return res.status(204).send("");
      }
    }

    try {
      if (req.method !== "POST") return res.status(405).send("Use POST");
      const body = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
      const { uid, titleTags } = body;
      if (!uid || !Array.isArray(titleTags) || titleTags.length === 0) {
        return res.status(400).json({ ok:false, error:"uid and titleTags required" });
      }
      const brandUrl = BRAND_BASE_URL.value() || "https://sojobless.live";
      const from = FROM_EMAIL.value() || "So Jobless BH <team@sojobless.live>";
      const apiKey = RESEND_API_KEY.value();
      if (!apiKey) return res.status(500).json({ ok:false, error:"RESEND_API_KEY missing" });

      const out = await processApply({ uid, titleTags, brandUrl, from, apiKey });
      return res.json(out);
    } catch (e) {
      console.error("applyNow error:", e);
      return res.status(500).json({ ok:false, error:String(e.message || e) });
    }
  }
);

// --- Daily scheduler (06:00 UTC ~ 09:00 Bahrain) ---------------------------
export const applyDaily = onSchedule(
  { region: REGION, schedule: "0 6 * * *", timeZone: "UTC", secrets: [RESEND_API_KEY, FROM_EMAIL, BRAND_BASE_URL] },
  async () => {
    const brandUrl = BRAND_BASE_URL.value() || "https://sojobless.live";
    const from = FROM_EMAIL.value() || "So Jobless BH <team@sojobless.live>";
    const apiKey = RESEND_API_KEY.value();
    if (!apiKey) return;

    // ONLY lowercase `/users`
    const snap = await rtdb.ref("/users").get();
    if (!snap.exists()) return;
    const users = snap.val();

    for (const [uid, u] of Object.entries(users)) {
      const tags = u.selectedTitleTags;
      if (!Array.isArray(tags) || tags.length === 0) continue;
      await processApply({ uid, titleTags: tags, brandUrl, from, apiKey });
      await wait(250);
    }
  }
);

// --- Optional AI tagging ---------------------------------------------------
async function aiSuggestRole(title, description) {
  const key = OPENAI_API_KEY.value?.();
  const model = OPENAI_MODEL.value?.() || "gpt-4o-mini";
  if (!key) return null;
  const prompt = `You will receive a job title and description.
Return ONLY one short role label from this list that best matches: ${Object.keys(REGEX_MAP).join(", ")}.
If none, return "other".

Title: ${title}
Description: ${description}
Role:`;
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role:"user", content: prompt }], temperature: 0 })
  });
  if (!resp.ok) return null;
  const j = await resp.json();
  const role = j.choices?.[0]?.message?.content?.trim()?.toLowerCase();
  return role && role !== "other" ? role : null;
}

export const aiCategorizeNow = onRequest(
  { region: REGION, secrets: [OPENAI_API_KEY, OPENAI_MODEL] },
  async (_req, res) => {
    try {
      const jobsSnap = await rtdb.ref("/expats_jobs").limitToFirst(200).get();
      if (!jobsSnap.exists()) return res.json({ ok:true, updated: 0 });
      const updates = [];
      for (const [jobId, job] of Object.entries(jobsSnap.val())) {
        if (aiTag(job)) continue;
        const role = await aiSuggestRole(job.jobTitle || job.title || "", job.jobDescription || job.description || "");
        if (role) {
          updates.push(rtdb.ref(`/expats_jobs/${jobId}/ai/titleTag`).set(role));
          await wait(50);
        }
      }
      await Promise.allSettled(updates);
      res.json({ ok:true, updated: updates.length });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok:false, error:String(e.message || e) });
    }
  }
);

export const aiCategorizeDaily = onSchedule(
  { region: REGION, schedule: "0 */6 * * *", timeZone: "UTC", secrets: [OPENAI_API_KEY, OPENAI_MODEL] },
  async () => {
    const jobsSnap = await rtdb.ref("/expats_jobs").limitToFirst(200).get();
    if (!jobsSnap.exists()) return;
    for (const [jobId, job] of Object.entries(jobsSnap.val())) {
      if (aiTag(job)) continue;
      const role = await aiSuggestRole(job.jobTitle || job.title || "", job.jobDescription || job.description || "");
      if (role) {
        await rtdb.ref(`/expats_jobs/${jobId}/ai/titleTag`).set(role);
        await wait(100);
      }
    }
  }
);

// --- Robust image & CV proxies --------------------------------------------
function getUidFromReq(req) {
  const fromPath = (req.path || "").replace(/\/+$/,'').split("/").filter(Boolean).pop();
  return req.query.uid || fromPath || null;
}

export const imgProxy = onRequest({ region: REGION, cors: true }, async (req, res) => {
  try {
    const uid = getUidFromReq(req);
    if (!uid) return res.status(400).send("Missing uid");

    const rec = await loadUserRecord(uid);
    if (!rec) return res.status(404).send("User not found");

    const imgUrl = firstTruthy(rec.data, [
      "info.profileImageUrl",
      "profileImageUrl",
      "photoURL"
    ]);
    if (!imgUrl) return res.status(404).send("No profile image");

    const upstream = await fetch(imgUrl);
    if (!upstream.ok) return res.status(502).send("Upstream fetch failed");

    const ctype = upstream.headers.get("content-type") || "image/jpeg";
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Content-Type", ctype);
    res.setHeader("Access-Control-Allow-Origin", "*");

    const buf = Buffer.from(await upstream.arrayBuffer());
    return res.status(200).send(buf);
  } catch (e) {
    console.error("imgProxy error:", e);
    return res.status(500).send("Proxy error");
  }
});

export const cvProxy = onRequest({ region: REGION, cors: true }, async (req, res) => {
  try {
    const uid = getUidFromReq(req);
    if (!uid) return res.status(400).send("Missing uid");

    const rec = await loadUserRecord(uid);
    if (!rec) return res.status(404).send("User not found");

    const cvUrl = firstTruthy(rec.data, [
      "info.userCV",
      "userCV",
      "cvURL"
    ]);
    if (!cvUrl) return res.status(404).send("No CV URL");

    const upstream = await fetch(cvUrl);
    if (!upstream.ok) return res.status(502).send("Upstream fetch failed");

    const ctype = upstream.headers.get("content-type") || "application/pdf";
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Content-Type", ctype);
    res.setHeader("Access-Control-Allow-Origin", "*");

    const buf = Buffer.from(await upstream.arrayBuffer());
    return res.status(200).send(buf);
  } catch (e) {
    console.error("cvProxy error:", e);
    return res.status(500).send("Proxy error");
  }
});

// --- Optional passthrough email endpoint -----------------------------------
export const sendApplicationEmailHttp = onRequest(
  { region: REGION, secrets: [RESEND_API_KEY, FROM_EMAIL] },
  async (req, res) => {
    // Optional CORS if calling from browser
    {
      const origin = req.headers.origin || "";
      const allowed = ["https://sojobless.live", "http://localhost:8080", "http://localhost:3000"];
      const allowOrigin = allowed.includes(origin) ? origin : allowed[0];
      res.setHeader("Access-Control-Allow-Origin", allowOrigin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Max-Age", "3600");
      if (req.method === "OPTIONS") return res.status(204).send("");
    }

    try {
      if (req.method !== "POST") return res.status(405).send("Use POST");
      const { to, subject, html } = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
      if (!to || !subject || !html) return res.status(400).json({ ok:false, error:"to, subject, html required" });
      const from = FROM_EMAIL.value() || "So Jobless BH <team@sojobless.live>";
      const apiKey = RESEND_API_KEY.value();
      const out = await sendWithResend({ apiKey, from, to, subject, html });
      res.json({ ok:true, id: out.id || null });
    } catch (e) {
      console.error("sendApplicationEmail error:", e);
      res.status(500).json({ ok:false, error:String(e.message || e) });
    }
  }
);
