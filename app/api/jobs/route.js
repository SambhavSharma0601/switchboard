import { crawl } from "../../../lib/ats";
import { rank } from "../../../lib/score";
import seed from "../../../data/sources.json";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * POST /api/jobs
 * body: { sources: [{company, provider, token}], profile: {...}, min?: number, maxAgeDays?: number }
 *
 * Crawls every board server-side (no CORS ceiling, full descriptions),
 * scores locally, returns a ranked feed.
 */
export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch (e) {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const sources =
    Array.isArray(body.sources) && body.sources.length ? body.sources : seed.boards || [];

  if (!sources.length) {
    return Response.json(
      {
        jobs: [],
        errors: [],
        stats: { sources: 0, raw: 0, kept: 0 },
        hint: "No boards configured. Open Sources and run discovery first.",
      },
      { status: 200 }
    );
  }

  const profile = body.profile || {};
  const min = Number.isFinite(body.min) ? body.min : 0;
  const maxAgeDays = Number.isFinite(body.maxAgeDays) ? body.maxAgeDays : 60;

  const started = Date.now();
  const { jobs, errors } = await crawl(sources.slice(0, 120), { concurrency: 8 });

  const cutoff = Date.now() - maxAgeDays * 86400000;
  const fresh = jobs.filter((j) => !j.postedAt || new Date(j.postedAt).getTime() >= cutoff);

  const ranked = rank(fresh, profile, { min }).map((j) => ({
    ...j,
    description: undefined, // keep the payload small; scoring already used it
    snippet: (j.description || "").slice(0, 220),
  }));

  return Response.json({
    jobs: ranked.slice(0, 400),
    errors,
    stats: {
      sources: sources.length,
      raw: jobs.length,
      afterAge: fresh.length,
      kept: ranked.length,
      ms: Date.now() - started,
    },
    scannedAt: new Date().toISOString(),
  });
}

export async function GET() {
  return Response.json({
    ok: true,
    usage: "POST { sources, profile, min, maxAgeDays }",
    seedBoards: (seed.boards || []).length,
  });
}
