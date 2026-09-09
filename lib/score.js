/**
 * Local relevance scoring. No API, no cost, runs in milliseconds.
 * The Claude tailoring step is optional; this is what ranks the feed.
 */

const SENIOR_BLOCK = [
  "senior staff", "staff engineer", "principal", "distinguished", "architect",
  "engineering manager", "director", "head of", "vp ", "vice president",
  "lead engineer", "tech lead", "team lead", "sde iii", "sde 3", "l5", "l6",
];

const JUNIOR_BLOCK = ["intern", "internship", "trainee", "apprentice", "fresher"];

const YEARS_RE = /(\d{1,2})\s*\+?\s*(?:to|-|–)?\s*(\d{1,2})?\s*(?:\+)?\s*years?/gi;

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9+#./ ]/g, " ").replace(/\s+/g, " ");
}

function tokenSet(s) {
  return new Set(norm(s).split(" ").filter(Boolean));
}

/** Pull the minimum years-of-experience the posting asks for. */
export function requiredYears(text) {
  const t = String(text || "").toLowerCase();
  let min = null;
  let m;
  YEARS_RE.lastIndex = 0;
  while ((m = YEARS_RE.exec(t))) {
    const a = parseInt(m[1], 10);
    if (isNaN(a) || a > 25) continue;
    // ignore "years of college" style noise
    const ctx = t.slice(Math.max(0, m.index - 40), m.index + 40);
    if (!/experien|exp\b|working|hands|industry/.test(ctx)) continue;
    if (min === null || a < min) min = a;
  }
  return min;
}

/**
 * @param {object} job
 * @param {object} profile
 * @returns {{score:number, matched:string[], missing:string[], flags:string[]}}
 */
export function scoreJob(job, profile) {
  const hay = norm([job.title, job.department, job.location, job.description].join(" "));
  const title = norm(job.title);
  const flags = [];

  const skills = (profile.skillGroups || [])
    .flatMap((g) => String(g.v || "").split(","))
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 1);

  const mustHaves = (profile.coreSkills || [])
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const matched = [];
  const missing = [];

  let skillHits = 0;
  for (const s of skills) {
    if (!s) continue;
    if (hay.includes(s)) { skillHits++; matched.push(s); }
  }
  let coreHits = 0;
  for (const s of mustHaves) {
    if (hay.includes(s)) { coreHits++; if (!matched.includes(s)) matched.push(s); }
    else missing.push(s);
  }

  // --- signal weights -------------------------------------------------
  let score = 0;

  // core stack overlap is the single biggest signal
  score += mustHaves.length ? (coreHits / mustHaves.length) * 45 : 0;

  // broad skill overlap
  score += Math.min(skillHits, 14) * 1.6; // up to ~22

  // title relevance
  const titleWords = (profile.titleKeywords || []).map((s) => s.toLowerCase());
  if (titleWords.some((w) => title.includes(w))) score += 14;
  else if (/engineer|developer|programmer|sde/.test(title)) score += 6;

  // domain bonus — the differentiator
  const domainWords = (profile.domainKeywords || []).map((s) => s.toLowerCase());
  const domainHit = domainWords.filter((w) => w && hay.includes(w));
  if (domainHit.length) {
    score += Math.min(domainHit.length, 3) * 6; // up to 18
    flags.push("domain:" + domainHit.slice(0, 2).join("/"));
  }

  // location
  const locs = (profile.locations || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const jobLoc = norm(job.location);
  if (locs.some((l) => l && jobLoc.includes(l))) score += 8;
  else if (/remote|anywhere/.test(jobLoc)) score += 5;
  else if (jobLoc && !/india|bangalore|bengaluru|hyderabad|pune|gurgaon|gurugram|noida|delhi|chennai|mumbai|chandigarh|mohali|remote/.test(jobLoc)) {
    score -= 22;
    flags.push("outside target geography");
  }

  // freshness
  if (job.postedAt) {
    const days = (Date.now() - new Date(job.postedAt).getTime()) / 86400000;
    if (days <= 1) score += 10;
    else if (days <= 3) score += 6;
    else if (days <= 7) score += 3;
    else if (days > 45) score -= 8;
  }

  // seniority guards
  const yoe = parseFloat(profile.yoe || "0") || 0;
  if (JUNIOR_BLOCK.some((w) => title.includes(w))) {
    score -= 40;
    flags.push("internship");
  }
  if (SENIOR_BLOCK.some((w) => title.includes(w))) {
    score -= 30;
    flags.push("too senior by title");
  }
  const req = requiredYears(job.description);
  if (req !== null) {
    const gap = req - yoe;
    if (gap >= 4) { score -= 32; flags.push(`asks ${req}+ yrs`); }
    else if (gap >= 2) { score -= 14; flags.push(`asks ${req}+ yrs`); }
    else if (gap <= -1 && req <= 1) { score -= 6; }
  }

  // hard exclusions
  const excl = (profile.exclude || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (excl.some((w) => w && hay.includes(w))) {
    score -= 45;
    flags.push("excluded term");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, matched: matched.slice(0, 12), missing: missing.slice(0, 8), flags, requiredYears: req };
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
