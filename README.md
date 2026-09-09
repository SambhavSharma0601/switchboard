# Switchboard

A job-search console you deploy once and run from your phone.

It crawls company job boards directly — Greenhouse, Lever, Ashby, SmartRecruiters,
Recruitee, Workable and Workday — scores every posting against your profile,
rewrites your resume per job, and pushes new matches to Telegram on a schedule.

No credentials for LinkedIn or Naukri. No auto-submit. Nothing that can get an
account banned.

---

## Why crawl boards instead of scraping job sites

Aggregators are where 300 other people are already applying. These endpoints are
the raw feeds companies publish so their own careers page can render — the job
appears here the moment it goes live, often hours before it shows up on LinkedIn.
Reading them is what they exist for. The crawler runs server-side, so there is no
CORS ceiling and you get full descriptions to score against.

---

## Deploy

You need a laptop for about five minutes, once. Everything after that works from
a phone.

### 1. Push to GitHub

```bash
cd switchboard
git init
git add -A
git commit -m "switchboard"
gh repo create switchboard --private --source=. --push
# or create the repo on github.com and: git remote add origin <url> && git push -u origin main
```

### 2. Import into Vercel

Go to vercel.com → Add New → Project → import the repo → Deploy.
Framework is detected automatically. No settings to change.

It works immediately with zero environment variables. Crawling, scoring,
tracking, DOCX and PDF export all run without a single key.

### 3. Add to your home screen

Open the deployed URL on your phone → Share → Add to Home Screen. It behaves
like an app from then on.

---

## Optional environment variables

Add these in Vercel → Settings → Environment Variables. Every one is optional.

| Variable | What it unlocks |
|---|---|
| `ANTHROPIC_API_KEY` | Resume tailoring, cover notes, referral DMs, interview briefs |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | New matches pushed to your phone on a schedule |
| `CRON_SECRET` | Protects `/api/cron` from being triggered by anyone |
| `APP_URL` | Link back to the app in the Telegram digest |
| `MIN_SCORE` | Score threshold for a push. Default 55 |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Exact dedupe across scans instead of a rolling time window |

### Telegram in two minutes

1. Message `@BotFather`, send `/newbot`, copy the token → `TELEGRAM_BOT_TOKEN`
2. Message your new bot once (anything)
3. Message `@userinfobot`, copy your id → `TELEGRAM_CHAT_ID`
4. Redeploy. Hit `/api/cron` in a browser to test.

---

## First run

1. **Settings** — fill in name, email, phone, LinkedIn, employer name, notice
   period and CTC. Save.
2. **Feed → Sources** — run discovery on each group. It probes every provider
   with likely slugs for each company and keeps only the boards that return real
   jobs. Tap "Add all". Nothing is guessed into your list.
3. **Feed** — hit Scan. Expect a few hundred jobs pulled, ranked by fit.
4. Anything above 75, tap **Tailor**, paste the JD, download the resume, apply.
5. Before closing the tab, go to **Referrals** and send two messages.

Discovery is the one step that matters. A source list of 60 verified boards is
what makes the daily scan worth reading.

---

## Scheduled scanning

`vercel.json` registers a weekday cron at 03:30 UTC (09:00 IST). Vercel's Hobby
plan allows one run per day.

For more frequent scans, `.github/workflows/scan.yml` pings the same endpoint
every 30 minutes during working hours, free, from GitHub Actions. Add two repo
secrets: `APP_URL` and `CRON_SECRET`.

---

## How scoring works

`lib/score.js`, no API calls, runs in milliseconds:

- **Core skill overlap** — up to 45 points, the heaviest signal
- **Broad skill overlap** — up to 22
- **Title relevance** — 14
- **Domain match** — up to 18. This is the differentiator; telecom OSS/BSS and
  financial-platform keywords are what separate you from every other Java resume
- **Location** — +8 in target cities, −22 outside your geography
- **Freshness** — +10 posted today, decaying to a penalty past 45 days
- **Seniority guards** — heavy penalties for internships, principal/staff titles,
  and postings demanding several more years than you have
- **Exclusions** — anything matching your blocklist drops 45

All the weights are driven by the Matching section in Settings. Tune them once
you have seen a scan.

---

## Resume export

- **Print view** → a real A4 page, browser Save as PDF
- **.docx** → generated server-side with the `docx` library, a genuine Word file
  that ATS parsers read correctly, and editable if you want to fix a line
- **Plain text** → for the "paste your resume" boxes on Naukri and Workday

Layout is single column with no tables and no graphics, on purpose.

---

## Data and privacy

Your profile, pipeline, contacts and source list live in your browser's local
storage. Nothing is sent anywhere except:

- the public job feeds the crawler reads
- your job description and resume content to the Anthropic API, only when you
  press a tailoring button, and only if you set a key

`ANTHROPIC_API_KEY` stays server-side. Export a JSON backup from Settings before
clearing site data or moving phones.

---

## Layout

```
app/
  page.jsx                feed + board discovery
  resume/page.jsx         tailoring and export
  print/page.jsx          A4 print view
  pipeline/page.jsx       tracker with ghost detection
  referrals/page.jsx      people search, email patterns, outreach log
  settings/page.jsx       profile, screening answers, scoring weights, backup
  api/jobs                crawl + score
  api/discover            find which board a company uses
  api/tailor              Anthropic proxy
  api/resume/docx         real Word export
  api/cron                scheduled scan + Telegram push
lib/
  ats.js                  seven board providers
  score.js                the ranking engine
  resume.js               HTML and text rendering
  store.js                profile shape and local storage
  telegram.js             digest formatting
data/sources.json         candidate companies for discovery
```

---

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
```

## Extending

Adding a provider means one entry in `PROVIDERS` in `lib/ats.js` with a
`fetchJobs(token, company)` that returns the normalised job shape. Discovery
picks it up automatically.
