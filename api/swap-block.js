// /api/swap-block.js
// "Backup swap": a stop turned out closed or packed, so the caregiver taps
// "Swap it" and gets ONE nearby replacement for that block without
// regenerating the day. Same time string, different venue, same day-of-week
// and weather rules as the plan itself.
//
// Requires a logged-in user (Supabase JWT). Not a full plan, so it does not
// go through can_generate_plan.

import { dayLabel as buildDayLabel, weekdayName, isValidPlanDate } from "./_date.js";
import { weatherPlanningInstructions } from "./_weather.js";

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

const BLOCK_SCHEMA = {
  type: "object",
  properties: {
    time: { type: "string", description: "Copy the original stop's time string exactly." },
    activity: { type: "string", description: "Short activity name." },
    venue: { type: "string", description: "A real, different venue or place near the original stop." },
    why: { type: "string", description: "One short line: why it works for these ages, plus how to get there from the original stop." },
    cost: { type: "string", description: "1-4 words: \"Free\", \"$12\", \"Free w/ library card\"." },
  },
  required: ["time", "activity", "venue", "why", "cost"],
  additionalProperties: false,
};

function str(v, limit = 300) {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
}

export function buildSwapPrompt({ plan, blockIndex, reason, dayLabel, weekday, weatherInstructions }) {
  const blocks = plan.blocks;
  const target = blocks[blockIndex];
  const listed = blocks
    .map((b, i) => `${i + 1}. ${str(b.time, 40)} — ${str(b.activity, 120)} at ${str(b.venue, 120)} (${str(b.cost, 30) || "cost n/a"})`)
    .join("\n");
  const problem = reason === "packed" ? "too packed to enjoy with kids" : "closed";
  const ages = (Array.isArray(plan.ages) ? plan.ages : []).map((a) => str(a, 30)).filter(Boolean).join(", ") || "young kids";

  return `You are the planning engine for "The Good Hours", an app that builds structured daily plans for parents and caregivers of young kids.

A caregiver with kids aged ${ages} is out in ${str(plan.location, 120)} on ${dayLabel}, following this plan:
${listed}

Stop ${blockIndex + 1} — "${str(target.activity, 120)}" at "${str(target.venue, 120)}" (${str(target.time, 40)}) — is ${problem} right now. Give ONE replacement for that stop only.

${weatherInstructions ? `${weatherInstructions}\n` : ""}
Rules:
- "time" is exactly "${str(target.time, 40)}". Do not shift the day.
- A different venue, not one already in the plan above, and realistically open on ${weekday} at that hour. Never name a different day of the week.
- Within a short walk or a ~10-minute ride of the original stop — they are already out with kids. Say how to get there in "why".
- Same spirit and cost tier as the original when possible; fits the ages.
- Suggest a REAL type of place a parent would find via a public search (a library, park, cafe with play space, museum, splash pad, open play). Do not invent a business name you are not confident exists.`;
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

    const { plan = null, blockIndex = -1, reason = "closed", weather = null } = req.body || {};
    const blocks = Array.isArray(plan?.blocks) ? plan.blocks : [];
    const idx = Number(blockIndex);
    if (!blocks.length || !Number.isInteger(idx) || idx < 0 || idx >= blocks.length || !blocks[idx] || !str(plan.location)) {
      res.status(400).json({ error: "Missing inputs" });
      return;
    }
    const planDate = isValidPlanDate(plan.planDate) ? plan.planDate : new Date().toISOString().slice(0, 10);
    const dayLabel = buildDayLabel(planDate);
    const weekday = weekdayName(planDate);
    const weatherInstructions = weather && weather.available ? weatherPlanningInstructions(weather) : "";

    const prompt = buildSwapPrompt({
      plan,
      blockIndex: idx,
      reason: reason === "packed" ? "packed" : "closed",
      dayLabel,
      weekday,
      weatherInstructions,
    });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-5",
        max_tokens: 1000,
        output_config: {
          effort: "medium",
          format: { type: "json_schema", schema: BLOCK_SCHEMA },
        },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!r.ok) {
      console.error("swap-block Anthropic error:", r.status, (await r.text()).slice(0, 500));
      res.status(502).json({ error: "Swap failed" });
      return;
    }
    const data = await r.json();
    if (data.stop_reason === "refusal") {
      res.status(422).json({ error: "Swap failed" });
      return;
    }
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text || "").join("");
    let block;
    try {
      block = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch (e) {
      console.error("swap-block bad JSON:", text.slice(0, 300));
      res.status(502).json({ error: "Swap failed" });
      return;
    }

    // The time is the one thing the model must not touch.
    res.status(200).json({
      block: {
        time: blocks[idx].time,
        activity: str(block.activity, 120),
        venue: str(block.venue, 160),
        why: str(block.why, 400),
        cost: str(block.cost, 40) || "Free",
      },
    });
  } catch (e) {
    console.error("swap-block error:", e);
    res.status(500).json({ error: "Server error" });
  }
}
