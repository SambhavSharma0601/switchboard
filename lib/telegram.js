export function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

function escapeHTML(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendTelegram(text) {
  if (!telegramConfigured()) return { ok: false, reason: "not configured" };
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function formatDigest(jobs, appUrl) {
  if (!jobs.length) return null;
  const lines = [`<b>${jobs.length} new match${jobs.length === 1 ? "" : "es"}</b>`, ""];
  for (const j of jobs.slice(0, 15)) {
    const flags = (j.flags || []).filter((f) => !f.startsWith("domain:"));
    lines.push(
      `<b>${j.score}</b> · ${escapeHTML(j.title)}` +
        `\n${escapeHTML(j.company)}${j.location ? " · " + escapeHTML(j.location) : ""}` +
        (flags.length ? `\n<i>${escapeHTML(flags.join(", "))}</i>` : "") +
        `\n<a href="${escapeHTML(j.url)}">Apply</a>`
    );
    lines.push("");
  }
  if (appUrl) lines.push(`<a href="${escapeHTML(appUrl)}">Open Switchboard</a>`);
  return lines.join("\n").slice(0, 4000);
}
