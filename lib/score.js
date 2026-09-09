/**
 * Local relevance scoring. No API, no cost, runs in milliseconds.
 *
 * v2 fixes:
 *  - word-boundary matching, so "java" no longer matches "javascript"
 *    and "oss" no longer matches "across" / "cross-functional"
 *  - geography is checked BEFORE remote, so "Remote - United States"
 *    is treated as a foreign role rather than friendly remote
 */

/* Token-based, so "Staff, Software Engineer (L4)" and "Sr." are caught
   the same as "Staff Engineer". Two tiers: reachable stretch vs out of range. */
const SENIOR_SOFT = /\b(senior|sr|snr)\b/i;
const SENIOR_HARD =
  /\b(staff|principal|distinguished|fellow|architect|lead|manager|director|head|vp|chief)\b/i;
const SENIOR_CODE_HARD = /\b(l[5-9]|ic[5-9]|e[6-9]|sde\s*-?\s*[4-9]|swe\s*-?\s*[4-9])\b/i;
/* level-3 means very different things at different companies, so it is a
   nudge rather than a veto */
const SENIOR_CODE_SOFT =
  /\b(l4|ic4|e5|sde\s*-?\s*3|swe\s*-?\s*3|engineer\s*-?\s*(?:iii|3))\b/i;

const JUNIOR_BLOCK = ["intern", "internship", "trainee", "apprentice", "fresher"];

const INDIA_RE = new RegExp(
  "\\b(india|bharat|bangalore|bengaluru|hyderabad|pune|gurgaon|gurugram|noida|" +
  "delhi|ncr|chennai|mumbai|kolkata|ahmedabad|chandigarh|mohali|jaipur|indore|" +
  "kochi|cochin|trivandrum|thiruvananthapuram|coimbatore|visakhapatnam|vizag|" +
  "bhubaneswar|nagpur|mysore|mysuru|vadodara|surat)\\b", "i"
);

/* Inverted geography: instead of listing every foreign country (a list that
   always has gaps — Estonia got through), anything that is not clearly India
   and not a bare "Remote" is treated as foreign. India-first by default. */
function bareRemote(loc) {
  const rest = String(loc || "")
    .toLowerCase()
    .replace(/\b(remote|anywhere|worldwide|global|distributed|work from home|wfh|hybrid|onsite|on-site|full[- ]?time|part[- ]?time)\b/g, " ")
    .replace(/[^a-z]+/g, " ")
    .trim();
  return rest.length === 0;
}

const REMOTE_RE = /\b(remote|anywhere|worldwide|distributed|work from home|wfh)\b/i;

const YEARS_RE = /(\d{1,2})\s*\+?\s*(?:to|-|–)?\s*(\d{1,2})?\s*(?:\+)?\s*years?/gi;

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9+#./ -]/g, " ").replace(/\s+/g, " ");
}

/**
 * Build a word-boundary matcher for a keyword.
 * exact=true  -> "java" matches "Java" but NOT "javascript"
 * exact=false -> "budget" also matches "budgets", "budgeting"
 */
function matcher(kw, exact) {
  const k = String(kw || "").trim().toLowerCase();
  if (k.length < 2) return null;
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pre = /^[a-z0-9]/.test(k) ? "\\b" : "";
  const post = /[a-z0-9]$/.test(k) ? (exact ? "\\b" : "(?:s|es|ing|ed)?\\b") : "";
  try {
    return new RegExp(pre + esc + post, "i");
  } catch (e) {
    return null;
  }
}

function hits(list, hay, exact) {
  const found = [];
  const absent = [];
  for (const raw of list || []) {
    const kw = String(raw || "").trim();
    if (!kw) continue;
    const re = matcher(kw, exact);
    if (!re) continue;
    if (re.test(hay)) found.push(kw.toLowerCase());
    else absent.push(kw.toLowerCase());
  }
  return { found, absent };
}

export function requiredYears(text) {
  const t = String(text || "").toLowerCase();
  let min = null;
  let m;
  YEARS_RE.lastIndex = 0;
  while ((m = YEARS_RE.exec(t))) {
    const a = parseInt(m[1], 10);
    if (isNaN(a) || a > 25) continue;
    const ctx = t.slice(Math.max(0, m.index - 40), m.index + 40);
    if (!/experien|exp\b|working|hands|industry/.test(ctx)) continue;
    if (min === null || a < min) min = a;
  }
  return min;
}

export function scoreJob(job, profile) {
  const hay = norm([job.title, job.department, job.location, job.description].join(" "));
  const title = norm(job.title);
  const rawLoc = String(job.location || "");
  const flags = [];
  let score = 0;
  let capped = null;

  /* ---------- geography first, and it can veto ---------- */
  const isIndia = INDIA_RE.test(rawLoc);
  const isRemote = REMOTE_RE.test(rawLoc);
  const isBareRemote = isRemote && bareRemote(rawLoc);
  const isForeign = !isIndia && !isBareRemote && rawLoc.trim().length > 0;

  if (isIndia) {
    score += 10;
    const locs = (profile.locations || "")
      .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (locs.some((l) => l && rawLoc.toLowerCase().includes(l))) score += 4;
  } else if (isForeign) {
    score -= 40;
    capped = 25;
    flags.push(isRemote ? "remote, not India" : "outside India");
  } else if (isBareRemote) {
    score += 4;
    flags.push("remote — check eligibility");
  }

  /* ---------- skills, with real word boundaries ---------- */
  const skillList = (profile.skillGroups || [])
    .flatMap((g) => String(g.v || "").split(","))
    .map((s) => s.trim())
    .filter((s) => s.length > 1);

  const core = (profile.coreSkills || []).map((s) => String(s).trim()).filter(Boolean);

  const skillHit = hits(skillList, hay, true);
  const coreHit = hits(core, hay, true);

  score += core.length ? (coreHit.found.length / core.length) * 45 : 0;
  score += Math.min(skillHit.found.length, 14) * 1.6;

  /* ---------- title ---------- */
  const titleWords = (profile.titleKeywords || []).map((s) => String(s).trim());
  if (hits(titleWords, title, false).found.length) score += 14;
  else if (/\b(engineer|developer|programmer|sde)\b/.test(title)) score += 6;

  /* ---------- domain, the differentiator ---------- */
  const domain = (profile.domainKeywords || []).map((s) => String(s).trim());
  const domainHit = hits(domain, hay, false).found;
  if (domainHit.length) {
    score += Math.min(domainHit.length, 3) * 6;
    flags.push("domain:" + domainHit.slice(0, 2).join("/"));
  }

  /* ---------- freshness ---------- */
  if (job.postedAt) {
    const days = (Date.now() - new Date(job.postedAt).getTime()) / 86400000;
    if (days <= 1) score += 10;
    else if (days <= 3) score += 6;
    else if (days <= 7) score += 3;
    else if (days > 45) score -= 8;
  }

  /* ---------- seniority ---------- */
  const yoe = parseFloat(profile.yoe || "0") || 0;
  if (JUNIOR_BLOCK.some((w) => title.includes(w))) { score -= 40; flags.push("internship"); }

  if (SENIOR_HARD.test(title) || SENIOR_CODE_HARD.test(title)) {
    score -= 42;
    capped = Math.min(capped === null ? 100 : capped, 30);
    flags.push("too senior");
  } else if (SENIOR_SOFT.test(title)) {
    score -= 24;
    flags.push("senior title");
  } else if (SENIOR_CODE_SOFT.test(title)) {
    score -= 12;
    flags.push("level 3 — stretch");
  }

  const req = requiredYears(job.description);
  if (req !== null) {
    const gap = req - yoe;
    if (gap >= 4) {
      score -= 34;
      capped = Math.min(capped === null ? 100 : capped, 30);
      flags.push(`asks ${req}+ yrs`);
    } else if (gap >= 2) { score -= 16; flags.push(`asks ${req}+ yrs`); }
  }

  /* ---------- exclusions ---------- */
  const excl = (profile.exclude || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (hits(excl, hay, false).found.length) { score -= 45; flags.push("excluded term"); }

  score = Math.max(0, Math.min(100, Math.round(score)));
  if (capped !== null) score = Math.min(score, capped);

  return {
    score,
    matched: coreHit.found.concat(skillHit.found.filter((s) => !coreHit.found.includes(s))).slice(0, 12),
    missing: coreHit.absent.slice(0, 8),
    flags,
    requiredYears: req,
    geo: isIndia ? "india" : isForeign ? "foreign" : isBareRemote ? "remote" : "unknown",
  };
}

export function rank(jobs, profile, { min = 0 } = {}) {
  return jobs
    .map((j) => ({ ...j, ...scoreJob(j, profile) }))
    .filter((j) => j.score >= min)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ad = a.postedAt ? new Date(a.postedAt).getTime() : 0;
      const bd = b.postedAt ? new Date(b.postedAt).getTime() : 0;
      return bd - ad;
    });
}