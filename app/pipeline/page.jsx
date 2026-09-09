"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, Note, Spinner } from "../ui";
import { KEYS, load, save, daysSince } from "../../lib/store";

const STAGES = ["saved", "applied", "screen", "onsite", "offer", "closed"];

export default function Pipeline() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => { setItems(load(KEYS.pipeline, [])); }, []);

  const persist = (next) => { setItems(next); save(KEYS.pipeline, next); };
  const update = (id, patch) =>
    persist(items.map((p) => (p.id === id ? { ...p, ...patch, at: new Date().toISOString() } : p)));
  const drop = (id) => persist(items.filter((p) => p.id !== id));

  const stats = useMemo(() => {
    if (!items) return null;
    const applied = items.filter((p) => p.stage !== "saved" && p.stage !== "closed").length +
      items.filter((p) => p.stage === "closed" && p.everApplied).length;
    const active = items.filter((p) => p.stage !== "saved" && p.stage !== "closed").length;
    const responded = items.filter((p) => ["screen", "onsite", "offer"].includes(p.stage)).length;
    const sent = items.filter((p) => p.stage !== "saved").length;
    return { total: items.length, sent, responded, active,
      rate: sent ? Math.round((responded / sent) * 100) : 0 };
  }, [items]);

  const shown = useMemo(() => {
    if (!items) return [];
    if (filter === "all") return items;
    if (filter === "stale") {
      return items.filter((p) => p.stage === "applied" && daysSince(p.at) >= 14);
    }
    return items.filter((p) => p.stage === filter);
  }, [items, filter]);

  if (!items) return <div className="page"><Spinner /></div>;

  return (
    <>
      <Bar title="Pipeline" sub={`${stats.total} tracked · ${stats.rate}% response`} />
      <div className="page">
        <div className="stats mb">
          {[["Tracked", stats.total], ["Applied", stats.sent],
            ["Responses", stats.responded], ["Rate", stats.rate + "%"]].map(([k, v]) => (
            <div key={k}>
              <div className="v">{v}</div>
              <div className="k">{k}</div>
            </div>
          ))}
        </div>

        {stats.sent >= 12 && stats.rate < 8 ? (
          <div className="mb">
            <Note tone="warn">
              {stats.rate}% response across {stats.sent} applications. Below 8% the bottleneck
              is almost always the resume, not the volume. Fix the metrics and the domain
              framing before sending more.
            </Note>
          </div>
        ) : null}

        <div className="row wrap mb">
          {["all", "saved", "applied", "screen", "onsite", "offer", "stale"].map((f) => (
            <button key={f} className={"chip" + (filter === f ? " on" : "")}
              onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>

        {shown.length ? shown.map((p) => {
          const d = daysSince(p.at);
          const ghosted = p.stage === "applied" && d >= 14;
          return (
            <div key={p.id} style={{ padding: "13px 0", borderBottom: "1px solid var(--line-soft)" }}>
              <div className="between">
                <div className="grow">
                  <div className="small b">{p.title}</div>
                  <div className="tiny muted">
                    {p.company}{p.location ? " · " + p.location : ""} · {d}d
                    {typeof p.score === "number" ? " · score " + p.score : ""}
                  </div>
                </div>
                <div className="row" style={{ alignItems: "center" }}>
                  {p.url ? <a className="btn quiet sm" href={p.url} target="_blank" rel="noreferrer">Open</a> : null}
                  <button className="btn quiet sm" onClick={() => drop(p.id)}>×</button>
                </div>
              </div>
              {ghosted ? (
                <div className="tiny" style={{ color: "var(--hot)", marginTop: 4 }}>
                  14+ days silent. Nudge the referrer or close it.
                </div>
              ) : null}
              <div className="row wrap" style={{ marginTop: 8 }}>
                {STAGES.map((s) => (
                  <button key={s} className={"chip" + (p.stage === s ? " on" : "")}
                    onClick={() => update(p.id, { stage: s, everApplied: p.everApplied || s !== "saved" })}>
                    {s}
                  </button>
                ))}
              </div>
              <textarea className="i" rows={2} style={{ marginTop: 8, fontSize: 13 }}
                placeholder="Notes — recruiter name, salary discussed, next step"
                value={p.notes || ""} onChange={(e) => update(p.id, { notes: e.target.value })} />
            </div>
          );
        }) : (
          <div className="mt muted small">
            Nothing here. Track jobs from the feed and they show up with follow-up nudges.
          </div>
        )}
      </div>
    </>
  );
}
