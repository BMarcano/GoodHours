// /api/fetch-events.js
// Live events search (server-side web search; key protected).
// Called TWICE in parallel by the client — kind: "local" | "trip" — so each
// request runs one focused search and stays well under Vercel's 60s function
// limit. Requires a logged-in user (Supabase JWT): every call is billable.
// Production v2 idea: event APIs + nightly cache per neighborhood.

async function getUserFromRequest(req) {
  const supaUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || !supaUrl || !anonKey) return null;
  const r = await fetch(`${supaUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  return await r.json();
}

// Newest search tool first; fall back fast (400) to the widely-available one.
const SEARCH_TOOL_VERSIONS = ["web_search_20260209", "web_search_20250305"];

async function runEventsSearch(prompt, toolType) {
  let messages = [{ role: "user", content: prompt }];
  let data = null;
  // a server-side tool run can pause once (stop_reason "pause_turn");
  // resend to let it finish — a single extra round keeps us inside the limit
  for (let round = 0; round < 2; round++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages,
        tools: [{ type: toolType, name: "web_search", max_uses: 2 }],
      }),
    });
    if (!r.ok) {
      return { ok: false, status: r.status, errText: await r.text() };
    }
    data = await r.json();
    if (data.stop_reason !== "pause_turn") break;
    messages = [...messages, { role: "assistant", content: data.content }];
  }
  return { ok: true, data };
}

function buildPrompt({ kind, location, dayLabel, ages }) {
  const intro = `You help caregivers find REAL kid-friendly happenings. Search the web for events happening on ${dayLabel} relevant to a caregiver in ${location} with kids aged ${ages.join(", ")}. Use at most 2 web searches, then answer.`;

  if (kind === "trip") {
    return `${intro}

Find 2-3 special events that day across the wider city/region that justify a subway or car ride — kids' shows, museum special exhibits, family sports games with cheap tickets, big seasonal events. Include ticket price if findable. Only include events you found real evidence are happening on that date — if you find fewer, return fewer; never invent an event. The "cost" field must be 1-4 words MAX ("Free", "$30", "Free w/ registration") — details belong in "whyWorth" or "transitNote", never in cost.

Respond ONLY with JSON, no markdown fences, no other text:
{ "worthTheTrip": [ { "name": "", "time": "", "venue": "", "whyWorth": "one line on why it justifies the ride", "transitNote": "e.g. ~25 min on the 2/3 from ${location}", "cost": "$30" } ] }`;
  }

  return `${intro}

Find events/happenings that day in or very near ${location} — street fairs, festivals, library specials, pop-ups, farmers markets with kid appeal. Only include events you found real evidence are happening on that date — if you find fewer, return fewer; never invent an event. For each, add ONE practical caregiver note (crowds, arrive early, stroller access, nap-timing). The "cost" field must be 1-4 words MAX ("Free", "$30", "Free w/ registration") — any registration details belong in the note, never in cost.

Respond ONLY with JSON, no markdown fences, no other text:
{ "local": [ { "name": "", "time": "2–7 PM", "venue": "", "note": "practical caveat, e.g. expect a crowd — go early", "cost": "Free" } ] }`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user?.id) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }

    const { location = "", planDate = "", ages = [], kind = "local" } = req.body || {};
    const cleanAges = ages.filter((a) => String(a || "").trim());
    if (!location.trim() || !planDate) {
      res.status(400).json({ error: "Missing inputs" });
      return;
    }

    const dateObj = new Date(planDate + "T12:00:00");
    const dayLabel = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const prompt = buildPrompt({ kind, location, dayLabel, ages: cleanAges });

    let result = await runEventsSearch(prompt, SEARCH_TOOL_VERSIONS[0]);
    if (!result.ok && result.status === 400) {
      console.error("search tool rejected, falling back:", result.errText?.slice(0, 300));
      result = await runEventsSearch(prompt, SEARCH_TOOL_VERSIONS[1]);
    }
    if (!result.ok) {
      console.error("Anthropic API error:", result.status, result.errText?.slice(0, 500));
      res.status(502).json({ error: "Events search failed" });
      return;
    }

    const data = result.data;
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text || "")
      .join("\n");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error("No events JSON. kind:", kind, "stop_reason:", data.stop_reason, "text:", text.slice(0, 300));
      res.status(502).json({ error: "Events search failed" });
      return;
    }

    let events;
    try {
      events = JSON.parse(match[0]);
    } catch (e) {
      console.error("Bad events JSON. kind:", kind, "json:", match[0].slice(0, 300));
      res.status(502).json({ error: "Events search failed" });
      return;
    }

    if (kind === "trip") {
      res.status(200).json({
        worthTheTrip: Array.isArray(events.worthTheTrip) ? events.worthTheTrip.slice(0, 3) : [],
      });
    } else {
      res.status(200).json({
        local: Array.isArray(events.local) ? events.local.slice(0, 4) : [],
      });
    }
  } catch (e) {
    console.error("fetch-events error:", e);
    res.status(500).json({ error: "Server error" });
  }
}
