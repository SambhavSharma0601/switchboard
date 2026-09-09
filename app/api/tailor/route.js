export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

function extractJSON(text) {
  if (!text) return null;
  const t = String(text).replace(/```json/gi, "").replace(/```/g, "").trim();
  const idxs = [t.indexOf("["), t.indexOf("{")].filter((i) => i >= 0);
  if (!idxs.length) return null;
  const start = Math.min(...idxs);
  const open = t[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(t.slice(start, i + 1)); } catch (e) { return null; }
      }
    }
  }
  return null;
}

async function claude(prompt, { system, maxTokens = 2000 } = {}) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error("Anthropic " + res.status + " " + t.slice(0, 200));
  }
  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch (e) {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { profile, jd, mode = "resume", context } = body;
  if (!profile) return Response.json({ error: "profile required" }, { status: 400 });

  try {
    if (mode === "cover") {
      const text = await claude(
        `Write a 110-word cover note for this application. Plain and specific. No flattery, ` +
          `no "I am writing to apply", no exclamation marks. Open with the single most ` +
          `relevant thing this person has built.\n\n` +
          `CANDIDATE: ${profile.yoe} years backend engineer. ${profile.summary}\n\n` +
          `JOB:\n${String(jd || "").slice(0, 3000)}\n\nOutput only the note.`,
        { maxTokens: 500 }
      );
      return Response.json({ text });
    }

    if (mode === "dm") {
      const text = await claude(
        `Write a LinkedIn referral request DM under 60 words. Plain, specific, no flattery. ` +
          `Name the role. Give the reader an easy out.\n\n` +
          `SENDER: backend engineer, ${profile.yoe} years. ${profile.summary}\n` +
          `TARGET: ${(context && context.company) || "the company"} — ${(context && context.title) || "backend role"}\n\n` +
          `Output only the message.`,
        { maxTokens: 300 }
      );
      return Response.json({ text });
    }

    if (mode === "brief") {
      const text = await claude(
        `Write a one-page interview brief for a backend engineer preparing for a screen.\n\n` +
          `COMPANY: ${(context && context.company) || ""}\nROLE: ${(context && context.title) || ""}\n` +
          `JD:\n${String(jd || "").slice(0, 3000)}\n\n` +
          `Cover: likely tech stack, three technical topics they will probe, three ` +
          `behavioural angles, and three sharp questions to ask them. Use short headed ` +
          `sections and bullets. No preamble.`,
        { maxTokens: 1400 }
      );
      return Response.json({ text });
    }

    // default: full resume tailoring
    const roles = (profile.experience || []).slice(0, 3);
    const roleBlock = roles
      .map(
        (e, i) =>
          `[${i}] ${e.role}${e.context ? " — " + e.context : ""}\n` +
          (e.bullets || []).map((b) => "  - " + b).join("\n")
      )
      .join("\n");
    const skillBlock = (profile.skillGroups || []).map((s) => s.k + ": " + s.v).join("\n");

    const raw = await claude(
      `Rewrite this candidate's resume content for the job below. Keep every claim truthful ` +
        `to the source bullets — reframe and re-emphasise, never invent employers, tools or ` +
        `achievements. Where a number would strengthen a bullet and you do not know it, write [X].\n\n` +
        `CANDIDATE\n${profile.yoe} years, based ${profile.city}\nSkills:\n${skillBlock}\n` +
        `Experience:\n${roleBlock}\n\nJOB\n${String(jd || "").slice(0, 6000)}\n\n` +
        `Return ONLY this JSON:\n` +
        `{"score":0,"verdict":"max 14 words","missing":["JD keywords absent from the resume, max 8"],` +
        `"headline":"resume title line under 80 chars","summary":"2 sentences using the job's own vocabulary",` +
        `"skills":[{"k":"group","v":"comma list, most relevant group first"}],` +
        `"exp":[{"i":0,"bullets":["rewritten bullets for role 0, strong verb first, max 28 words each"]}]}`,
      {
        system:
          "You are a senior Indian tech recruiter and resume writer. You output only valid JSON. No prose, no code fences.",
        maxTokens: 2500,
      }
    );

    const parsed = extractJSON(raw);
    if (!parsed) return Response.json({ error: "could not parse model output" }, { status: 502 });
    return Response.json(parsed);
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY), model: MODEL });
}
