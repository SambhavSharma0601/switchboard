import { detectFromUrl } from "../../../lib/ats";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * POST /api/detect
 * body: { url: "https://amdocs.wd3.myworkdayjobs.com/en-US/Amdocs_Careers", company: "Amdocs" }
 *
 * Works out which job board a careers page runs on. Reads the URL first;
 * if that is not enough, loads the page and looks for an embedded board.
 * Every candidate is verified by actually fetching jobs before it is returned.
 */
export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch (e) {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const url = String(body.url || "").trim();
  if (!url) return Response.json({ error: "send { url }" }, { status: 400 });

  try {
    const result = await detectFromUrl(url, String(body.company || "").trim());
    return Response.json(result);
  } catch (e) {
    return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}