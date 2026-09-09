import {
  Document, Packer, Paragraph, TextRun, TabStopType, TabStopPosition, BorderStyle, AlignmentType,
} from "docx";
import { groupExp, contactLine, safeName } from "../../../../lib/resume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FONT = "Calibri";

function heading(text) {
  return new Paragraph({
    spacing: { before: 220, after: 70 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 2 } },
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, size: 21, font: FONT, characterSpacing: 16 }),
    ],
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 60 },
    children: [new TextRun({ text, size: 21, font: FONT, ...opts.run })],
  });
}

function twoCol(left, right, opts = {}) {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { after: opts.after ?? 30 },
    children: [
      new TextRun({ text: left, size: 21, font: FONT, bold: opts.bold, italics: opts.italics }),
      new TextRun({ text: "\t" + (right || ""), size: 19, font: FONT }),
    ],
  });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: [new TextRun({ text, size: 21, font: FONT })],
  });
}

function buildDoc(p) {
  const children = [];

  children.push(
    new Paragraph({
      spacing: { after: 20 },
      children: [new TextRun({ text: p.name || "Your Name", bold: true, size: 38, font: FONT })],
    })
  );
  if (p.title) children.push(body(p.title, { after: 20 }));
  children.push(
    new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({ text: contactLine(p), size: 18, font: FONT, color: "333333" })],
    })
  );

  if (p.summary) {
    children.push(heading("Summary"));
    children.push(body(p.summary, { after: 80 }));
  }

  const sk = (p.skillGroups || []).filter((s) => s && s.v);
  if (sk.length) {
    children.push(heading("Technical Skills"));
    sk.forEach((s) =>
      children.push(
        new Paragraph({
          spacing: { after: 30 },
          children: [
            new TextRun({ text: s.k + ": ", bold: true, size: 21, font: FONT }),
            new TextRun({ text: s.v, size: 21, font: FONT }),
          ],
        })
      )
    );
  }

  const groups = groupExp(p.experience);
  if (groups.length) {
    children.push(heading("Experience"));
    groups.forEach((g) => {
      children.push(twoCol(g.company || "Employer", g.location || "", { bold: true }));
      g.items.forEach((e) => {
        const label = [e.role, e.context].filter(Boolean).join(" — ");
        const dates = [e.start, e.end].filter(Boolean).join(" – ");
        children.push(twoCol(label, dates, { italics: true }));
        (e.bullets || []).filter(Boolean).forEach((b) => children.push(bullet(b)));
      });
    });
  }

  const pj = (p.projects || []).filter((x) => x && x.name);
  if (pj.length) {
    children.push(heading("Projects"));
    pj.forEach((x) => {
      children.push(twoCol(x.name, x.tech || "", { bold: true }));
      (x.bullets || []).filter(Boolean).forEach((b) => children.push(bullet(b)));
    });
  }

  const ed = (p.education || []).filter((e) => e && e.degree);
  if (ed.length) {
    children.push(heading("Education"));
    ed.forEach((e) => {
      children.push(twoCol(e.degree, e.years || "", { bold: true }));
      const sub = [e.school, e.detail].filter(Boolean).join(" — ");
      if (sub) children.push(body(sub, { after: 60 }));
    });
  }

  const ce = (p.certs || []).filter(Boolean);
  if (ce.length) {
    children.push(heading("Certifications"));
    ce.forEach((c) => children.push(bullet(c)));
  }

  return new Document({
    creator: p.name || "Switchboard",
    title: (p.name || "Resume") + " — Resume",
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    sections: [
      {
        properties: {
          page: { margin: { top: 794, bottom: 794, left: 794, right: 794 } }, // 14mm in twips
        },
        children,
      },
    ],
  });
}

export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch (e) {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const profile = body.profile;
  if (!profile) return Response.json({ error: "profile required" }, { status: 400 });

  const filename =
    safeName(profile.name || "Resume") +
    (body.company ? "_" + safeName(body.company) : "") +
    ".docx";

  const buffer = await Packer.toBuffer(buildDoc(profile));

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
