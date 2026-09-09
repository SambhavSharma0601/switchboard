"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, Note, Field, Spinner, Copy, scoreColor } from "../ui";
import { loadProfile, load, save, KEYS } from "../../lib/store";
import { mergeTailored, groupExp, contactLine, resumeText, safeName } from "../../lib/resume";

export default function ResumePage() {
  const [profile, setProfile] = useState(null);
  const [jd, setJd] = useState("");
  const [ctx, setCtx] = useState(null);
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [cover, setCover] = useState("");
  const [dm, setDm] = useState("");
  const [brief, setBrief] = useState("");
  const [aiReady, setAiReady] = useState(true);

  useEffect(() => {
    setProfile(loadProfile());
    const seedJob = load("sb.tailorSeed", null);
    if (seedJob) {
      setCtx(seedJob);
      save("sb.tailorSeed", null);
    }
    fetch("/api/tailor").then((r) => r.json()).then((d) => setAiReady(!!d.configured)).catch(() => {});
  }, []);

  const merged = useMemo(() => (profile ? mergeTailored(profile, out) : null), [profile, out]);

  const call = async (mode, setter) => {
    setBusy(mode); setErr("");
    try {
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, jd, mode, context: ctx }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setter(mode === "resume" ? data : data.text);
    } catch (e) {
      setErr(String(e.message || e));
    }
    setBusy("");
  };

  const downloadDocx = async () => {
    setBusy("docx");
    try {
      const res = await fetch("/api/resume/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: merged, company: ctx && ctx.company }),
      });
      if (!res.ok) throw new Error("docx failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        safeName(merged.name || "Resume") +
        (ctx && ctx.company ? "_" + safeName(ctx.company) : "") + ".docx";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 800);
    } catch (e) { setErr(String(e.message || e)); }
    setBusy("");
  };

  const openPrint = () => {
    save("sb.printProfile", merged);
    window.open("/print", "_blank");
  };

  if (!profile) return <div className="page"><Spinner /></div>;

  return (
    <>
      <Bar title="Resume" sub={ctx ? `Tailoring for ${ctx.title} · ${ctx.company}` : "Master version"} />
      <div className="page">
        {!aiReady ? (
          <div className="mb">
            <Note tone="warn">
              Tailoring needs <code>ANTHROPIC_API_KEY</code> in your environment variables.
              Everything else — crawling, scoring, exports — works without it.
            </Note>
          </div>
        ) : null}

        <Field label="Job description" rows={7} value={jd} onChange={setJd}
          placeholder="Paste the full JD. Requirements and responsibilities matter most." />

        <button className="btn" disabled={!!busy || !jd.trim() || !aiReady}
          onClick={() => call("resume", setOut)}>
          {busy === "resume" ? <Spinner /> : null}
          {busy === "resume" ? "Rewriting" : "Tailor my resume"}
        </button>

        {err ? <div className="mt"><Note tone="warn">{err}</Note></div> : null}

        {out ? (
          <div className="mt between" style={{ alignItems: "flex-end", paddingBottom: 14, borderBottom: "1px solid var(--line)" }}>
            <div style={{ fontSize: 44, fontWeight: 500, lineHeight: 1, letterSpacing: "-.03em",
              fontVariantNumeric: "tabular-nums", color: scoreColor(out.score) }}>
              {out.score}
            </div>
            <div className="small grow" style={{ color: "var(--ink2)" }}>{out.verdict}</div>
          </div>
        ) : null}

        <div className="sect">
          <h2>{out ? "Tailored resume" : "Your resume"}</h2>
          <div className="sub">Single column, no tables, no graphics — parses cleanly in every ATS.</div>

          <div className="stack">
            <button className="btn" onClick={openPrint}>Open print view → Save as PDF</button>
            <div className="row">
              <button className="btn quiet" onClick={downloadDocx} disabled={busy === "docx"}>
                {busy === "docx" ? <Spinner /> : null} Download .docx
              </button>
              <Copy text={resumeText(merged)} label="Copy as text" block />
            </div>
          </div>

          <div className="mt">
            <Note>
              The print view is a real A4 page. On a phone: tap it, then use your browser&rsquo;s
              share or menu button and choose Print → Save as PDF.
            </Note>
          </div>

          <div className="mt paper">
            <Preview p={merged} />
          </div>
        </div>

        {out && out.missing && out.missing.length ? (
          <div className="sect">
            <h2>In the JD, absent from your resume</h2>
            <div className="sub">Add only what is true. This list is a prompt, not a script.</div>
            <div className="row wrap">
              {out.missing.map((m) => <span key={m} className="chip warn">{m}</span>)}
            </div>
          </div>
        ) : null}

        {out ? (
          <div className="sect">
            <h2>Everything else for this application</h2>
            <div className="stack">
              <button className="btn quiet" disabled={!!busy} onClick={() => call("cover", setCover)}>
                {busy === "cover" ? <Spinner /> : null} Write cover note
              </button>
              <button className="btn quiet" disabled={!!busy} onClick={() => call("dm", setDm)}>
                {busy === "dm" ? <Spinner /> : null} Write referral DM
              </button>
              <button className="btn quiet" disabled={!!busy} onClick={() => call("brief", setBrief)}>
                {busy === "brief" ? <Spinner /> : null} Interview brief
              </button>
            </div>

            {[["Cover note", cover], ["Referral DM", dm], ["Interview brief", brief]].map(
              ([label, text]) => text ? (
                <div key={label} style={{ paddingTop: 14 }}>
                  <div className="between mb">
                    <span className="small muted">{label}</span>
                    <Copy text={text} />
                  </div>
                  <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.55 }}>{text}</div>
                </div>
              ) : null
            )}
          </div>
        ) : null}

        <div className="sect">
          <Note tone="warn">
            Any <code>[X]</code> in a tailored bullet needs a real number before you send it.
            Estimates you can defend in an interview are fine; invented ones get caught.
          </Note>
        </div>
      </div>
    </>
  );
}

function Preview({ p }) {
  if (!p) return null;
  const groups = groupExp(p.experience);
  return (
    <div>
      <h1>{p.name || "Your Name"}</h1>
      {p.title ? <div>{p.title}</div> : null}
      <div style={{ fontSize: 9.5, color: "#444", marginBottom: 10 }}>{contactLine(p)}</div>

      {p.summary ? (<><h2>Summary</h2><div>{p.summary}</div></>) : null}

      {(p.skillGroups || []).filter((s) => s && s.v).length ? (
        <>
          <h2>Technical Skills</h2>
          {(p.skillGroups || []).filter((s) => s && s.v).map((s) => (
            <div key={s.k}><b>{s.k}:</b> {s.v}</div>
          ))}
        </>
      ) : null}

      {groups.length ? (
        <>
          <h2>Experience</h2>
          {groups.map((g, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div className="row"><b>{g.company || "Employer"}</b><span>{g.location}</span></div>
              {g.items.map((e) => (
                <div key={e.id} style={{ marginTop: 3 }}>
                  <div className="row">
                    <i>{[e.role, e.context].filter(Boolean).join(" — ")}</i>
                    <span className="nowrap">{[e.start, e.end].filter(Boolean).join(" – ")}</span>
                  </div>
                  <ul>{(e.bullets || []).filter(Boolean).map((b, k) => <li key={k}>{b}</li>)}</ul>
                </div>
              ))}
            </div>
          ))}
        </>
      ) : null}

      {(p.education || []).filter((e) => e && e.degree).length ? (
        <>
          <h2>Education</h2>
          {(p.education || []).filter((e) => e && e.degree).map((e) => (
            <div key={e.id} style={{ marginBottom: 4 }}>
              <div className="row"><b>{e.degree}</b><span>{e.years}</span></div>
              <div>{[e.school, e.detail].filter(Boolean).join(" — ")}</div>
            </div>
          ))}
        </>
      ) : null}

      {(p.certs || []).filter(Boolean).length ? (
        <>
          <h2>Certifications</h2>
          <ul>{(p.certs || []).filter(Boolean).map((c, i) => <li key={i}>{c}</li>)}</ul>
        </>
      ) : null}
    </div>
  );
}
