
/**
 * ---------- So Jobless BH — Auto-Apply Email Template ----------
 * renderAutoApplyEmail(props) -> returns a fully inlined HTML email.
 * Props:
 *  - jobsCount, candidateName, profileImageUrl, todayDate, year
 *  - dashboardUrl, preferencesUrl, notificationsUrl, helpUrl, brandLogoUrl
 *  - topJobs: [{ title, company, location }]
 */
function sjb_escapeHtml(str='') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function sjb_renderTopJobs(topJobs) {
  if (!Array.isArray(topJobs) || topJobs.length === 0) return '';
  const items = topJobs.slice(0, 3).map(j => {
    const title = sjb_escapeHtml(j.title || '');
    const company = sjb_escapeHtml(j.company || '');
    const location = sjb_escapeHtml(j.location || '');
    return `<div style="font-family: Arial, Helvetica, sans-serif; font-size:14px; color:#222; margin:6px 0;">
      <strong>${title}</strong> at ${company} <span style="color:#9b9b9b;">(${location})</span>
    </div>`;
  }).join('');
  return `
  <tr>
    <td style="padding:12px 4px 0 4px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;">
        <tr>
          <td style="padding:8px 12px; border:1px solid #f6f6f6; border-radius:10px;">
            <div style="font-family: Arial, Helvetica, sans-serif; font-size:13px; color:#777; margin:0 0 8px 0;">
              Today’s highlights:
            </div>
            ${items}
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}
function renderAutoApplyEmail(props={}) {
  const {
    jobsCount = 0,
    candidateName = 'Candidate Name',
    profileImageUrl = 'https://i.pravatar.cc/192?img=5',
    todayDate = '',
    year = new Date().getFullYear(),
    dashboardUrl = '#',
    preferencesUrl = '#',
    notificationsUrl = '#',
    helpUrl = '#',
    brandLogoUrl = 'https://upload.wikimedia.org/wikipedia/commons/3/3f/TransparentPlaceholder.png',
    topJobs = []
  } = props;
  const preheader = `Your ApplyStorm update: ${jobsCount} application(s) sent today.`;
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Auto-Apply Summary</title>
  <style>
    /* For preview only */
    body { background:#ffffff; }
    a:hover { opacity: .9; }
  </style>
</head>
<body style="margin:0; padding:0; background:#ffffff;">
  <!-- Preheader (hidden) -->
  <div style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
    ${sjb_escapeHtml(preheader)}
  </div>
  <center style="width:100%; background:#ffffff;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <!-- Container -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px; width:100%; background:#ffffff;">
            <!-- Brand Bar -->
            <tr>
              <td style="padding:4px 8px 0 8px;">
                <table role="presentation" width="100%">
                  <tr>
                    <td align="left">
                      <img src="${sjb_escapeHtml(brandLogoUrl)}" width="28" height="28" alt="So Jobless BH" style="display:block; border:0; background:#fd2f4b; border-radius:6px;" />
                    </td>
                    <td align="right" style="font-family: Arial, Helvetica, sans-serif; font-size:12px; color:#9b9b9b;">
                      ${sjb_escapeHtml(todayDate)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Card -->
            <tr>
              <td style="padding:20px 16px 16px 16px; border:1px solid #f1f1f1; border-radius:12px; background:#ffffff; text-align:center;">
                <h1 style="margin:0 0 6px 0; font-family: Arial, Helvetica, sans-serif; font-size:22px; line-height:30px; color:#111111; font-weight:700;">
                  Total Jobs We Applied for You Today
                </h1>
                <p style="margin:0 0 16px 0; font-family: Arial, Helvetica, sans-serif; font-size:14px; line-height:20px; color:#6b6b6b;">
                  Powered by <strong>So Jobless BH ApplyStorm</strong>
                </p>
                <div style="margin:6px 0 18px 0; font-family: Arial, Helvetica, sans-serif; font-size:56px; line-height:64px; color:#fd2f4b; font-weight:800; letter-spacing:-0.5px;">
                  ${sjb_escapeHtml(String(jobsCount))}
                </div>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;">
                  <tr>
                    <td align="center">
                      <img src="${sjb_escapeHtml(profileImageUrl)}" width="96" height="96" alt="${sjb_escapeHtml(candidateName)}"
                           style="display:block; border-radius:50%; border:1px solid #eeeeee; object-fit:cover;" />
                      <div style="font-family: Arial, Helvetica, sans-serif; font-size:16px; line-height:22px; color:#111111; font-weight:700; margin-top:8px;">
                        ${sjb_escapeHtml(candidateName)}
                      </div>
                      <div style="font-family: Arial, Helvetica, sans-serif; font-size:13px; line-height:18px; color:#6b6b6b; margin-top:2px;">
                        Great news—applications went out today. We’ll watch for replies.
                      </div>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 10px 0; font-family: Arial, Helvetica, sans-serif; font-size:15px; line-height:22px; color:#2b2b2b;">
                  We will keep <strong>auto-applying for matching jobs every day</strong> as they arrive—so you can focus on prepping for interviews.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 6px 0;">
                  <tr>
                    <td>
                      <a href="${sjb_escapeHtml(dashboardUrl)}"
                         style="background:#111111; color:#ffffff; text-decoration:none; display:inline-block; padding:12px 18px; border-radius:8px; font-family: Arial, Helvetica, sans-serif; font-size:14px; font-weight:700;">
                        View Today’s Applications
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:6px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size:12px; line-height:18px; color:#7a7a7a;">
                  Opens your dashboard filtered to today’s applications.
                </p>
                <p style="margin:8px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size:12px; line-height:18px; color:#7a7a7a; text-align:center;">
                  Want to fine-tune matches? <a href="${sjb_escapeHtml(preferencesUrl)}" style="color:#fd2f4b; text-decoration:none;">Update your preferences</a>.
                </p>
                <p style="margin:4px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size:12px; line-height:18px; color:#9a9a9a; text-align:center;">
                  Choose roles, locations, salary range, and how often we apply.
                </p>
              </td>
            </tr>
            ${sjb_renderTopJobs(topJobs)}
            <tr>
              <td align="center" style="padding:18px 8px 0 8px;">
                <p style="margin:0; font-family: Arial, Helvetica, sans-serif; font-size:12px; line-height:18px; color:#9b9b9b;">
                  You’re receiving this because ApplyStorm is enabled on your So Jobless BH account.
                  <a href="${sjb_escapeHtml(notificationsUrl)}" style="color:#9b9b9b; text-decoration:underline;">Manage notifications</a> •
                  <a href="${sjb_escapeHtml(helpUrl)}" style="color:#9b9b9b; text-decoration:underline;">Help</a>
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:10px 8px 30px 8px;">
                <p style="margin:0; font-family: Arial, Helvetica, sans-serif; font-size:11px; line-height:16px; color:#b9b9b9;">
                  © ${sjb_escapeHtml(String(year))} So Jobless BH • Manama, Bahrain
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;
}

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

// --- firebase-admin v12+ scoped imports ---
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const uniq = Array.from(new Set(found.map((s) => s.trim().toLowerCase())));
  return uniq.filter((e) => !e.endsWith("@example.com"));
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
      if (regs.some((r) => r.test(txt))) return true;
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

// ---------------- Email Builders ----------------

// Employer-facing application email (redesigned; red square button w/ soft radius)
function appEmailHTML({ brandUrl, user, job }) {
  const primary = "#fd2f4b";
  const logoUrl = `${brandUrl || "https://sojobless.live"}/logo.png`;

  const profileImg = user.profileImageUrl || user.photoURL || "";
  const cvUrl = user.userCV || user.cvURL || "#";

  const safe = (s) => (s || "").toString().replace(/</g,"&lt;").replace(/>/g,"&gt;");

  const userName = safe(user.fullName || user.name || "Candidate");
  const userTitle = safe(user.profession || user.title || "");
  const userDesc  = safe(user.about || "");
  const roleTitle = safe(job.jobTitle || job.title || "Position");

  return `
  <div style="font-family:'Inter', Arial, sans-serif; background:#f8fafc; padding:36px 0 12px 0; text-align:center;">
    <div style="margin-bottom:20px;">
      <img src="${logoUrl}" alt="So Jobless BH" style="height:48px;width:auto;display:inline-block;">
    </div>
    <div style="background:#fff; border-radius:18px; box-shadow:0 4px 22px ${primary}16; max-width:440px; margin:0 auto; padding:44px 28px 34px 28px;">
      ${profileImg ? `<img src="${profileImg}" style="width:100px;height:100px;border-radius:50%;margin-bottom:18px;box-shadow:0 1px 6px ${primary}19;object-fit:cover;">` : ""}
      <h2 style="margin:0 0 16px 0;font-size:1.6rem;font-weight:900;color:#111;letter-spacing:0.01em;">Application for: <span style="color:${primary};">${roleTitle}</span></h2>
      <h1 style="margin:10px 0 4px 0;font-size:2.1rem;font-weight:900;color:${primary};letter-spacing:0.01em;">${userName}</h1>
      ${userTitle ? `<div style="font-size:1.2rem;font-weight:700;color:#222;margin-bottom:8px;">${userTitle}</div>` : ""}
      ${userDesc ? `<div style="color:#444;font-size:1.06rem;line-height:1.6;margin:0 auto 26px auto;max-width:320px;">${userDesc}</div>` : ""}
      ${cvUrl && cvUrl !== "#" ? `<a href="${cvUrl}" style="display:inline-block;background:${primary};color:#fff;font-weight:700;padding:13px 28px;font-size:1.12rem;border-radius:8px;text-decoration:none;margin-bottom:12px;box-shadow:0 2px 10px ${primary}33;transition:background 0.17s;" target="_blank" rel="noopener">View CV</a>` : ""}
    </div>
    <div style="margin-top:36px;color:#999;font-size:0.99rem;">
      <div style="margin-bottom:7px;letter-spacing:0.04em;">This notification was sent by <span style="color:${primary};font-weight:700;">So Jobless BH</span></div>
      <div>
        <span style="margin:0 7px 0 0;">
          <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" alt="Instagram" style="height:16px;width:16px;vertical-align:middle;margin-right:2px;"> 
          <a href="https://instagram.com/sojobless.bh" style="color:${primary};text-decoration:none;">sojobless.bh</a>
        </span>|
        <span style="margin:0 7px;">
          <img src="https://cdn-icons-png.flaticon.com/512/3917/3917132.png" alt="Website" style="height:16px;width:16px;vertical-align:middle;margin-right:2px;">
          <a href="https://www.sojobless.live" style="color:${primary};text-decoration:none;">www.sojobless.live</a>
        </span>|
        <span style="margin:0 0 0 7px;">
          <img src="https://cdn-icons-png.flaticon.com/512/732/732200.png" alt="Email" style="height:16px;width:16px;vertical-align:middle;margin-right:2px;">
          <a href="mailto:hello@sojobless.live" style="color:${primary};text-decoration:none;">hello@sojobless.live</a>
        </span>
      </div>
    </div>
  </div>`;
}

// Candidate-facing daily/instant summary email
function buildSummaryEmailHTML({ brandUrl, user, attempted, titleTags }) {
  const primary = "#fd2f4b";
  const logoUrl = `${brandUrl || "https://sojobless.live"}/logo.png`;
  const safe = (s) => (s || "").toString().replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const name = safe(user.fullName || user.name || "");

  return `
  <div style="font-family:'Inter',Arial,sans-serif;background:#f8fafc;padding:36px 0 12px 0;text-align:center;">
    <div style="margin-bottom:16px;">
      <img src="${logoUrl}" alt="So Jobless BH" style="height:40px;width:auto;display:inline-block;">
    </div>
    <div style="background:#fff;border-radius:18px;box-shadow:0 4px 22px ${primary}16;max-width:560px;margin:0 auto;padding:28px 28px 24px;">
      <div style="font-size:0.95rem;color:#666;margin-bottom:8px;">Auto-Apply Summary</div>
      <div style="font-size:2.2rem;font-weight:900;color:${primary};line-height:1;margin-bottom:10px;">
        ${attempted}
      </div>
      <div style="font-size:1rem;color:#111;margin-bottom:14px;">
        job${attempted === 1 ? "" : "s"} applied for you today${name ? `, ${name}` : ""}.
      </div>
      ${Array.isArray(titleTags) && titleTags.length
        ? `<div style="font-size:0.95rem;color:#444;margin:0 auto 4px;max-width:420px;">
             Roles targeted: <strong>${titleTags.map(safe).join(", ")}</strong>
           </div>`
        : ""
      }
      <div style="font-size:0.88rem;color:#888;margin-top:8px;">
        We’ll keep matching and applying as new jobs arrive.
      </div>
    </div>
    <div style="margin-top:24px;color:#999;font-size:0.92rem;">
      Sent by <span style="color:${primary};font-weight:700;">So Jobless BH</span> · <a href="${brandUrl || "https://sojobless.live"}" style="color:${primary};text-decoration:none;">sojobless.live</a>
    </div>
  </div>`;
}

// ---------------- Mail sender ----------------
async function sendWithResend({ apiKey, from, to, subject, html }) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Resend failed ${resp.status}: ${t}`);
  }
  return resp.json();
}

// --- shared core used by both applyNow & applyDaily ------------------------
async function processApply({ uid, titleTags, brandUrl, from, apiKey }) {
  const wantedLower = titleTags.map((s) => String(s).trim().toLowerCase());

  const rec = await loadUserRecord(uid);
  if (!rec) return { ok: false, attempted: 0, error: "user profile not found" };
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
    const subj = `Today’s So Jobless BH Auto-Apply Summary`;
    const candidateName = (user.fullName || user.name || '').toString();
    const profileImageUrl = user.photoURL || user.profileImageUrl || '';
    const todayDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const year = new Date().getFullYear();
    const dashboardUrl = `${(brandUrl || 'https://sojobless.live')}/dashboard?filter=today&uid=${uid}`;
    const preferencesUrl = `${(brandUrl || 'https://sojobless.live')}/preferences`;
    const notificationsUrl = `${(brandUrl || 'https://sojobless.live')}/notifications`;
    const helpUrl = `${(brandUrl || 'https://sojobless.live')}/help`;
    const brandLogoUrl = `${(brandUrl || 'https://sojobless.live')}/logo.png`;
    const sumHtml = renderAutoApplyEmail({
      jobsCount: attempted,
      candidateName,
      profileImageUrl,
      todayDate,
      year,
      dashboardUrl,
      preferencesUrl,
      notificationsUrl,
      helpUrl,
      brandLogoUrl,
      topJobs: []
    });
    try {
      await sendWithResend({ apiKey, from, to: userEmail, subject: subj, html: sumHtml });
    } catch {}
  }

  return { ok: true, attempted };
}

// --- CORS helper -----------------------------------------------------------
function pickAllowOrigin(origin) {
  // Base allow-list (exact matches)
  const base = new Set([
    "https://sojobless.live",
    "http://localhost:3000",
    "http://localhost:8080",
    "https://applystorm-production.up.railway.app",
  ]);
  // Allow any *.up.railway.app (previews)
  let patternOk = false;
  try {
    const u = new URL(origin);
    patternOk = u.hostname.endsWith(".up.railway.app");
  } catch {}
  return base.has(origin) || patternOk ? origin : "https://sojobless.live";
}

// --- HTTP: Apply Now -------------------------------------------------------
export const applyNow = onRequest(
  { region: REGION, secrets: [RESEND_API_KEY, FROM_EMAIL, BRAND_BASE_URL], cors: true },
  async (req, res) => {
    // ---- CORS headers & preflight ----
    {
      const origin = req.headers.origin || "";
      const allowOrigin = pickAllowOrigin(origin);
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
        return res.status(400).json({ ok: false, error: "uid and titleTags required" });
      }
      const brandUrl = BRAND_BASE_URL.value() || "https://sojobless.live";
      const from = FROM_EMAIL.value() || "So Jobless BH <team@sojobless.live>";
      const apiKey = RESEND_API_KEY.value();
      if (!apiKey) return res.status(500).json({ ok: false, error: "RESEND_API_KEY missing" });

      const out = await processApply({ uid, titleTags, brandUrl, from, apiKey });
      return res.json(out);
    } catch (e) {
      console.error("applyNow error:", e);
      return res.status(500).json({ ok: false, error: String(e.message || e) });
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
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0 }),
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
      if (!jobsSnap.exists()) return res.json({ ok: true, updated: 0 });
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
      res.json({ ok: true, updated: updates.length });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: String(e.message || e) });
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
  const fromPath = (req.path || "").replace(/\/+$/, "").split("/").filter(Boolean).pop();
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
      "photoURL",
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

    const cvUrl = firstTruthy(rec.data, ["info.userCV", "userCV", "cvURL"]);
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
  { region: REGION, secrets: [RESEND_API_KEY, FROM_EMAIL], cors: true },
  async (req, res) => {
    // ---- CORS headers & preflight ----
    {
      const origin = req.headers.origin || "";
      const allowOrigin = pickAllowOrigin(origin);
      res.setHeader("Access-Control-Allow-Origin", allowOrigin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Max-Age", "3600");
      if (req.method === "OPTIONS") return res.status(204).send("");
    }

    try {
      if (req.method !== "POST") return res.status(405).send("Use POST");
      const { to, subject, html, jobsCount, candidateName, profileImageUrl, todayDate, year,
        dashboardUrl, preferencesUrl, notificationsUrl, helpUrl, brandLogoUrl,
        topJobs } = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
      if (!to || !subject)
        return res.status(400).json({ ok: false, error: "to, subject, html required" });
      const from = FROM_EMAIL.value() || "So Jobless BH <team@sojobless.live>";
      const apiKey = RESEND_API_KEY.value();
      const finalHtml = html || renderAutoApplyEmail({
        jobsCount, candidateName, profileImageUrl, todayDate, year,
        dashboardUrl, preferencesUrl, notificationsUrl, helpUrl, brandLogoUrl, topJobs
      });
      const out = await sendWithResend({ apiKey, from, to, subject, html: finalHtml });
      res.json({ ok: true, id: out.id || null });
    } catch (e) {
      console.error("sendApplicationEmail error:", e);
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  }
);
