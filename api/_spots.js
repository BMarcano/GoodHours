// Save Inbox helpers shared by /api/extract-spot and /api/generate-plan.
// Underscore-prefixed so Vercel treats this as a shared module, not an endpoint.
//
// Two jobs live here:
//   1. normalizeExtraction(): turn whatever the model said about a screenshot or
//      link into a clean saved_spots row (never trust field shapes or lengths).
//   2. spotsForPlan() / spotsPromptSection() / attachSavedSpots(): feed a
//      family's saves into plan generation and stamp the blocks that used one,
//      so the client can badge them "⭐ Your save". The model proposes which
//      save fits a block by id; the deterministic pass here is what decides
//      whether the badge ships — an id we didn't hand the model is dropped.

import { isValidPlanDate, normalizeDate } from "./_date.js";

// Enough for a family that saves a lot without blowing up the plan prompt.
export const MAX_SPOTS_IN_PROMPT = 20;

const TEXT_LIMITS = {
  name: 120,
  description: 240,
  address: 200,
  event_name: 160,
  event_time: 60,
  price: 40,
  source_url: 2000,
};

function cleanText(value, limit) {
  if (value === null || value === undefined) return null;
  const s = String(value).replace(/\s+/g, " ").trim();
  if (!s || /^(null|none|n\/a|unknown|not found|not specified)$/i.test(s)) return null;
  return s.slice(0, limit);
}

function cleanUrl(value) {
  const s = cleanText(value, TEXT_LIMITS.source_url);
  if (!s) return null;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.toString();
  } catch (e) {
    return null;
  }
}

// Model output (any shape) → the columns of public.saved_spots.
// `fallback` carries what we knew before asking the model (the pasted URL, a
// page title) so a thin answer still yields something a parent can recognise
// and edit inline.
export function normalizeExtraction(raw, fallback = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  const name =
    cleanText(r.name ?? r.venue ?? r.venueName, TEXT_LIMITS.name) ||
    cleanText(fallback.name, TEXT_LIMITS.name) ||
    "Saved spot";
  const eventDateRaw = r.eventDate ?? r.event_date ?? r.date ?? null;
  const year = new Date().getUTCFullYear();
  const normalized = eventDateRaw ? normalizeDate(eventDateRaw, year) : null;
  const eventDate = normalized && isValidPlanDate(normalized) ? normalized : null;

  const modelConfidence = String(r.confidence || "").toLowerCase() === "high" ? "high" : "low";
  // No real name = nothing to plan around → always flag it for a quick edit.
  const confidence = name === "Saved spot" ? "low" : modelConfidence;

  return {
    name,
    description: cleanText(r.description ?? r.summary, TEXT_LIMITS.description),
    address: cleanText(r.address ?? r.location ?? r.neighborhood, TEXT_LIMITS.address),
    event_name: cleanText(r.eventName ?? r.event_name ?? r.event, TEXT_LIMITS.event_name),
    event_date: eventDate,
    event_time: cleanText(r.eventTime ?? r.event_time ?? r.time, TEXT_LIMITS.event_time),
    price: cleanText(r.price ?? r.cost, TEXT_LIMITS.price),
    source_url: cleanUrl(r.sourceUrl ?? r.source_url ?? r.url) || cleanUrl(fallback.sourceUrl),
    confidence,
  };
}

// Which saves are even candidates for a given day. Evergreen venues always
// are; a dated happening only on its own date (yesterday's pop-up is gone,
// next Saturday's fair doesn't belong on a Tuesday plan). Most recent first,
// capped so the prompt stays bounded.
export function spotsForPlan(spots, planDate) {
  const list = Array.isArray(spots) ? spots : [];
  return list
    .filter((s) => s && s.id && s.name)
    .filter((s) => !s.event_date || String(s.event_date).slice(0, 10) === planDate)
    .slice(0, MAX_SPOTS_IN_PROMPT);
}

function spotLine(s) {
  const bits = [`id: ${s.id}`, `name: ${s.name}`];
  if (s.event_name) bits.push(`event: ${s.event_name}`);
  if (s.address) bits.push(`address: ${s.address}`);
  if (s.description) bits.push(`about: ${s.description}`);
  if (s.event_date) bits.push(`on: ${String(s.event_date).slice(0, 10)}`);
  if (s.event_time) bits.push(`time: ${s.event_time}`);
  if (s.price) bits.push(`price: ${s.price}`);
  return `- ${bits.join(" | ")}`;
}

// The prompt block that tells the planning model about the family's saves.
// Empty string when there's nothing to say, so the plan prompt is unchanged
// for families who haven't saved anything.
export function spotsPromptSection(spots, { location, weekday }) {
  const list = Array.isArray(spots) ? spots : [];
  if (!list.length) return "";
  return `THIS FAMILY'S SAVED SPOTS (places they found on Instagram, in texts, etc. and asked us to remember):
${list.map(spotLine).join("\n")}

Use them like this:
- Weave a saved spot into a block ONLY when it genuinely fits ${weekday}, the requested hours, the kids' ages, and a reasonable trip from ${location}. If it's likely closed ${weekday}, too far, wrong for these ages, or you can't tell where it is, leave it out. Never force one in — a saved spot is a suggestion from the family, not an order.
- When a block IS built around a saved spot, set "savedSpotId" on that block to the spot's exact id (copy it verbatim) and use the saved name as the venue. Leave "savedSpotId" out of every other block.
- Use at most 2 saved spots in one plan. The rest of the day should still feel discovered.`;
}

// Deterministic backstop: only ids we actually handed the model earn the
// badge. Everything else about the block is left exactly as the model wrote it.
export function attachSavedSpots(plan, spots) {
  const allowed = new Map((Array.isArray(spots) ? spots : []).map((s) => [String(s.id), s]));
  const blocks = Array.isArray(plan?.blocks) ? plan.blocks : [];
  const stamped = blocks.map((b) => {
    if (!b || typeof b !== "object") return b;
    const { savedSpotId, yourSave, ...rest } = b;
    const id = savedSpotId ? String(savedSpotId) : null;
    if (id && allowed.has(id)) {
      return { ...rest, savedSpotId: id, savedSpotName: allowed.get(id).name, yourSave: true };
    }
    return rest;
  });
  return { ...plan, blocks: stamped };
}
