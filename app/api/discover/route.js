import { discover } from "../../../lib/ats";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * POST /api/discover
 * body: { companies: ["Amdocs", "Razorpay"] }
 *
 * For each company, probes every provider with likely slug variants and
 * returns the boards that actually respond with jobs. This is how the
 * source list gets built without anyone guessing tokens by hand.
 */
export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch (e) {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const companies = (Array.isArray(body.companies) ? body.companies : [])
    .map((c) => String(c || "").trim())
    .filter(Boolean)
    .slice(0, 12); // keep inside the serverless time budget

  if (!companies.length) {
    return Response.json({ error: "send { companies: [...] }, max 12 per call" }, { status: 400 });
  }

  const out = [];
  for (const company of companies) {
    try {
      const hits = await discover(company);
      out.push({
        company,
        found: hits.map((h) => ({
          provider: h.provider,
          token: h.token,
          count: h.count,
          sample: h.sample,
        })),
      });
    } catch (e) {
      out.push({ company, found: [], error: String(e.message || e) });
    }
  }

  return Response.json({ results: out });
}
