export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function contactLine(p) {
  return [p.city, p.phone, p.email, p.linkedin, p.github].filter(Boolean).join("  •  ");
}

/** Merge a tailored payload from the API back onto the base profile. */
export function mergeTailored(profile, t) {
  if (!t) return profile;
  const experience = (profile.experience || []).map((e, i) => {
    const hit = (t.exp || []).find((x) => Number(x.i) === i);
    return hit && Array.isArray(hit.bullets) && hit.bullets.length
      ? { ...e, bullets: hit.bullets }
      : e;
  });
  return {
    ...profile,
    title: t.headline || profile.title,
    summary: t.summary || profile.summary,
    skillGroups:
      Array.isArray(t.skills) && t.skills.length
        ? t.skills.filter((s) => s && s.k && s.v)
        : profile.skillGroups,
    experience,
  };
}

/** Group consecutive experience entries sharing an employer. */
export function groupExp(exp) {
  const out = [];
  for (const e of exp || []) {
    const last = out[out.length - 1];
    if (last && e.company && last.company === e.company) last.items.push(e);
    else out.push({ company: e.company, location: e.location, items: [e] });
  }
  return out;
}

export const PRINT_CSS = `
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { font-family: Calibri, Carlito, "Segoe UI", Arial, sans-serif; font-size: 10.5pt;
       line-height: 1.35; color: #000; background: #fff; margin: 0; }
.sheet { max-width: 190mm; margin: 0 auto; padding: 10mm 8mm; }
h1 { font-size: 19pt; margin: 0 0 2pt; font-weight: 700; letter-spacing: .2pt; }
.roleline { font-size: 10.5pt; margin: 0 0 3pt; }
.contact { font-size: 9pt; color: #333; margin: 0 0 10pt; }
h2 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: .8pt; font-weight: 700;
     margin: 12pt 0 4pt; padding-bottom: 2pt; border-bottom: .8pt solid #000; }
p { margin: 0 0 4pt; }
.row { display: flex; justify-content: space-between; gap: 10pt; }
.row .meta { font-size: 9.5pt; white-space: nowrap; }
.co { font-weight: 700; }
.eng { font-style: italic; }
ul { margin: 2pt 0 6pt; padding-left: 15pt; }
li { margin: 0 0 2.5pt; }
.skill { margin: 0 0 2pt; }
@media print { .sheet { padding: 0; } .noprint { display: none !important; } }
`;

export function resumeBodyHTML(p) {
  const groups = groupExp(p.experience);
  const parts = [];

  parts.push(`<h1>${esc(p.name || "Your Name")}</h1>`);
  if (p.title) parts.push(`<div class="roleline">${esc(p.title)}</div>`);
  parts.push(`<div class="contact">${esc(contactLine(p))}</div>`);

  if (p.summary) parts.push(`<h2>Summary</h2><p>${esc(p.summary)}</p>`);

  const sk = (p.skillGroups || []).filter((s) => s && s.v);
  if (sk.length) {
    parts.push("<h2>Technical Skills</h2>");
    sk.forEach((s) => parts.push(`<div class="skill"><b>${esc(s.k)}:</b> ${esc(s.v)}</div>`));
  }

  if (groups.length) {
    parts.push("<h2>Experience</h2>");
    groups.forEach((g) => {
      parts.push(
        `<div class="row"><span class="co">${esc(g.company || "Employer")}</span>` +
          `<span class="meta">${esc(g.location || "")}</span></div>`
      );
      g.items.forEach((e) => {
        const dates = [e.start, e.end].filter(Boolean).join(" – ");
        const label = [e.role, e.context].filter(Boolean).join(" — ");
        parts.push(
          `<div class="row"><span class="eng">${esc(label)}</span>` +
            `<span class="meta">${esc(dates)}</span></div>`
        );
        parts.push(
          "<ul>" +
            (e.bullets || []).filter(Boolean).map((b) => `<li>${esc(b)}</li>`).join("") +
            "</ul>"
        );
      });
    });
  }

  const pj = (p.projects || []).filter((x) => x && x.name);
  if (pj.length) {
    parts.push("<h2>Projects</h2>");
    pj.forEach((x) => {
      parts.push(
        `<div class="row"><span class="co">${esc(x.name)}</span>` +
          `<span class="meta">${esc(x.tech || "")}</span></div>`
      );
      parts.push(
        "<ul>" + (x.bullets || []).filter(Boolean).map((b) => `<li>${esc(b)}</li>`).join("") + "</ul>"
      );
    });
  }

  const ed = (p.education || []).filter((e) => e && e.degree);
  if (ed.length) {
    parts.push("<h2>Education</h2>");
    ed.forEach((e) => {
      parts.push(
        `<div class="row"><span class="co">${esc(e.degree)}</span>` +
          `<span class="meta">${esc(e.years || "")}</span></div>`
      );
      const sub = [e.school, e.detail].filter(Boolean).join(" — ");
      if (sub) parts.push(`<div>${esc(sub)}</div>`);
    });
  }

  const ce = (p.certs || []).filter(Boolean);
  if (ce.length) {
    parts.push("<h2>Certifications</h2><ul>");
    ce.forEach((c) => parts.push(`<li>${esc(c)}</li>`));
    parts.push("</ul>");
  }

  return parts.join("");
}

export function resumeText(p) {
  const L = [];
  L.push((p.name || "Your Name").toUpperCase());
  if (p.title) L.push(p.title);
  L.push(contactLine(p));
  L.push("");
  if (p.summary) { L.push("SUMMARY"); L.push(p.summary); L.push(""); }

  const sk = (p.skillGroups || []).filter((s) => s && s.v);
  if (sk.length) {
    L.push("TECHNICAL SKILLS");
    sk.forEach((s) => L.push(s.k + ": " + s.v));
    L.push("");
  }

  const groups = groupExp(p.experience);
  if (groups.length) {
    L.push("EXPERIENCE");
    groups.forEach((g) => {
      L.push((g.company || "Employer") + (g.location ? " | " + g.location : ""));
      g.items.forEach((e) => {
        const dates = [e.start, e.end].filter(Boolean).join(" - ");
        L.push("  " + [e.role, e.context].filter(Boolean).join(" - ") + (dates ? " | " + dates : ""));
        (e.bullets || []).filter(Boolean).forEach((b) => L.push("  - " + b));
      });
      L.push("");
    });
  }

  const ed = (p.education || []).filter((e) => e && e.degree);
  if (ed.length) {
    L.push("EDUCATION");
    ed.forEach((e) => L.push([e.degree, e.school, e.detail, e.years].filter(Boolean).join(" | ")));
    L.push("");
  }

  const ce = (p.certs || []).filter(Boolean);
  if (ce.length) { L.push("CERTIFICATIONS"); ce.forEach((c) => L.push("- " + c)); }

  return L.join("\n");
}

export function safeName(s) {
  return String(s || "Resume").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 60);
}
