// /api/generate-plan.js
// Vercel serverless function. The Anthropic key lives in the ANTHROPIC_API_KEY
// environment variable (Vercel > Settings > Environment Variables) and never
// reaches the browser.
//
// Auth + gating (T6): the caller's Supabase JWT is verified server-side, then
// can_generate_plan() (service role RPC) allows subscribers, or atomically
// consumes the single free preview, or returns 402.

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { ages = [], slots = [], location = "", planDate = "" } = req.body || {};

    const cleanAges = ages.filter((a) => String(a || "").trim());
    const cleanSlots = slots.filter((s) => s && s.from && s.to);
    if (!cleanAges.length || !cleanSlots.length || !location.trim() || !planDate) {
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
    const dateObj = new Date(planDate + "T12:00:00");
    const dayLabel = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const prompt = `You are the planning engine for "The Good Hours", an app that builds structured daily plans for parents and caregivers of young kids.

Inputs:
- Children ages: ${cleanAges.join(", ")}
- Time slots to fill: ${cleanSlots.map((s) => `${s.from}\u2013${s.to}`).join("; ")}
- Neighborhood/location: ${location}
- This plan is for: ${dayLabel}

IMPORTANT \u2014 use the day of week: library story times and drop-in classes are typically WEEKDAY programs; many museums close Mondays; weekends mean bigger crowds (suggest arriving at open); account for holidays if the date is one. Never suggest an activity that is unlikely to run on this specific day.

Create a structured daily plan. For each time slot, give 1-2 activities. Where possible, suggest REAL types of venues/events that plausibly exist near that location (libraries, parks, story times, open plays, museums, splash pads) \u2014 the kind of thing a parent would find via a public search. Mix free and paid. Account for the ages given (nap windows for under-2s, energy burn for 3-5s). At least one block must include a small win for the grown-up too (good coffee nearby, a bench with a view, a calm moment) \u2014 mention it in the 'why'.

Respond ONLY with valid JSON, no markdown fences, in this shape:
{
  "title": "short catchy plan title",
  "summary": "one sentence on the strategy of this plan",
  "blocks": [
    { "time": "9:00\u201310:30", "activity": "name", "venue": "venue or place", "why": "one short line on why this works for these ages", "cost": "Free" }
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

    res.status(200).json(plan);
  } catch (e) {
    console.error("generate-plan error:", e);
    res.status(500).json({ error: "Server error" });
  }
}
