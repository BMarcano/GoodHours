// /api/stripe-webhook.js
// Stripe → Supabase subscription sync. Verifies the Stripe signature against
// the RAW request body, then upserts public.subscriptions using the SERVICE
// ROLE key (bypasses RLS — this endpoint is the table's only writer by design).
import Stripe from "stripe";
import crypto from "crypto";

export const config = { api: { bodyParser: false } };

// --- Meta Purchase event (Conversions API, server-side) ---
// Fired from here rather than the browser so a payment is never missed when
// someone closes the tab after checkout. Purchases only ever happen on the web,
// so this doesn't make the mobile apps trackers.
// Quietly does nothing until META_CAPI_TOKEN is set in the environment.
const META_PIXEL_ID = "1057464993904809";

function sha256(value) {
  return crypto.createHash("sha256").update(String(value).trim().toLowerCase()).digest("hex");
}

async function trackMetaPurchase({ email, value, currency, eventId }) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return;
  try {
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [
            {
              event_name: "Purchase",
              event_time: Math.floor(Date.now() / 1000),
              event_id: eventId, // lets Meta dedupe if a browser event ever fires too
              action_source: "website",
              event_source_url: "https://www.thegoodhours.co/",
              user_data: email ? { em: [sha256(email)] } : {}, // hashed, never raw
              custom_data: { value, currency },
            },
          ],
        }),
      }
    );
    if (!r.ok) console.error("Meta CAPI error:", r.status, await r.text());
  } catch (e) {
    console.error("Meta CAPI error:", e);
  }
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function mapSubscription(sub) {
  const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
  return {
    profile_id: sub.metadata?.profile_id || null,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id || null,
    stripe_subscription_id: sub.id,
    plan: interval === "year" ? "year" : "month",
    status: sub.status,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  };
}

async function upsertSubscription(row) {
  const supaUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey || !row.profile_id) {
    console.error("subscriptions upsert skipped:", {
      hasUrl: !!supaUrl,
      hasServiceKey: !!serviceKey,
      hasProfileId: !!row.profile_id,
    });
    return false;
  }
  const r = await fetch(`${supaUrl}/rest/v1/subscriptions`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(row),
  });
  if (!r.ok) console.error("subscriptions upsert failed:", r.status, await r.text());
  return r.ok;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const raw = await readRawBody(req);
    event = stripe.webhooks.constructEvent(
      raw,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (e) {
    console.error("Webhook signature verification failed:", e.message);
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        if (s.mode === "subscription" && s.subscription) {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
          const subId = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          const row = mapSubscription(sub);
          if (!row.profile_id) row.profile_id = s.metadata?.profile_id || null;
          await upsertSubscription(row);
          await trackMetaPurchase({
            email: s.customer_details?.email || s.customer_email,
            value: (s.amount_total ?? 0) / 100,
            currency: (s.currency || "usd").toUpperCase(),
            eventId: s.id,
          });
        }
        break;
      }
      case "customer.subscription.updated": {
        await upsertSubscription(mapSubscription(event.data.object));
        break;
      }
      case "customer.subscription.deleted": {
        await upsertSubscription({ ...mapSubscription(event.data.object), status: "canceled" });
        break;
      }
      default:
        break;
    }
    res.status(200).json({ received: true });
  } catch (e) {
    console.error("stripe-webhook error:", e);
    res.status(500).json({ error: "Server error" });
  }
}
