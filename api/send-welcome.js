// /api/send-welcome.js
// Sends the welcome email after someone creates an account. Authenticated with
// the caller's Supabase JWT so it can only ever email the person who just
// signed up — never an arbitrary address.
import { sendEmail, welcomeEmail } from "./_email.js";

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
    const user = await getUserFromRequest(req);
    if (!user?.email) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    await sendEmail(user.email, welcomeEmail());
    res.status(200).json({ sent: true });
  } catch (e) {
    console.error("send-welcome error:", e);
    res.status(500).json({ error: "Server error" });
  }
}
