// /api/extract-spot.js
// Save Inbox, capture step. A member pastes a link or a few words, or uploads a
// screenshot (an Instagram post, a text from a friend, a flyer), and ONE Claude
// call turns it into structured fields for public.saved_spots.
//
// Screenshots are the priority path: Instagram and TikTok links hit login
// walls, so we don't fight scraping. A link gets one best-effort fetch for its
// title/description (8 s, first 200 KB); if that comes back empty the model
// still sees the URL itself, and a thin answer is saved as low-confidence so
// the parent can fix the name/address inline.
//
// Requires a logged-in user (Supabase JWT) — every call is billable. The row
// itself is written by the browser under RLS; this endpoint only extracts.

import { normalizeExtraction } from "./_spots.js";

// Vercel's request body cap is 4.5 MB. The client downscales screenshots to
// ~1400 px / JPEG before upload; this is the server-side backstop on top.
const MAX_IMAGE_BASE64 = 3 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_PAGE_BYTES = 200 * 1024;

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

// First http(s) URL in whatever they pasted, or null.
export function findUrl(text) {
  const m = String(text || "").match(/https?:\/\/[^\s<>"')\]]+/i);
  if (!m) return null;
  try {
    const u = new URL(m[0]);
    return /^https?:$/.test(u.protocol) ? u.toString() : null;
  } catch (e) {
    return null;
  }
}

function decodeEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function metaContent(html, key) {
  // <meta property="og:title" content="..."> in either attribute order
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`,
    "i"
  );
  const m = html.match(re);
  return m ? decodeEntities(m[1] || m[2] || "").trim() : "";
}

// Pull the bits of a page that describe the place: OG tags, title, and a
// slice of the visible text. Pure function so it's testable without a fetch.
export function summarizePage(html) {
  const h = String(html || "");
  const title = metaContent(h, "og:title") || decodeEntities((h.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "").trim();
  const description = metaContent(h, "og:description") || metaContent(h, "description");
  const siteName = metaContent(h, "og:site_name");
  const text = h
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);
  return { title, description, siteName, text };
}

async function fetchPageSummary(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // A plain browser UA gets the same public HTML a parent would see
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const type = r.headers.get("content-type") || "";
    if (!r.ok || !/html|xml/.test(type)) return null;
    const reader = r.body?.getReader?.();
    if (!reader) return summarizePage(await r.text());
    let received = 0;
    const chunks = [];
    while (received < MAX_PAGE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
    }
    reader.cancel().catch(() => {});
    return summarizePage(Buffer.concat(chunks).toString("utf8"));
  } catch (e) {
    return null; // login wall, timeout, bot block — the model still gets the URL
  } finally {
    clearTimeout(timer);
  }
}

// What we ask the model for. Structured outputs guarantee the shape; the
// normalizer in _spots.js still owns lengths, dates and the confidence gate.
const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    name: { type: ["string", "null"], description: "The venue, business, park or place a parent would search for. Prefer the real place over the account that posted about it." },
    description: { type: ["string", "null"], description: "One short line: what it is and why it's good for kids/families. Max ~25 words." },
    address: { type: ["string", "null"], description: "Street address, or the neighborhood + city if that's all that's shown." },
    eventName: { type: ["string", "null"], description: "Only when the save is a dated happening (a story time, a fair, a show). Null for evergreen places." },
    eventDate: { type: ["string", "null"], description: "YYYY-MM-DD if a specific date is shown. Null if none, or if it's a recurring/open-ended thing." },
    eventTime: { type: ["string", "null"], description: "Clock time as shown, e.g. \"10 AM\" or \"6–8 PM\". Null if none." },
    price: { type: ["string", "null"], description: "1-4 words as shown: \"Free\", \"$15\", \"$10/kid\". Null if not shown." },
    sourceUrl: { type: ["string", "null"], description: "The original link if one is visible or was provided. Null otherwise." },
    kidFriendly: { type: "boolean", description: "True if this plausibly suits families with young kids." },
    confidence: { type: "string", enum: ["high", "low"], description: "high only when you can clearly read a real place name AND at least a neighborhood or address. Otherwise low." },
  },
  required: ["name", "description", "address", "eventName", "eventDate", "eventTime", "price", "sourceUrl", "kidFriendly", "confidence"],
  additionalProperties: false,
};

function buildInstructions({ todayIso }) {
  return `You extract one place or event a parent wants to remember, from a screenshot, a link, or a few words. The app plans days for families with young kids.

Today's date is ${todayIso} (use it to resolve "this Saturday", "tomorrow", or a date with no year).

Rules:
- The "name" is the place a parent would put in a maps search: the venue, cafe, park, museum, class, or business. If a screenshot is an Instagram post, the poster's @handle is only the name when the account IS the venue; otherwise look for the tagged location, the caption, or the venue named in the image.
- Read everything visible: captions, overlaid text, tagged locations, addresses, dates, prices, @handles, hashtags.
- Do not invent. Anything you cannot see or infer with high confidence is null.
- "description" is one warm, useful line — what it is and why it could work for kids — not a caption copy.
- If nothing in the input looks like a place or event at all, return name null and confidence "low".`;
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

    const { text = "", image = null } = req.body || {};
    const typed = String(text || "").trim().slice(0, 2000);
    const hasImage = image && typeof image.data === "string" && image.data.length > 0;

    if (!typed && !hasImage) {
      res.status(400).json({ error: "Paste a link, type a few words, or add a screenshot" });
      return;
    }
    if (hasImage) {
      if (!IMAGE_TYPES.has(image.mediaType)) {
        res.status(400).json({ error: "Unsupported image type" });
        return;
      }
      if (image.data.length > MAX_IMAGE_BASE64) {
        res.status(413).json({ error: "Screenshot too large" });
        return;
      }
    }

    const url = findUrl(typed);
    const page = url ? await fetchPageSummary(url) : null;
    const sourceType = hasImage ? "screenshot" : url ? "link" : "text";

    // What the model sees, in order: the screenshot (if any), then the words.
    const parts = [];
    if (hasImage) {
      parts.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } });
    }
    const lines = [];
    if (typed) lines.push(`What the parent pasted or typed:\n${typed}`);
    if (url) lines.push(`Link: ${url}`);
    if (page && (page.title || page.description || page.text)) {
      lines.push(
        `What the link's page says (may be partial):\n` +
          [page.siteName && `site: ${page.siteName}`, page.title && `title: ${page.title}`, page.description && `description: ${page.description}`, page.text && `text: ${page.text}`]
            .filter(Boolean)
            .join("\n")
      );
    } else if (url) {
      lines.push("The page behind the link could not be read (login wall or blocked). Work from the link itself and the words above.");
    }
    if (hasImage) lines.push("Extract the place or event from the screenshot above" + (typed ? ", using the words as extra context." : "."));
    parts.push({ type: "text", text: lines.join("\n\n") });

    const todayIso = new Date().toISOString().slice(0, 10);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-5",
        max_tokens: 2000,
        system: buildInstructions({ todayIso }),
        output_config: {
          effort: "medium",
          format: { type: "json_schema", schema: EXTRACTION_SCHEMA },
        },
        messages: [{ role: "user", content: parts }],
      }),
    });

    if (!r.ok) {
      const errBody = await r.text();
      console.error("extract-spot Anthropic error:", r.status, errBody.slice(0, 500));
      res.status(502).json({ error: "Couldn't read that — try again" });
      return;
    }

    const data = await r.json();
    if (data.stop_reason === "refusal") {
      console.warn("extract-spot refusal:", data.stop_details?.category);
      res.status(422).json({ error: "Couldn't read that one" });
      return;
    }
    const raw = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text || "")
      .join("");

    let extracted = null;
    try {
      extracted = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch (e) {
      console.error("extract-spot bad JSON:", raw.slice(0, 300));
    }

    // Edge case by design: extraction failed or came back thin → still return
    // a row worth saving, flagged low-confidence, so the parent can fix it.
    const spot = normalizeExtraction(extracted, {
      name: page?.title || (url ? new URL(url).hostname.replace(/^www\./, "") : "") || (typed && !url ? typed.slice(0, 60) : ""),
      sourceUrl: url,
    });

    res.status(200).json({
      spot: {
        ...spot,
        source_type: sourceType,
        raw_source: typed || (hasImage ? "screenshot" : null),
        extracted: extracted ?? null,
      },
    });
  } catch (e) {
    console.error("extract-spot error:", e);
    res.status(500).json({ error: "Server error" });
  }
}
