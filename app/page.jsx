"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, Note, Spinner, scoreColor, ageBar, ageLabel } from "./ui";
import { KEYS, load, save, loadProfile, uid } from "../lib/store";
import seed from "../data/sources.json";

export default function Feed() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [sources, setSources] = useState([]);
  const [feed, setFeed] = useState({ jobs: [], stats: null, errors: [], scannedAt: null });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [min, setMin] = useState(50);
  const [age, setAge] = useState(30);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("feed");
  const [pipeline, setPipeline] = useState([]);

  useEffect(() => {
    setProfile(loadProfile());
    setSources(load(KEYS.sources, seed.boards || []));
    setFeed(load(KEYS.feed, { jobs: [], stats: null, errors: [], scannedAt: null }));
    setPipeline(load(KEYS.pipeline, []));
  }, []);

  const scan = async () => {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources, profile, min: 0, maxAgeDays: 90 }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const next = { ...data };
      setFeed(next);
      save(KEYS.feed, next);
      if (!data.jobs.length && data.hint) setErr(data.hint);
    } catch (e) {
      setErr(String(e.message || e));
    }
    setBusy(false);
  };

  const shown = useMemo(() => {
    const cutoff = Date.now() - age * 86400000;
    const needle = q.trim().toLowerCase();
    return (feed.jobs || []).filter((j) => {
      if (j.score < min) return false;
      if (j.postedAt && new Date(j.postedAt).getTime() < cutoff) return false;
      if (needle) {
        const hay = (j.title + " " + j.company + " " + j.location).toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [feed, min, age, q]);

  const tracked = useMemo(() => new Set(pipeline.map((p) => p.jobId || p.url)), [pipeline]);

  const track = (j) => {
    const next = [
      { id: uid(), jobId: j.id, stage: "saved", at: new Date().toISOString(),
        title: j.title, company: j.company, location: j.location, url: j.url, score: j.score },
      ...pipeline,
    ];
    setPipeline(next); save(KEYS.pipeline, next);
  };

  const tailor = (j) => {
    save("sb.tailorSeed", { title: j.title, company: j.company, url: j.url, id: j.id });
    router.push("/resume?from=feed");
  };

  if (!profile) return <div className="page"><Spinner /></div>;

  return (
    <>
      <Bar
        title="Switchboard"
        sub={
          feed.scannedAt
            ? `${shown.length} shown · scanned ${new Date(feed.scannedAt).toLocaleString()}`
            : `${sources.length} board${sources.length === 1 ? "" : "s"} configured`
        }
      />
      <div className="page">
        <div className="seg mb">
          <button className={tab === "feed" ? "on" : ""} onClick={() => setTab("feed")}>Feed</button>
          <button className={tab === "sources" ? "on" : ""} onClick={() => setTab("sources")}>Sources</button>
        </div>

        {tab === "feed" ? (
          <>
            <button className="btn" onClick={scan} disabled={busy || !sources.length}>
              {busy ? <Spinner /> : null}
              {busy ? "Crawling boards" : `Scan ${sources.length} boards`}
            </button>

            {!sources.length ? (
              <div className="mt">
                <Note tone="warn">
                  No boards yet. Open <b>Sources</b> and run discovery — it probes every
                  provider for each company and keeps the ones that actually respond.
                </Note>
              </div>
            ) : null}

            {err ? <div className="mt"><Note tone="warn">{err}</Note></div> : null}

            {feed.stats ? (
              <div className="mt small muted">
                {feed.stats.raw} jobs pulled from {feed.stats.sources} boards in{" "}
                {(feed.stats.ms / 1000).toFixed(1)}s
                {feed.errors && feed.errors.length
                  ? ` · ${feed.errors.length} board${feed.errors.length === 1 ? "" : "s"} failed`
                  : ""}
              </div>
            ) : null}

            {feed.jobs && feed.jobs.length ? (
              <>
                <div className="mt panel">
                  <label className="f" style={{ marginBottom: 8 }}>
                    <span className="lbl">Minimum score — {min}</span>
                    <input type="range" min="0" max="95" step="5" value={min}
                      style={{ width: "100%" }}
                      onChange={(e) => setMin(Number(e.target.value))} />
                  </label>
                  <div className="row wrap" style={{ marginBottom: 8 }}>
                    {[1, 3, 7, 14, 30, 90].map((d) => (
                      <button key={d} className={"chip" + (age === d ? " on" : "")}
                        onClick={() => setAge(d)}>{d}d</button>
                    ))}
                  </div>
                  <input className="i" placeholder="Filter by title, company or city"
                    value={q} onChange={(e) => setQ(e.target.value)} />
                </div>

                <div className="mt">
                  {shown.map((j) => (
                    <div className="job" key={j.id}>
                      <div className="gauge">
                        <div className="n" style={{ color: scoreColor(j.score) }}>{j.score}</div>
                        <div className="bar" style={{ background: ageBar(j.postedAt) }} />
                        <div className="age">{ageLabel(j.postedAt)}</div>
                      </div>
                      <div className="grow">
                        <div className="t">{j.title}</div>
                        <div className="m">
                          {j.company}{j.location ? " · " + j.location : ""}
                        </div>
                        {j.flags && j.flags.length ? (
                          <div className="row wrap" style={{ marginTop: 6 }}>
                            {j.flags.map((f) => (
                              <span key={f}
                                className={"chip " + (f.startsWith("domain:") ? "ok" : "warn")}>
                                {f.replace("domain:", "")}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {j.matched && j.matched.length ? (
                          <div className="s">{j.matched.slice(0, 8).join(" · ")}</div>
                        ) : null}
                        <div className="acts">
                          <a className="btn sm" href={j.url} target="_blank" rel="noreferrer">Apply</a>
                          <button className="btn quiet sm" onClick={() => tailor(j)}>Tailor</button>
                          <button className="btn quiet sm" onClick={() => track(j)}
                            disabled={tracked.has(j.id) || tracked.has(j.url)}>
                            {tracked.has(j.id) || tracked.has(j.url) ? "Tracked" : "Track"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!shown.length ? (
                    <div className="mt muted small">
                      Nothing above {min} in the last {age} days. Drop the score or widen the window.
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {feed.errors && feed.errors.length ? (
              <div className="sect">
                <h2>Boards that failed</h2>
                <div className="sub">
                  Usually a wrong token. Re-run discovery for these in Sources.
                </div>
                {feed.errors.map((e, i) => (
                  <div key={i} className="small muted" style={{ padding: "5px 0" }}>
                    {e.company} · {e.provider} · {e.error}
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <Sources sources={sources} setSources={setSources} />
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Sources({ sources, setSources }) {
  const groups = seed.candidates || {};
  const [busy, setBusy] = useState("");
  const [results, setResults] = useState([]);
  const [manual, setManual] = useState({ company: "", provider: "greenhouse", token: "" });
  const [log, setLog] = useState("");

  const have = useMemo(
    () => new Set(sources.map((s) => s.provider + ":" + s.token)), [sources]);

  const persist = (next) => { setSources(next); save(KEYS.sources, next); };

  const runDiscovery = async (companies, label) => {
    setBusy(label); setResults([]); setLog("");
    const found = [];
    const batches = [];
    for (let i = 0; i < companies.length; i += 8) batches.push(companies.slice(i, i + 8));
    let done = 0;
    for (const batch of batches) {
      try {
        const res = await fetch("/api/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companies: batch }),
        });
        const data = await res.json();
        for (const r of data.results || []) {
          for (const f of r.found || []) found.push({ company: r.company, ...f });
        }
      } catch (e) { /* keep going */ }
      done += batch.length;
      setLog(`Probed ${done} of ${companies.length} — ${found.length} boards found`);
      setResults([...found]);
    }
    setBusy("");
  };

  const addAll = () => {
    const next = [...sources];
    for (const r of results) {
      const key = r.provider + ":" + r.token;
      if (!next.some((s) => s.provider + ":" + s.token === key)) {
        next.push({ company: r.company, provider: r.provider, token: r.token });
      }
    }
    persist(next);
  };

  return (
    <div>
      <Note>
        Discovery probes Greenhouse, Lever, Ashby, SmartRecruiters, Recruitee and Workable
        with likely slugs for each company, and keeps only the boards that return real jobs.
        Nothing is guessed into your list.
      </Note>

      <div className="sect">
        <h2>Discover by group</h2>
        <div className="sub">Each group takes 20–60 seconds. Run one at a time.</div>
        <div className="stack">
          {Object.entries(groups).map(([name, list]) => (
            <button key={name} className="btn quiet" disabled={!!busy}
              onClick={() => runDiscovery(list, name)}>
              {busy === name ? <Spinner /> : null}
              {name} ({list.length})
            </button>
          ))}
        </div>
        {log ? <div className="small muted mt">{log}</div> : null}
      </div>

      {results.length ? (
        <div className="sect">
          <h2>Found {results.length}</h2>
          <button className="btn mb" onClick={addAll}>Add all to my sources</button>
          {results.map((r, i) => (
            <div key={i} className="between" style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
              <div className="grow">
                <div className="small b">{r.company}</div>
                <div className="tiny muted">
                  {r.provider} · {r.token} · {r.count} jobs
                </div>
              </div>
              <button className="btn quiet sm"
                disabled={have.has(r.provider + ":" + r.token)}
                onClick={() => persist([...sources, { company: r.company, provider: r.provider, token: r.token }])}>
                {have.has(r.provider + ":" + r.token) ? "Added" : "Add"}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="sect">
        <h2>Add from a careers URL</h2>
        <div className="sub">
          The fastest way to add the companies you actually want. Paste any careers
          page and it works out the board — including Workday, which discovery cannot guess.
        </div>
        <FromUrl sources={sources} persist={persist} have={have} />
      </div>

      <div className="sect">
        <h2>Add a board by hand</h2>
        <div className="sub">
          Workday tokens use the form <code>tenant|wd3|SiteName</code>, read off the careers URL.
        </div>
        <input className="i mb" placeholder="Company" value={manual.company}
          onChange={(e) => setManual({ ...manual, company: e.target.value })} />
        <select className="i mb" value={manual.provider}
          onChange={(e) => setManual({ ...manual, provider: e.target.value })}>
          {["greenhouse", "lever", "ashby", "smartrecruiters", "recruitee", "workable", "workday"]
            .map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input className="i mb" placeholder="Token / slug" value={manual.token}
          onChange={(e) => setManual({ ...manual, token: e.target.value })} />
        <button className="btn quiet"
          disabled={!manual.company || !manual.token}
          onClick={() => { persist([...sources, { ...manual }]); setManual({ company: "", provider: "greenhouse", token: "" }); }}>
          Add board
        </button>
      </div>

      <div className="sect">
        <h2>My boards ({sources.length})</h2>
        {sources.length ? sources.map((s, i) => (
          <div key={i} className="between" style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
            <div className="grow">
              <div className="small b">{s.company}</div>
              <div className="tiny muted">{s.provider} · {s.token}</div>
            </div>
            <button className="btn quiet sm"
              onClick={() => persist(sources.filter((_, j) => j !== i))}>Remove</button>
          </div>
        )) : <div className="small muted">Empty.</div>}

        {sources.length ? (
          <div className="mt">
            <button className="btn quiet sm"
              onClick={() => navigator.clipboard.writeText(JSON.stringify(sources, null, 2))}>
              Copy as JSON for data/sources.json
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}


function FromUrl({ sources, persist, have }) {
  const [url, setUrl] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);

  const go = async () => {
    setBusy(true); setRes(null);
    try {
      const r = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, company }),
      });
      setRes(await r.json());
    } catch (e) {
      setRes({ ok: false, error: String(e.message || e) });
    }
    setBusy(false);
  };

  return (
    <div>
      <input className="i mb" placeholder="Company name" value={company}
        onChange={(e) => setCompany(e.target.value)} />
      <input className="i mb" placeholder="https://company.com/careers"
        value={url} onChange={(e) => setUrl(e.target.value)} />
      <button className="btn" disabled={busy || !url.trim()} onClick={go}>
        {busy ? <Spinner /> : null} {busy ? "Checking" : "Detect board"}
      </button>

      {res && res.error ? <div className="mt"><Note tone="warn">{res.error}</Note></div> : null}

      {res && res.ok ? (
        <div className="mt">
          {res.found.map((f, i) => (
            <div key={i} className="between"
              style={{ padding: "9px 0", borderBottom: "1px solid var(--line-soft)" }}>
              <div className="grow">
                <div className="small b">{f.provider} · {f.token}</div>
                <div className="tiny muted">
                  {f.count} jobs
                  {typeof f.indiaCount === "number"
                    ? ` · ${f.indiaCount} in India`
                    : ""}
                </div>
                {f.sample && f.sample.length ? (
                  <div className="tiny muted truncate">{f.sample.join(" · ")}</div>
                ) : null}
              </div>
              <button className="btn quiet sm"
                disabled={have.has(f.provider + ":" + f.token)}
                onClick={() => persist([...sources,
                  { company: company || f.token, provider: f.provider, token: f.token }])}>
                {have.has(f.provider + ":" + f.token) ? "Added" : "Add"}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}