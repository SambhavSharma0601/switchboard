import { crawl } from "../../../lib/ats";
import { rank } from "../../../lib/score";
import { sendTelegram, formatDigest, telegramConfigured } from "../../../lib/telegram";
import { DEFAULT_PROFILE } from "../../../lib/store";
import seed from "../../../data/sources.json";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Scheduled scan. Called by Vercel Cron (see vercel.json) or by the
 * GitHub Actions workflow in .github/workflows/scan.yml.
 *
 * Dedupe strategy, in order of preference:
 *  1. Upstash/Vercel KV if KV_REST_API_URL + KV_REST_API_TOKEN are set
 *  2. Otherwise a rolling window: only jobs posted in the last WINDOW_HOURS
 *
 * Protect the route by setting CRON_SECRET and calling with
 *   Authorization: Bearer <CRON_SECRET>
 */

const WINDOW_HOURS = Number(process.env.SCAN_WINDOW_HOURS || 26);
const MIN_SCORE = Number(process.env.MIN_SCORE || 55);

function kvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kv(command) {
  const res = await fetch(process.env.KV_REST_API_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.KV_REST_API_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error("KV " + res.status);
  return res.json();
}

async function filterUnseen(jobs) {
  if (!kvConfigured()) {
    const cutoff = Date.now() - WINDOW_HOURS * 3600000;
    return jobs.filter((j) => j.postedAt && new Date(j.postedAt).getTime() >= cutoff);
  }
  const out = [];
  for (const j of jobs) {
    try {
      // SET key value NX EX 2592000  -> only succeeds the first time
      const r = await kv(["SET", "seen:" + j.id, "1", "NX", "EX", "2592000"]);
      if (r && r.result === "OK") out.push(j);
    } catch (e) {
      out.push(j); // never lose a job to a KV hiccup
    }
  }
  return out;
}

async function loadSources() {
  if (!kvConfigured()) return seed.boards || [];
  try {
    const r = await kv(["GET", "sources"]);
    if (r && r.result) {
      const parsed = JSON.parse(r.result);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (e) { /* fall through */ }
  return seed.boards || [];
}

async function loadProfile() {
  if (!kvConfigured()) return DEFAULT_PROFILE;
  try {
    const r = await kv(["GET", "profile"]);
    if (r && r.result) return { ...DEFAULT_PROFILE, ...JSON.parse(r.result) };
  } catch (e) { /* fall through */ }
  return DEFAULT_PROFILE;
}

async function run() {
  const sources = await loadSources();
  if (!sources.length) {
    return { ok: false, reason: "no boards configured", sent: 0 };
  }

  const profile = await loadProfile();
  const { jobs, errors } = await crawl(sources.slice(0, 120), { concurrency: 8 });
  const ranked = rank(jobs, profile, { min: MIN_SCORE });
  const fresh = await filterUnseen(ranked);

  let sent = 0;
  if (fresh.length && telegramConfigured()) {
    const appUrl = process.env.APP_URL || "";
    const msg = formatDigest(fresh, appUrl);
    const r = await sendTelegram(msg);
    if (r.ok) sent = Math.min(fresh.length, 15);
  }

  return {
    ok: true,
    sources: sources.length,
    crawled: jobs.length,
    matched: ranked.length,
    new: fresh.length,
    sent,
    telegram: telegramConfigured(),
    dedupe: kvConfigured() ? "kv" : `${WINDOW_HOURS}h window`,
    errors: errors.slice(0, 10),
    topNew: fresh.slice(0, 10).map((j) => ({
      score: j.score, company: j.company, title: j.title, url: j.url,
    })),
  };
}

function authorised(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // unset means open; set it in production
  const header = req.headers.get("authorization") || "";
  return header === "Bearer " + secret;
}

export async function GET(req) {
  if (!authorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });
  try {
    return Response.json(await run());
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 500 });
  }
}

export const POST = GET;
