"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, Note, Field, Spinner, Copy } from "../ui";
import { KEYS, load, save, loadProfile, uid, daysSince } from "../../lib/store";

function liPeople(q) {
  return "https://www.linkedin.com/search/results/people/?keywords=" + encodeURIComponent(q);
}

function patterns(first, last, domain) {
  const f = (first || "").toLowerCase().trim();
  const l = (last || "").toLowerCase().trim();
  const d = (domain || "").toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!f || !d) return [];
  return [
    `${f}.${l}@${d}`, `${f}${l}@${d}`, `${f[0]}${l}@${d}`,
    `${f}@${d}`, `${f}_${l}@${d}`, `${l}.${f}@${d}`,
  ].filter((e) => !e.includes("undefined") && !e.startsWith("."));
}

export default function Referrals() {
  const [profile, setProfile] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [domain, setDomain] = useState("");
  const [dm, setDm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
    setContacts(load(KEYS.contacts, []));
  }, []);

  const persist = (next) => { setContacts(next); save(KEYS.contacts, next); };
  const emails = patterns(first, last, domain);
  const due = useMemo(
    () => contacts.filter((c) => c.status === "sent" && daysSince(c.at) >= 4).length, [contacts]);

  const writeDm = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, mode: "dm", context: { company, title: role } }),
      });
      const d = await res.json();
      setDm(d.text || d.error || "Failed");
    } catch (e) { setDm(String(e.message || e)); }
    setBusy(false);
  };

  if (!profile) return <div className="page"><Spinner /></div>;

  return (
    <>
      <Bar title="Referrals" sub={due ? `${due} follow-up${due === 1 ? "" : "s"} due` : `${contacts.length} logged`} />
      <div className="page">
        <Note>
          Ask engineers who joined in the last six months, not HR. Their referral bonus is live,
          they remember the process, and there is no political cost to them.
        </Note>

        <div className="mt">
          <Field label="Company" value={company} onChange={setCompany} placeholder="Amdocs" />
          <Field label="Role" value={role} onChange={setRole} placeholder="Backend Engineer, Java" />
        </div>

        {company ? (
          <div className="sect">
            <h2>Find people to ask</h2>
            <div className="stack">
              {[
                ["Engineers at the company", liPeople(company + " software engineer")],
                ["Engineering managers", liPeople(company + " engineering manager")],
                ["Technical recruiters", liPeople(company + " technical recruiter India")],
                ["Your college alumni there",
                  liPeople(company + " " + (profile.college || "alumni"))],
              ].map(([label, url]) => (
                <a key={label} className="btn quiet" href={url} target="_blank" rel="noreferrer">
                  {label}
                </a>
              ))}
            </div>
          </div>
        ) : null}

        <div className="sect">
          <h2>Referral message</h2>
          <button className="btn" disabled={busy || !company} onClick={writeDm}>
            {busy ? <Spinner /> : null} Write it
          </button>
          {dm ? (
            <div className="panel mt">
              <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.55, marginBottom: 10 }}>
                {dm}
              </div>
              <div className="row">
                <Copy text={dm} />
                <button className="btn quiet sm" onClick={() => {
                  persist([{ id: uid(), company, role,
                    person: [first, last].filter(Boolean).join(" ") || "—",
                    status: "sent", at: new Date().toISOString() }, ...contacts]);
                }}>Log as sent</button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="sect">
          <h2>Work out their email</h2>
          <div className="sub">Most Indian GCCs use first.last. A bounce costs nothing.</div>
          <div className="row mb">
            <input className="i" placeholder="First" value={first} onChange={(e) => setFirst(e.target.value)} />
            <input className="i" placeholder="Last" value={last} onChange={(e) => setLast(e.target.value)} />
          </div>
          <input className="i" placeholder="company.com" value={domain}
            onChange={(e) => setDomain(e.target.value)} />
          {emails.length ? (
            <div className="mt">
              {emails.map((e, i) => (
                <div key={e} className="between" style={{ padding: "7px 0", borderBottom: "1px solid var(--line-soft)" }}>
                  <a className="small" href={"mailto:" + e}>{e}{i === 0 ? "  · most likely" : ""}</a>
                  <Copy text={e} />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="sect">
          <h2>Outreach log</h2>
          {contacts.length ? contacts.map((c) => {
            const d = daysSince(c.at);
            const stale = c.status === "sent" && d >= 4;
            return (
              <div key={c.id} style={{ padding: "11px 0", borderBottom: "1px solid var(--line-soft)" }}>
                <div className="between">
                  <div className="grow">
                    <div className="small b">{c.person}</div>
                    <div className="tiny muted">
                      {c.company}{c.role ? " · " + c.role : ""} · {d}d ago
                    </div>
                  </div>
                  <button className="btn quiet sm"
                    onClick={() => persist(contacts.filter((x) => x.id !== c.id))}>×</button>
                </div>
                {stale ? (
                  <div className="tiny" style={{ color: "var(--hot)", marginTop: 4 }}>
                    Follow up — {d} days silent
                  </div>
                ) : null}
                <div className="row wrap" style={{ marginTop: 7 }}>
                  {["sent", "replied", "referred", "closed"].map((s) => (
                    <button key={s} className={"chip" + (c.status === s ? " on" : "")}
                      onClick={() => persist(contacts.map((x) =>
                        x.id === c.id ? { ...x, status: s, at: new Date().toISOString() } : x))}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            );
          }) : <div className="small muted">Nothing logged. Aim for two referral asks per application.</div>}
        </div>
      </div>
    </>
  );
}
