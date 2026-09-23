// /api/generate-plan.js
// Vercel serverless function. The Anthropic key lives in the ANTHROPIC_API_KEY
// environment variable (Vercel > Settings > Environment Variables) and never
// reaches the browser.
//
// Auth + gating (T6): the caller's Supabase JWT is verified server-side, then
// can_generate_plan() (service role RPC) allows subscribers, or atomically
// consumes the single free preview, or returns 402.

import { dayLabel as buildDayLabel, weekdayName, isValidPlanDate } from "./_date.js";
import { getWeatherForPlan, weatherPlanningInstructions } from "./_weather.js";
import { spotsForPlan, spotsPromptSection, attachSavedSpots } from "./_spots.js";

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

// The family's Save Inbox (migration 11). Service role when we have it, else
// the caller's own JWT under RLS. A missing table or any error just means "no
// saves" — the plan must never fail because of this.
async function loadSavedSpots(req, userId) {
  const supaUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const auth = req.headers.authorization || "";
  const userToken = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!supaUrl || !(serviceKey || (anonKey && userToken))) return [];
  const apikey = serviceKey || anonKey;
  const bearer = serviceKey || userToken;
  try {
    const q = new URLSearchParams({
      select: "id,name,description,address,event_name,event_date,event_time,price",
      profile_id: `eq.${userId}`,
      order: "created_at.desc",
      limit: "60",
    });
    const r = await fetch(`${supaUrl}/rest/v1/saved_spots?${q}`, {
      headers: { apikey, Authorization: `Bearer ${bearer}` },
    });
    if (!r.ok) {
      console.warn("saved_spots load skipped:", r.status);
      return [];
    }
    const rows = await r.json();
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    console.warn("saved_spots load failed:", e?.message || e);
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { ages = [], slots = [], location = "", planDate = "" } = req.body || {};

    const cleanAges = ages.filter((a) => String(a || "").trim());
    const cleanSlots = slots.filter((s) => s && s.from && s.to);
    if (!cleanAges.length || !cleanSlots.length || !location.trim() || !isValidPlanDate(planDate)) {
      res.status(400).json({ error: "Missing inputs" });
      return;
    }

    // --- Membership / free-preview gate (server-side source of truth) ---
    const user = await getUserFromRequest(req);
    if (!user?.id) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    const supaUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supaUrl && serviceKey) {
      const gate = await fetch(`${supaUrl}/rest/v1/rpc/can_generate_plan`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_profile: user.id }),
      });
      if (gate.ok) {
        const allowed = await gate.json();
        if (allowed === false) {
          res.status(402).json({ error: "Membership required" });
          return;
        }
      } else {
        // fail-open on infra errors so a Supabase hiccup never blocks members
        console.error("can_generate_plan RPC failed:", gate.status, await gate.text());
      }
    } else {
      console.warn("SUPABASE_SERVICE_ROLE_KEY not set — skipping server-side plan gating");
    }

    // Day-of-week context: the model has no clock, we must tell it the date
    const dayLabel = buildDayLabel(planDate);
    const weekday = weekdayName(planDate);
    // Weather is a bonus, never a blocker: the helper returns a structured
    // unavailable state on geocoding, horizon, timeout, or provider errors.
    // Saved spots ride along with the forecast — both are context, neither blocks.
    const [weather, allSpots] = await Promise.all([
      getWeatherForPlan({ location, planDate }),
      loadSavedSpots(req, user.id),
    ]);
    const weatherInstructions = weatherPlanningInstructions(weather);
    const spots = spotsForPlan(allSpots, planDate);
    const spotsInstructions = spotsPromptSection(spots, { location, weekday });

    const prompt = `You are the planning engine for "The Good Hours", an app that builds structured daily plans for parents and caregivers of young kids.

Inputs:
- Children ages: ${cleanAges.join(", ")}
- Time slots to fill: ${cleanSlots.map((s) => `${s.from}\u2013${s.to}`).join("; ")}
- Neighborhood/location: ${location}
- This plan is for: ${dayLabel}

${weatherInstructions}
${spotsInstructions ? `\n${spotsInstructions}\n` : ""}
IMPORTANT \u2014 this plan is for ${weekday} and ONLY ${weekday}:
- Library story times and drop-in classes are typically WEEKDAY programs; many museums close Mondays; weekends mean bigger crowds (suggest arriving at open); account for holidays if the date is one. Never suggest an activity that is unlikely to run on ${weekday}.
- Never name a different day of the week anywhere in your output. No "Sunday market", no "great on Fridays", no "come back Saturday". If something only runs on another day, it does not belong in this plan.
- Wherever the day matters to the suggestion, say "${weekday}" explicitly so the caregiver can tell you accounted for it.

Create a structured daily plan. For each time slot, give 1-2 activities. Where possible, suggest REAL types of venues/events that plausibly exist near that location (libraries, parks, story times, open plays, museums, splash pads) \u2014 the kind of thing a parent would find via a public search. Mix free and paid. Account for the ages given (nap windows for under-2s, energy burn for 3-5s). At least one block must include a small win for the grown-up too (good coffee nearby, a bench with a view, a calm moment) \u2014 mention it in the 'why'.

Respond ONLY with valid JSON, no markdown fences, in this shape:
{
  "title": "short catchy plan title",
  "summary": "one sentence on the strategy of this plan",
  "blocks": [
    { "time": "9:00\u201310:30", "activity": "name", "venue": "venue or place", "why": "one short line on why this works for these ages", "cost": "Free"${spots.length ? ', "savedSpotId": "ONLY when this block is built around one of the saved spots listed above: its exact id. Omit the key otherwise."' : ""} }
  ],
  "proTip": "one insider-style tip"
}`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!r.ok) {
      const errBody = await r.text();
      console.error("Anthropic API error:", r.status, errBody);
      res.status(502).json({ error: "Plan generation failed" });
      return;
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text || "")
      .join("");
    const clean = text.replace(/```json|```/g, "").trim();

    let plan;
    try {
      plan = JSON.parse(clean);
    } catch (e) {
      console.error("Bad AI response, could not parse JSON:", clean.slice(0, 300));
      res.status(502).json({ error: "Plan generation failed" });
      return;
    }

    // The forecast snapshot is deterministic server data. Override anything
    // the model may have tried to add under the same property.
    // Only ids we handed the model earn the "Your save" badge.
    res.status(200).json({ ...attachSavedSpots(plan, spots), weather });
  } catch (e) {
    console.error("generate-plan error:", e);
    res.status(500).json({ error: "Server error" });
  }
}
