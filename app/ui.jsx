"use client";

import { useState } from "react";

export function Bar({ title, sub, right }) {
  return (
    <div className="topbar">
      <div className="row">
        <h1>{title}</h1>
        {right}
      </div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

export function Note({ children, tone = "info" }) {
  return <div className={"note " + (tone === "info" ? "" : tone)}>{children}</div>;
}

export function Field({ label, value, onChange, placeholder, rows, hint, type = "text" }) {
  return (
    <label className="f">
      {label ? <span className="lbl">{label}</span> : null}
      {rows ? (
        <textarea className="i" rows={rows} value={value || ""} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="i" type={type} value={value || ""} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      )}
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

export function Spinner() {
  return <span className="spin" aria-hidden="true" />;
}

export function Copy({ text, label = "Copy", block }) {
  const [done, setDone] = useState(false);
  const go = async () => {
    try {
      await navigator.clipboard.writeText(text || "");
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text || "";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (err) {}
      document.body.removeChild(ta);
    }
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };
  return (
    <button className={"btn quiet" + (block ? "" : " sm")} onClick={go}>
      {done ? "Copied" : label}
    </button>
  );
}

export function scoreColor(n) {
  if (n >= 80) return "var(--signal)";
  if (n >= 60) return "var(--warn)";
  return "var(--muted)";
}

export function ageBar(postedAt) {
  if (!postedAt) return "var(--muted)";
  const d = (Date.now() - new Date(postedAt).getTime()) / 86400000;
  if (d <= 1) return "var(--signal)";
  if (d <= 3) return "var(--warn)";
  if (d <= 10) return "var(--muted)";
  return "var(--line)";
}

export function ageLabel(postedAt) {
  if (!postedAt) return "—";
  const d = Math.floor((Date.now() - new Date(postedAt).getTime()) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "1d";
  if (d < 30) return d + "d";
  return Math.floor(d / 30) + "mo";
}
