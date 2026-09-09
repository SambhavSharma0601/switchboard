"use client";

import { useEffect, useState } from "react";
import { Bar, Note, Field, Spinner, Copy } from "../ui";
import { DEFAULT_PROFILE, KEYS, load, save, loadProfile, uid, exportAll, importAll } from "../../lib/store";

export default function Settings() {
  const [p, setP] = useState(null);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { setP(loadProfile()); }, []);
  if (!p) return <div className="page"><Spinner /></div>;

  const set = (k) => (v) => setP({ ...p, [k]: v });
  const persist = () => {
    save(KEYS.profile, p);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const setExp = (i, patch) =>
    setP({ ...p, experience: p.experience.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const setSkill = (i, patch) =>
    setP({ ...p, skillGroups: p.skillGroups.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const setEdu = (i, patch) =>
    setP({ ...p, education: p.education.map((e, j) => (j === i ? { ...e, ...patch } : e)) });

  const answers = [
    ["Full name", p.name], ["Email", p.email], ["Phone", p.phone],
    ["LinkedIn", p.linkedin], ["GitHub", p.github],
    ["Total experience", p.yoe ? p.yoe + " years" : ""],
    ["Current location", p.city], ["Notice period", p.noticePeriod],
    ["Current CTC", p.currentCtc], ["Expected CTC", p.expectedCtc],
    ["Open to relocate", p.relocate], ["Summary", p.summary],
  ].filter(([, v]) => v);

  const doExport = () => {
    const blob = new Blob([exportAll()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "switchboard-backup.json";
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 600);
  };

  const doImport = async (file) => {
    try {
      const text = await file.text();
      importAll(text);
      setP(loadProfile());
      setMsg("Restored. Reload to refresh every page.");
    } catch (e) { setMsg("Import failed: " + e.message); }
  };

  return (
    <>
      <Bar title="You" sub="Profile, screening answers, backup" />
      <div className="page">
        <Note tone="ok">
          <div>
            <b>No credentials anywhere.</b> Nothing logs into LinkedIn, Naukri or your email.
            The crawler reads public job feeds that companies publish for their own careers
            pages. Your profile and pipeline live in this browser; the API key, if you set one,
            stays server-side and never reaches the client.
          </div>
        </Note>

        <div className="mt">
          <Note tone="warn">
            <div>
              <b>No auto-submit, deliberately.</b> Bot-submitted applications violate LinkedIn&rsquo;s
              and Naukri&rsquo;s terms and are the most common cause of permanent bans. This gets you
              to a filled, tailored application in seconds; you press send.
            </div>
          </Note>
        </div>

        <div className="sect">
          <h2>Screening answers</h2>
          <div className="sub">Every portal asks the same questions. Copy them straight in.</div>
          {answers.map(([k, v]) => (
            <div key={k} className="between" style={{ padding: "7px 0", borderBottom: "1px solid var(--line-soft)" }}>
              <div className="grow">
                <div className="tiny muted">{k}</div>
                <div className="small truncate">{v}</div>
              </div>
              <Copy text={v} />
            </div>
          ))}
        </div>

        <div className="sect">
          <h2>Header</h2>
          <Field label="Name" value={p.name} onChange={set("name")} />
          <Field label="Resume title line" value={p.title} onChange={set("title")}
            hint="Lead with the domain, not 'Full-Stack Engineer'." />
          <div className="row">
            <div className="grow"><Field label="Email" value={p.email} onChange={set("email")} /></div>
            <div className="grow"><Field label="Phone" value={p.phone} onChange={set("phone")} /></div>
          </div>
          <Field label="LinkedIn" value={p.linkedin} onChange={set("linkedin")} placeholder="linkedin.com/in/..." />
          <Field label="GitHub" value={p.github} onChange={set("github")} placeholder="github.com/..." />
          <Field label="Location" value={p.city} onChange={set("city")} />
          <Field label="College" value={p.college} onChange={set("college")}
            hint="Used for the alumni referral search." />
        </div>

        <div className="sect">
          <h2>Summary</h2>
          <Field rows={4} value={p.summary} onChange={set("summary")} />
        </div>

        <div className="sect">
          <h2>Skills</h2>
          <div className="sub">Order matters — most relevant group first.</div>
          {p.skillGroups.map((s, i) => (
            <div className="row mb" key={i}>
              <input className="i" style={{ maxWidth: 130 }} placeholder="Group" value={s.k}
                onChange={(e) => setSkill(i, { k: e.target.value })} />
              <input className="i" placeholder="Comma separated" value={s.v}
                onChange={(e) => setSkill(i, { v: e.target.value })} />
              <button className="btn quiet sm"
                onClick={() => setP({ ...p, skillGroups: p.skillGroups.filter((_, j) => j !== i) })}>×</button>
            </div>
          ))}
          <button className="btn quiet sm"
            onClick={() => setP({ ...p, skillGroups: [...p.skillGroups, { k: "", v: "" }] })}>
            Add group
          </button>
        </div>

        <div className="sect">
          <h2>Experience</h2>
          <div className="sub">
            Two entries with the same employer name group under one heading — use that for
            separate client engagements.
          </div>
          {p.experience.map((e, i) => (
            <div className="panel mb" key={e.id || i}>
              <div className="between mb">
                <span className="tiny muted">Role {i + 1}</span>
                <button className="btn quiet sm"
                  onClick={() => setP({ ...p, experience: p.experience.filter((_, j) => j !== i) })}>×</button>
              </div>
              <Field label="Employer" value={e.company} onChange={(v) => setExp(i, { company: v })} />
              <Field label="Job title" value={e.role} onChange={(v) => setExp(i, { role: v })} />
              <Field label="Engagement line" value={e.context} onChange={(v) => setExp(i, { context: v })} />
              <div className="row">
                <div className="grow"><Field label="From" value={e.start} onChange={(v) => setExp(i, { start: v })} /></div>
                <div className="grow"><Field label="To" value={e.end} onChange={(v) => setExp(i, { end: v })} /></div>
              </div>
              <Field label="Location" value={e.location} onChange={(v) => setExp(i, { location: v })} />
              <Field label="Bullets — one per line" rows={6}
                value={(e.bullets || []).join("\n")}
                onChange={(v) => setExp(i, { bullets: v.split("\n").filter((x) => x.trim()) })}
                hint="Every bullet should carry a number." />
            </div>
          ))}
          <button className="btn quiet sm" onClick={() => setP({ ...p, experience: [...p.experience,
            { id: uid(), role: "", company: "", context: "", location: "", start: "", end: "", bullets: [] }] })}>
            Add role
          </button>
        </div>

        <div className="sect">
          <h2>Education & certifications</h2>
          {p.education.map((e, i) => (
            <div key={e.id || i}>
              <Field label="Degree" value={e.degree} onChange={(v) => setEdu(i, { degree: v })} />
              <div className="row">
                <div className="grow"><Field label="Institution" value={e.school} onChange={(v) => setEdu(i, { school: v })} /></div>
                <div className="grow"><Field label="Years" value={e.years} onChange={(v) => setEdu(i, { years: v })} /></div>
              </div>
              <Field label="Detail" value={e.detail} onChange={(v) => setEdu(i, { detail: v })} />
            </div>
          ))}
          <Field label="Certifications — one per line" rows={3}
            value={(p.certs || []).join("\n")}
            onChange={(v) => setP({ ...p, certs: v.split("\n").filter((x) => x.trim()) })} />
        </div>

        <div className="sect">
          <h2>Matching</h2>
          <div className="sub">These drive the score on every job in the feed.</div>
          <div className="row">
            <div className="grow"><Field label="Experience (years)" value={p.yoe} onChange={set("yoe")} /></div>
            <div className="grow"><Field label="Notice period" value={p.noticePeriod} onChange={set("noticePeriod")} /></div>
          </div>
          <div className="row">
            <div className="grow"><Field label="Current CTC" value={p.currentCtc} onChange={set("currentCtc")} /></div>
            <div className="grow"><Field label="Expected CTC" value={p.expectedCtc} onChange={set("expectedCtc")} /></div>
          </div>
          <Field label="Target locations" rows={2} value={p.locations} onChange={set("locations")}
            hint="Comma separated. Anything outside these is penalised." />
          <Field label="Core skills — heaviest weight" rows={2}
            value={(p.coreSkills || []).join(", ")}
            onChange={(v) => setP({ ...p, coreSkills: v.split(",").map((s) => s.trim()).filter(Boolean) })} />
          <Field label="Title keywords" rows={2}
            value={(p.titleKeywords || []).join(", ")}
            onChange={(v) => setP({ ...p, titleKeywords: v.split(",").map((s) => s.trim()).filter(Boolean) })} />
          <Field label="Domain keywords — your differentiator" rows={2}
            value={(p.domainKeywords || []).join(", ")}
            onChange={(v) => setP({ ...p, domainKeywords: v.split(",").map((s) => s.trim()).filter(Boolean) })} />
          <Field label="Exclude anything containing" rows={2} value={p.exclude} onChange={set("exclude")} />
        </div>

        <div className="sect">
          <h2>Backup</h2>
          <div className="sub">
            Data lives in this browser. Export before clearing site data or switching phones.
          </div>
          <div className="stack">
            <button className="btn quiet" onClick={doExport}>Export everything as JSON</button>
            <label className="btn quiet" style={{ display: "block", textAlign: "center" }}>
              Restore from backup
              <input type="file" accept="application/json" style={{ display: "none" }}
                onChange={(e) => e.target.files[0] && doImport(e.target.files[0])} />
            </label>
            <button className="btn danger" onClick={() => {
              if (!confirm("Erase profile, pipeline, contacts and sources?")) return;
              Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
              setP({ ...DEFAULT_PROFILE });
              setMsg("Cleared.");
            }}>Erase all local data</button>
          </div>
          {msg ? <div className="mt"><Note tone="ok">{msg}</Note></div> : null}
        </div>

        <div className="sect">
          <button className="btn" onClick={persist}>{saved ? "Saved" : "Save profile"}</button>
        </div>
      </div>
    </>
  );
}
