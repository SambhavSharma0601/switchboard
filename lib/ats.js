/**
 * Server-side crawlers for public job-board APIs.
 *
 * Every endpoint here is a public, unauthenticated feed that companies publish
 * so their careers page can render. Reading them is what they are for. Keep
 * concurrency low and cache results — that is the whole etiquette requirement.
 */

const UA = "Mozilla/5.0 (compatible; SwitchboardJobScanner/1.0)";
const TIMEOUT_MS = 12000;

async function get(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json", ...(opts.headers || {}) },
      cache: "no-store",
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function strip(html) {
  if (!html) return "";
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function iso(v) {
  if (!v) return null;
  const d = typeof v === "number" ? new Date(v) : new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function job(o) {
  return {
    id: o.id,
    company: o.company,
    title: o.title || "",
    location: o.location || "",
    url: o.url || "",
    postedAt: o.postedAt || null,
    description: (o.description || "").slice(0, 6000),
    provider: o.provider,
    department: o.department || "",
  };
}

/* ------------------------------------------------------------------ */
/*  Providers                                                          */
/* ------------------------------------------------------------------ */

export const PROVIDERS = {
  greenhouse: {
    label: "Greenhouse",
    probe: (t) => `https://boards-api.greenhouse.io/v1/boards/${t}/jobs`,
    async fetchJobs(token, company) {
      const d = await get(
        `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`
      );
      return (d.jobs || []).map((j) =>
        job({
          id: `gh:${token}:${j.id}`,
          company,
          title: j.title,
          location: j.location && j.location.name ? j.location.name : "",
          url: j.absolute_url,
          postedAt: iso(j.updated_at || j.first_published),
          description: strip(j.content),
          provider: "greenhouse",
          department:
            j.departments && j.departments[0] ? j.departments[0].name : "",
        })
      );
    },
  },

  lever: {
    label: "Lever",
    probe: (t) => `https://api.lever.co/v0/postings/${t}?mode=json&limit=1`,
    async fetchJobs(token, company) {
      const d = await get(`https://api.lever.co/v0/postings/${token}?mode=json`);
      const arr = Array.isArray(d) ? d : [];
      return arr.map((j) =>
        job({
          id: `lv:${token}:${j.id}`,
          company,
          title: j.text,
          location: (j.categories && j.categories.location) || "",
          url: j.hostedUrl || j.applyUrl,
          postedAt: iso(j.createdAt),
          description: j.descriptionPlain || strip(j.description),
          provider: "lever",
          department: (j.categories && j.categories.team) || "",
        })
      );
    },
  },

  ashby: {
    label: "Ashby",
    probe: (t) => `https://api.ashbyhq.com/posting-api/job-board/${t}`,
    async fetchJobs(token, company) {
      const d = await get(
        `https://api.ashbyhq.com/posting-api/job-board/${token}?includeCompensation=false`
      );
      return (d.jobs || [])
        .filter((j) => j.isListed !== false)
        .map((j) =>
          job({
            id: `ab:${token}:${j.id}`,
            company,
            title: j.title,
            location: j.location || (j.isRemote ? "Remote" : ""),
            url: j.jobUrl || j.applyUrl,
            postedAt: iso(j.publishedAt),
            description: j.descriptionPlain || strip(j.descriptionHtml),
            provider: "ashby",
            department: j.department || j.team || "",
          })
        );
    },
  },

  smartrecruiters: {
    label: "SmartRecruiters",
    probe: (t) => `https://api.smartrecruiters.com/v1/companies/${t}/postings?limit=1`,
    async fetchJobs(token, company) {
      const d = await get(
        `https://api.smartrecruiters.com/v1/companies/${token}/postings?limit=100`
      );
      return (d.content || []).map((j) => {
        const loc = j.location || {};
        return job({
          id: `sr:${token}:${j.id}`,
          company,
          title: j.name,
          location: [loc.city, loc.region, loc.country].filter(Boolean).join(", "),
          url: `https://jobs.smartrecruiters.com/${token}/${j.id}`,
          postedAt: iso(j.releasedDate),
          description: (j.jobAd && strip(JSON.stringify(j.jobAd))) || "",
          provider: "smartrecruiters",
          department: (j.department && j.department.label) || "",
        });
      });
    },
  },

  recruitee: {
    label: "Recruitee",
    probe: (t) => `https://${t}.recruitee.com/api/offers/`,
    async fetchJobs(token, company) {
      const d = await get(`https://${token}.recruitee.com/api/offers/`);
      return (d.offers || []).map((j) =>
        job({
          id: `rc:${token}:${j.id}`,
          company,
          title: j.title,
          location: [j.city, j.country].filter(Boolean).join(", "),
          url: j.careers_url || j.careers_apply_url,
          postedAt: iso(j.published_at || j.created_at),
          description: strip(j.description) + " " + strip(j.requirements),
          provider: "recruitee",
          department: j.department || "",
        })
      );
    },
  },

  workable: {
    label: "Workable",
    probe: (t) => `https://apply.workable.com/api/v1/widget/accounts/${t}?details=true`,
    async fetchJobs(token, company) {
      const d = await get(
        `https://apply.workable.com/api/v1/widget/accounts/${token}?details=true`
      );
      return (d.jobs || []).map((j) =>
        job({
          id: `wk:${token}:${j.shortcode}`,
          company,
          title: j.title,
          location: [j.city, j.state, j.country].filter(Boolean).join(", "),
          url: j.url || j.application_url,
          postedAt: iso(j.published_on || j.created_at),
          description: strip(j.description) + " " + strip(j.requirements),
          provider: "workable",
          department: j.department || "",
        })
      );
    },
  },

  workday: {
    label: "Workday",
    // token format: "tenant|wd3|SiteName"
    probe: (t) => {
      const [tenant, host, site] = String(t).split("|");
      return `https://${tenant}.${host}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`;
    },
    async fetchJobs(token, company) {
      const [tenant, host, site] = String(token).split("|");
      if (!tenant || !host || !site) throw new Error("token must be tenant|wdN|SiteName");
      const base = `https://${tenant}.${host}.myworkdayjobs.com`;
      const d = await get(`${base}/wday/cxs/${tenant}/${site}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: "" }),
      });
      return (d.jobPostings || []).map((j) =>
        job({
          id: `wd:${tenant}:${j.bulletFields ? j.bulletFields[0] : j.externalPath}`,
          company,
          title: j.title,
          location: j.locationsText || "",
          url: `${base}/${site}${j.externalPath}`,
          postedAt: null,
          description: j.postedOn || "",
          provider: "workday",
          department: "",
        })
      );
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Crawl                                                              */
/* ------------------------------------------------------------------ */

async function pool(items, size, worker) {
  const out = [];
  let i = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await worker(items[idx]);
    }
  });
  await Promise.all(runners);
  return out;
}

/**
 * @param {Array<{company:string, provider:string, token:string}>} sources
 * @returns {{jobs:Array, errors:Array}}
 */
export async function crawl(sources, { concurrency = 6 } = {}) {
  const results = await pool(sources, concurrency, async (s) => {
    const p = PROVIDERS[s.provider];
    if (!p) return { ok: false, source: s, error: "unknown provider" };
    try {
      const jobs = await p.fetchJobs(s.token, s.company);
      return { ok: true, source: s, jobs };
    } catch (e) {
      return { ok: false, source: s, error: String(e.message || e) };
    }
  });

  const jobs = [];
  const errors = [];
  const seen = new Set();
  for (const r of results) {
    if (!r) continue;
    if (r.ok) {
      for (const j of r.jobs) {
        if (seen.has(j.id)) continue;
        seen.add(j.id);
        jobs.push(j);
      }
    } else {
      errors.push({ company: r.source.company, provider: r.source.provider, error: r.error });
    }
  }
  return { jobs, errors };
}

/**
 * Try to work out which board a company uses. Probes each provider with a
 * handful of likely slugs and reports what responds.
 */
export async function discover(companyName) {
  const base = String(companyName || "").toLowerCase().trim();
  const slugs = Array.from(
    new Set([
      base.replace(/[^a-z0-9]/g, ""),
      base.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      base.split(/[^a-z0-9]+/)[0],
    ].filter(Boolean))
  );

  const attempts = [];
  for (const key of ["greenhouse", "lever", "ashby", "smartrecruiters", "recruitee", "workable"]) {
    for (const slug of slugs) attempts.push({ provider: key, token: slug });
  }

  const checked = await pool(attempts, 8, async (a) => {
    try {
      const jobs = await PROVIDERS[a.provider].fetchJobs(a.token, companyName);
      return { ...a, ok: true, count: jobs.length, sample: jobs.slice(0, 3).map((j) => j.title) };
    } catch (e) {
      return { ...a, ok: false };
    }
  });

  return checked.filter((c) => c && c.ok && c.count > 0);
}

/* ------------------------------------------------------------------ */
/*  Detect a board from a careers URL                                  */
/* ------------------------------------------------------------------ */

const URL_PATTERNS = [
  // most specific first
  { p: "greenhouse", re: /(?:boards|job-boards)\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_.-]+)/i },
  { p: "greenhouse", re: /api\.greenhouse\.io\/v1\/boards\/([a-z0-9_.-]+)/i },
  { p: "lever",      re: /jobs\.(?:eu\.)?lever\.co\/([a-z0-9_.-]+)/i },
  { p: "lever",      re: /api\.lever\.co\/v0\/postings\/([a-z0-9_.-]+)/i },
  { p: "ashby",      re: /jobs\.ashbyhq\.com\/([a-z0-9_.-]+)/i },
  { p: "ashby",      re: /api\.ashbyhq\.com\/posting-api\/job-board\/([a-z0-9_.-]+)/i },
  { p: "smartrecruiters", re: /jobs\.smartrecruiters\.com\/([a-z0-9_.-]+)/i },
  { p: "smartrecruiters", re: /careers\.smartrecruiters\.com\/([a-z0-9_.-]+)/i },
  { p: "workable",   re: /apply\.workable\.com\/([a-z0-9_.-]+)/i },
  { p: "workable",   re: /([a-z0-9-]+)\.workable\.com/i },
  { p: "recruitee",  re: /([a-z0-9-]+)\.recruitee\.com/i },
];

const WORKDAY_RE =
  /([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:wday\/cxs\/[a-z0-9-]+\/)?(?:[a-z]{2}-[A-Z]{2}\/)?([A-Za-z0-9_-]+)/;

const RESERVED = new Set(["www", "jobs", "careers", "apply", "boards", "api", "job-boards"]);

/** Pull provider + token out of a URL string, if one is embedded in it. */
export function parseBoardUrl(input) {
  const url = String(input || "").trim();
  if (!url) return null;

  const wd = url.match(WORKDAY_RE);
  if (wd) {
    const [, tenant, host, site] = wd;
    if (site && site.toLowerCase() !== "jobs") {
      return { provider: "workday", token: `${tenant}|${host}|${site}` };
    }
  }

  for (const { p, re } of URL_PATTERNS) {
    const m = url.match(re);
    if (m && m[1] && !RESERVED.has(m[1].toLowerCase())) {
      return { provider: p, token: m[1] };
    }
  }
  return null;
}

/**
 * Given any careers page URL, work out which board it runs on.
 * First tries the URL itself; if that fails, fetches the page and looks for
 * an embedded board reference — most company careers pages iframe one in.
 */
export async function detectFromUrl(input, companyHint) {
  const url = String(input || "").trim();
  if (!url) return { ok: false, error: "no url" };

  const direct = parseBoardUrl(url);
  const candidates = [];
  if (direct) candidates.push(direct);

  if (!direct) {
    let html = "";
    try {
      const target = /^https?:\/\//i.test(url) ? url : "https://" + url;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const res = await fetch(target, {
        signal: ctrl.signal,
        headers: { "User-Agent": UA, Accept: "text/html,*/*" },
        redirect: "follow",
        cache: "no-store",
      });
      clearTimeout(timer);
      html = (await res.text()).slice(0, 800000);
    } catch (e) {
      return { ok: false, error: "could not load that page: " + String(e.message || e) };
    }

    const seen = new Set();
    const wdAll = html.match(new RegExp(WORKDAY_RE.source, "gi")) || [];
    for (const frag of wdAll.slice(0, 8)) {
      const hit = parseBoardUrl(frag);
      if (hit && !seen.has(hit.provider + hit.token)) {
        seen.add(hit.provider + hit.token);
        candidates.push(hit);
      }
    }
    for (const { p, re } of URL_PATTERNS) {
      const all = html.match(new RegExp(re.source, "gi")) || [];
      for (const frag of all.slice(0, 8)) {
        const hit = parseBoardUrl(frag);
        if (hit && !seen.has(hit.provider + hit.token)) {
          seen.add(hit.provider + hit.token);
          candidates.push(hit);
        }
      }
    }
  }

  if (!candidates.length) {
    return { ok: false, error: "no job board found on that page" };
  }

  // verify each candidate actually returns jobs
  const company = companyHint || "";
  const verified = [];
  for (const c of candidates.slice(0, 6)) {
    try {
      const jobs = await PROVIDERS[c.provider].fetchJobs(c.token, company || c.token);
      if (jobs.length) {
        verified.push({
          ...c,
          count: jobs.length,
          sample: jobs.slice(0, 3).map((j) => j.title),
          indiaCount: jobs.filter((j) => /india|bangalore|bengaluru|hyderabad|pune|gurgaon|gurugram|noida|chennai|mumbai|delhi/i.test(j.location || "")).length,
        });
      }
    } catch (e) { /* candidate did not pan out */ }
  }

  if (!verified.length) {
    return { ok: false, error: "found a board reference but it returned no jobs", candidates };
  }
  return { ok: true, found: verified };
}