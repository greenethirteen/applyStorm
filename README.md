
# So Jobless Auto‑Apply Suite (v10k2)

- Frontend for Railway: `server.js`, `package.json`, and web files.
- Cloud Functions:
  - `applyNow` (HTTPS): filters jobs and **writes /applications nodes**; your existing SJBH Resend trigger sends employer emails.
  - `applyDaily` (Scheduler 09:00 Asia/Bahrain): same for all users; updates optional `/public/apply_stats`.
  - `aiCategorizeNow` / `aiCategorizeDaily`: optional AI role tags.
  - `imgProxy` / `cvProxy`: serve images & CV links from **your domain** for better deliverability.

## Setup
1) Edit `firebaseConfig.js` (already prefilled with your web app config). Update `APPLY_FUNCTION_URL` after you deploy.
2) Deploy Functions
```bash
cd functions
npm i
firebase functions:secrets:set RESEND_API_KEY
firebase functions:secrets:set FROM_EMAIL "So Jobless BH <team@sojobless.live>"
firebase functions:secrets:set BRAND_BASE_URL "https://sojobless.live"
# optional AI
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set OPENAI_MODEL gpt-4o-mini
firebase deploy --only functions
```
3) Deploy Hosting (for /i and /cv rewrites)
```bash
firebase deploy --only hosting
```
4) Run frontend locally or deploy to Railway
```bash
npm i
node server.js
```

## Notes
- Employer emails still handled by your existing SJBH Function on `/expats_jobs/{jobId}/applications/{uid}`.
- Summary emails now send from `team@sojobless.live` by default (change via secret).
- Image & CV links in emails are first‑party: `/i/:uid` and `/cv/:uid`.
