/**
 * Local relevance scoring. No API, no cost, runs in milliseconds.
 *
 * v2 fixes:
 *  - word-boundary matching, so "java" no longer matches "javascript"
 *    and "oss" no longer matches "across" / "cross-functional"
 *  - geography is checked BEFORE remote, so "Remote - United States"
 *    is treated as a foreign role rather than friendly remote
 */

const SENIOR_BLOCK = [
  "senior staff", "staff engineer", "principal", "distinguished", "architect",
  "engineering manager", "director", "head of", "vp ", "vice president",
  "lead engineer", "tech lead", "team lead", "sde iii", "sde 3", "l5", "l6",
];

const JUNIOR_BLOCK = ["intern", "internship", "trainee", "apprentice", "fresher"];

const INDIA_RE = new RegExp(
  "\\b(india|bharat|bangalore|bengaluru|hyderabad|pune|gurgaon|gurugram|noida|" +
  "delhi|ncr|chennai|mumbai|kolkata|ahmedabad|chandigarh|mohali|jaipur|indore|" +
  "kochi|cochin|trivandrum|thiruvananthapuram|coimbatore|visakhapatnam|vizag|" +
  "bhubaneswar|nagpur|mysore|mysuru|vadodara|surat)\\b", "i"
);

const FOREIGN_RE = new RegExp(
  "\\b(united states|usa|u\\.s\\.|us|canada|toronto|vancouver|montreal|" +
  "united kingdom|uk|london|manchester|ireland|dublin|germany|berlin|munich|" +
  "france|paris|netherlands|amsterdam|belgium|spain|madrid|barcelona|" +
  "portugal|lisbon|poland|warsaw|krakow|romania|bucharest|czech|prague|" +
  "sweden|stockholm|denmark|copenhagen|norway|oslo|finland|helsinki|" +
  "switzerland|zurich|austria|vienna|italy|milan|greece|athens|" +
  "israel|tel aviv|turkey|istanbul|australia|sydney|melbourne|brisbane|" +
  "new zealand|auckland|japan|tokyo|korea|seoul|china|shanghai|beijing|" +
  "shenzhen|singapore|hong kong|taiwan|taipei|philippines|manila|cebu|" +
  "vietnam|hanoi|thailand|bangkok|indonesia|jakarta|malaysia|kuala lumpur|" +
  "brazil|sao paulo|mexico|guadalajara|argentina|buenos aires|colombia|" +
  "bogota|chile|santiago|peru|costa rica|uae|dubai|abu dhabi|saudi|riyadh|" +
  "qatar|doha|bahrain|kuwait|egypt|cairo|nigeria|lagos|kenya|nairobi|" +
  "south africa|cape town|johannesburg|emea|latam|americas|europe|" +
  "north america|south america|middle east)\\b", "i"
);

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
  const isForeign = !isIndia && FOREIGN_RE.test(rawLoc);

  if (isIndia) {
    score += 10;
    const locs = (profile.locations || "")
      .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (locs.some((l) => l && rawLoc.toLowerCase().includes(l))) score += 4;
  } else if (isForeign) {
    score -= 40;
    capped = 25;
    flags.push(isRemote ? "remote, but not India" : "outside India");
  } else if (isRemote) {
    score += 4;
    flags.push("remote — check eligibility");
  } else if (rawLoc.trim()) {
    score -= 18;
    flags.push("location unclear");
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
  if (SENIOR_BLOCK.some((w) => title.includes(w))) { score -= 30; flags.push("too senior by title"); }

  const req = requiredYears(job.description);
  if (req !== null) {
    const gap = req - yoe;
    if (gap >= 4) { score -= 32; flags.push(`asks ${req}+ yrs`); }
    else if (gap >= 2) { score -= 14; flags.push(`asks ${req}+ yrs`); }
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
    geo: isIndia ? "india" : isForeign ? "foreign" : isRemote ? "remote" : "unknown",
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