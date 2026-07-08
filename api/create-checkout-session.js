// /api/create-checkout-session.js
// Authenticated: verifies the caller's Supabase JWT server-side, then creates
// a Stripe Checkout session (subscription mode). Membership truth is written
// ONLY by /api/stripe-webhook — never here, never by the client.
import Stripe from "stripe";

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

let cachedPrices = null;
async function getPrices(stripe) {
  if (cachedPrices) return cachedPrices;
  const list = await stripe.prices.list({
    lookup_keys: ["good_hours_monthly", "good_hours_yearly"],
    limit: 10,
  });
  cachedPrices = {
    month: list.data.find((p) => p.lookup_key === "good_hours_monthly")?.id,
    year: list.data.find((p) => p.lookup_key === "good_hours_yearly")?.id,
  };
  return cachedPrices;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      res.status(500).json({ error: "Payments not configured" });
      return;
    }
    const user = await getUserFromRequest(req);
    if (!user?.id) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const billing = req.body?.billing === "month" ? "month" : "year";
    const prices = await getPrices(stripe);
    const price = prices[billing];
    if (!price) {
      res.status(500).json({ error: "Price not found" });
      return;
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
      customer_email: user.email,
      metadata: { profile_id: user.id },
      subscription_data: { metadata: { profile_id: user.id } },
      allow_promotion_codes: true,
    });

    res.status(200).json({ url: session.url });
  } catch (e) {
    console.error("create-checkout-session error:", e);
    res.status(500).json({ error: "Server error" });
  }
}
