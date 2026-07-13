import { useState, useEffect } from "react";
import { Sun, MapPin, Clock, Heart, Users, Bookmark, Globe, MessageCircle, Sparkles, ChevronRight, Plus, X, Calendar, ThumbsUp, Baby, ShieldCheck, Star, Camera } from "lucide-react";
import { supabase } from "./supabaseClient";

// ------------------------------------------------------------------
// THE GOOD HOURS — MVP
// Screens: Plan Builder → Generated Plan → My Plans → Community
// Backend notes for Supabase dev are at the bottom of this file.
// NOTE: plan generation runs server-side via /api/generate-plan
// (Anthropic key protected). Auth is Supabase email + password;
// plan persistence + subscriptions (Stripe) land in the next updates.
// ------------------------------------------------------------------

const FONT_LINK = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@400;600;700;800&display=swap');
    .mnn-root { font-family: 'Nunito', sans-serif; }
    .mnn-display { font-family: 'Baloo 2', cursive; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .fade-up { animation: fadeUp .45s ease both; }
    .fade-up-1 { animation-delay: .05s; } .fade-up-2 { animation-delay: .12s; }
    .fade-up-3 { animation-delay: .2s; } .fade-up-4 { animation-delay: .28s; }
    @keyframes bob { 0%,100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-4px) rotate(2deg); } }
    .logo-bob { animation: bob 3.2s ease-in-out infinite; transform-origin: center; }
    @keyframes wiggle { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(-1deg); } }
    .sticker-wiggle { animation: wiggle 2.6s ease-in-out infinite; display: inline-block; }
  `}</style>
);

// ---------- Palette: "Juice Box" — bubblegum pink, splash teal, sunshine ----------
const C = {
  cream: "#FFF9EC",      // butter background
  card: "#FFFFFF",
  terra: "#FF5D8F",      // bubblegum pink (primary)
  terraSoft: "#FFE1EC",
  sage: "#17C3B2",       // splash teal (secondary)
  sageSoft: "#D6F5F1",
  ink: "#2E294E",        // deep plum (text)
  inkSoft: "#8E89A8",
  gold: "#FFB627",       // sunshine (accent)
  goldSoft: "#FFF0D4",
};

// ---------- Logo: smiling sun in a juice-box orbit ----------
function MnnLogo({ size = 52 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="logo-bob">
      {/* rays */}
      {[...Array(8)].map((_, i) => {
        const a = (i * 45 * Math.PI) / 180;
        const x1 = 32 + Math.cos(a) * 24, y1 = 32 + Math.sin(a) * 24;
        const x2 = 32 + Math.cos(a) * 30, y2 = 32 + Math.sin(a) * 30;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFB627" strokeWidth="5" strokeLinecap="round" />;
      })}
      {/* face */}
      <circle cx="32" cy="32" r="19" fill="#FFB627" />
      <circle cx="32" cy="32" r="19" fill="none" stroke="#2E294E" strokeWidth="2.5" />
      {/* eyes */}
      <circle cx="25.5" cy="29" r="2.6" fill="#2E294E" />
      <circle cx="38.5" cy="29" r="2.6" fill="#2E294E" />
      {/* rosy cheeks */}
      <circle cx="22" cy="35.5" r="3.2" fill="#FF5D8F" opacity=".55" />
      <circle cx="42" cy="35.5" r="3.2" fill="#FF5D8F" opacity=".55" />
      {/* big smile */}
      <path d="M24 36.5 Q32 44.5 40 36.5" fill="none" stroke="#2E294E" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

// ---------- Trust badges ----------
function VerifiedBadge({ small }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full font-extrabold"
      style={{ background: C.sageSoft, color: "#0E9488", fontSize: small ? 9 : 10, padding: small ? "1px 5px" : "2px 7px" }}
      title="Verified Caregiver — completed selfie verification"
    >
      <ShieldCheck size={small ? 9 : 11} /> verified
    </span>
  );
}

function HostBadge() {
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full font-extrabold"
      style={{ background: C.goldSoft, color: "#C77800", fontSize: 10, padding: "2px 7px" }}
      title="Trusted Host — 3+ meetups with positive ratings"
    >
      <Star size={11} fill="#C77800" /> trusted host
    </span>
  );
}

// ---------- Featured listings (local kids' businesses pay for placement) ----------
// Sponsors live in the `sponsors` table (Ashley manages rows from the dashboard).
// The "get featured" link points at the owner's Typeform.
const TYPEFORM_URL = "https://form.typeform.com/to/n2lqoAFp";

function dbSponsorToUi(row) {
  return {
    id: row.id,
    name: row.name,
    neighborhood: row.neighborhood,
    pitch: row.pitch,
    ages: row.ages,
    offer: row.offer_label,
    link: row.link_url,
  };
}

function FeaturedCard({ biz }) {
  return (
    <div
      className="fade-up fade-up-2 rounded-3xl p-5 relative overflow-hidden"
      style={{ background: C.card, border: `3px solid ${C.gold}`, boxShadow: "0 2px 12px rgba(46,41,78,.07)" }}
    >
      <div className="flex items-center justify-between">
        <Pill tone="gold">📌 FEATURED{biz.neighborhood ? ` · ${biz.neighborhood}` : ""}</Pill>
        {biz.offer && (
          <span className="text-[10px] font-extrabold px-2 py-1 rounded-full" style={{ background: C.terraSoft, color: C.terra }}>
            {biz.offer}
          </span>
        )}
      </div>
      <h3 className="font-extrabold mt-2" style={{ color: C.ink }}>{biz.name}</h3>
      {biz.pitch && <p className="text-xs font-semibold mt-1 leading-relaxed" style={{ color: C.inkSoft }}>{biz.pitch}</p>}
      <div className="flex items-center justify-between mt-3">
        {biz.ages ? <Pill tone="sage">ages {biz.ages}</Pill> : <span />}
        {biz.link ? (
          <a
            href={biz.link}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl text-xs font-extrabold transition-all active:scale-95 inline-block"
            style={{ background: C.gold, color: C.ink }}
          >
            Claim offer →
          </a>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

// Empty-state for the featured slot: invites a local business to claim it,
// personalized with the viewer's neighborhood. Shows when no sponsor is active.
function FeaturedInvite({ neighborhood }) {
  return (
    <a
      href={TYPEFORM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="block fade-up fade-up-2 rounded-3xl p-5 relative overflow-hidden"
      style={{ background: C.card, border: `3px dashed ${C.gold}`, boxShadow: "0 2px 12px rgba(46,41,78,.07)" }}
    >
      <div className="flex items-center justify-between">
        <Pill tone="gold">📌 FEATURED{neighborhood ? ` · ${neighborhood}` : ""}</Pill>
        <span className="text-[10px] font-extrabold px-2 py-1 rounded-full" style={{ background: C.terraSoft, color: C.terra }}>
          YOUR SPOT
        </span>
      </div>
      <h3 className="font-extrabold mt-2" style={{ color: C.ink }}>Own a local business?</h3>
      <p className="text-xs font-semibold mt-1 leading-relaxed" style={{ color: C.inkSoft }}>
        Tell {neighborhood || "your neighborhood"} families what you offer — get featured right here.
      </p>
      <div className="flex items-center justify-end mt-3">
        <span className="px-4 py-2 rounded-xl text-xs font-extrabold" style={{ background: C.gold, color: C.ink }}>
          Get featured →
        </span>
      </div>
    </a>
  );
}

// ---------- Plan generation (server-side, key protected) ----------
async function generatePlan({ ages, slots, location, planDate }, accessToken) {
  const res = await fetch("/api/generate-plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ ages, slots, location, planDate }),
  });
  if (res.status === 402) throw new Error("membership_required");
  if (!res.ok) throw new Error("Plan generation failed");
  return await res.json();
}

// ---------- Live events (server-side web search; fires after the plan) ----------
// Two focused requests (kind: "local" | "trip") run in parallel — each stays
// under Vercel's function time limit and paints its section as it lands.
async function fetchTodaysEvents({ location, planDate, ages, kind }, accessToken) {
  const res = await fetch("/api/fetch-events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ location, planDate, ages, kind }),
  });
  if (!res.ok) throw new Error("Events search failed");
  return await res.json();
}

// ---------- DB plan row (snake_case) → UI plan shape (camelCase) ----------
function dbPlanToUi(row) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    location: row.location,
    planDate: row.plan_date,
    ages: row.ages ?? [],
    blocks: row.blocks ?? [],
    proTip: row.pro_tip,
    isPublic: row.is_public,
    savedAt: new Date(row.created_at).toLocaleDateString(),
  };
}

// ---------- Small components ----------
function Pill({ children, tone = "sage" }) {
  const tones = {
    sage: { bg: C.sageSoft, fg: C.sage },
    terra: { bg: C.terraSoft, fg: C.terra },
    gold: { bg: C.goldSoft, fg: "#C77800" },
  };
  const t = tones[tone];
  return (
    <span style={{ background: t.bg, color: t.fg }} className="px-2.5 py-1 rounded-full text-xs font-bold">
      {children}
    </span>
  );
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-2xl transition-all"
      style={{
        background: active ? C.ink : "transparent",
        color: active ? C.cream : C.inkSoft,
      }}
    >
      <Icon size={18} strokeWidth={2.4} />
      <span className="text-[11px] font-bold">{label}</span>
    </button>
  );
}

// ---------- Native app (wrapper) detection ----------
// Memberships are sold on the web only. Inside the iOS/Android app we hide the
// purchase flow entirely so the app never sells digital goods — this keeps us
// clear of App Store rule 3.1.1 and out of Apple's 30% cut.
// Belt and suspenders: a persisted ?app=1 flag, the wrapper's JS bridge, or its
// user agent. Set the app's start URL to https://www.thegoodhours.co/?app=1
const NATIVE_FLAG_KEY = "gh_native_app";
function detectNativeApp() {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("app") === "1") {
      localStorage.setItem(NATIVE_FLAG_KEY, "1");
    }
    if (localStorage.getItem(NATIVE_FLAG_KEY) === "1") return true;
  } catch (e) { /* private mode — fall through to the other signals */ }
  const bridge = window.natively;
  if (bridge && (bridge.isIosApp || bridge.isAndroidApp)) return true;
  return /natively/i.test(navigator.userAgent || "");
}

// ---------- Main App ----------
export default function TheGoodHours() {
  const [tab, setTab] = useState("build"); // build | plan | saved | community
  const [ages, setAges] = useState([""]);
  const [slots, setSlots] = useState([{ from: "9:00 AM", to: "12:00 PM" }]);
  const [location, setLocation] = useState("");
  const [planDate, setPlanDate] = useState(new Date().toISOString().slice(0, 10)); // defaults to today
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(null);
  const [savedPlans, setSavedPlans] = useState([]);
  const [featured, setFeatured] = useState(null); // one active sponsor from the sponsors table
  // --- Community (Milestone 3): real public plans, likes, comments ---
  const [communityLive, setCommunityLive] = useState(false); // owner-flipped toggle
  const [feed, setFeed] = useState([]);
  const [feedComments, setFeedComments] = useState({}); // { [planId]: comment[] }
  // --- Admin (owner) sponsor management ---
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminSponsors, setAdminSponsors] = useState([]);
  const [sponsorForm, setSponsorForm] = useState(null); // null = form closed; object = adding/editing
  const [adminBusy, setAdminBusy] = useState(false);
  const [expandedPost, setExpandedPost] = useState(null);
  const [newComment, setNewComment] = useState("");
  // --- Auth + membership state ---
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true); // gate while restoring the session
  const [authStep, setAuthStep] = useState("paywall"); // paywall | app (login renders whenever there's no session)
  const [authMode, setAuthMode] = useState("signin"); // signin | signup
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false); // set-a-new-password screen
  const [newPassword, setNewPassword] = useState("");
  const [previewMode, setPreviewMode] = useState(false); // free taste: 1 plan, no card
  const [previewUsed, setPreviewUsed] = useState(false);
  const [email, setEmail] = useState("");
  const [billing, setBilling] = useState("year"); // month | year
  const [isMember, setIsMember] = useState(false); // subscriptions.status === 'active'
  const [freePlansUsed, setFreePlansUsed] = useState(0);
  const [dataLoading, setDataLoading] = useState(true); // per-user data load after login
  const [saving, setSaving] = useState(false);
  const [checkoutState, setCheckoutState] = useState("idle"); // idle | loading | error
  const [isNativeApp, setIsNativeApp] = useState(detectNativeApp);
  // --- Live events (load after the plan so they never block it) ---
  const [events, setEvents] = useState(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsPlanId, setEventsPlanId] = useState(null); // events belong to the plan that generated them

  // The wrapper can inject its JS bridge after first paint — re-check once
  useEffect(() => {
    if (isNativeApp) return;
    const t = setTimeout(() => setIsNativeApp(detectNativeApp()), 800);
    return () => clearTimeout(t);
  }, [isNativeApp]);

  // Session bootstrap: restore on load, then follow sign-in/sign-out events
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      // arriving from a "reset password" email: show the set-a-new-password screen
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      setSession(newSession);
      if (!newSession) {
        // signed out — wipe per-user state; login screen renders while session is null
        setAuthStep("paywall");
        setPreviewMode(false);
        setPreviewUsed(false);
        setPlan(null);
        setSavedPlans([]);
        setTab("build");
        setAuthMode("signin");
        setPassword("");
        setAuthBusy(false);
        setAuthError("");
        setAuthNotice("");
        setRecoveryMode(false);
        setNewPassword("");
        setIsMember(false);
        setFreePlansUsed(0);
        setDataLoading(true);
        setCheckoutState("idle");
        setEvents(null);
        setEventsLoading(false);
        setEventsPlanId(null);
        setIsAdmin(false);
        setShowAdmin(false);
        setAdminSponsors([]);
        setSponsorForm(null);
        setCommunityLive(false);
        setFeed([]);
        setFeedComments({});
        setExpandedPost(null);
        setNewComment("");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Per-user data: profile (free-preview counter), subscription status, saved plans
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    let cancelled = false;
    setDataLoading(true);
    (async () => {
      const fetchSub = () => supabase.from("subscriptions").select("status").eq("profile_id", userId).maybeSingle();
      const [profileRes, subRes, plansRes, sponsorRes, adminRes, cfgRes, feedRes] = await Promise.all([
        supabase.from("profiles").select("free_plans_used").eq("id", userId).maybeSingle(),
        fetchSub(),
        supabase.from("plans").select("*").eq("profile_id", userId).order("created_at", { ascending: false }),
        supabase.from("sponsors").select("*").eq("active", true).order("created_at", { ascending: false }).limit(1),
        supabase.rpc("is_admin"), // errors harmlessly (→ false) until migration 5 is applied
        supabase.from("app_config").select("community_live").eq("id", 1).maybeSingle(),
        supabase.rpc("community_feed"), // errors harmlessly (→ []) until migration 6 is applied
      ]);
      if (cancelled) return;
      setFeatured(sponsorRes.data?.[0] ? dbSponsorToUi(sponsorRes.data[0]) : null);
      setIsAdmin(adminRes.data === true);
      setCommunityLive(cfgRes.data?.community_live === true);
      setFeed(feedRes.data ?? []);
      const used = profileRes.data?.free_plans_used ?? 0;
      let member = subRes.data?.status === "active";
      // Back from Stripe checkout: the webhook can lag the redirect by a few seconds
      if (!member && window.location.search.includes("checkout=success")) {
        for (let i = 0; i < 8 && !member && !cancelled; i++) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          const retry = await fetchSub();
          member = retry.data?.status === "active";
        }
      }
      if (window.location.search.includes("checkout=")) {
        window.history.replaceState(null, "", window.location.pathname);
      }
      if (cancelled) return;
      setFreePlansUsed(used);
      setPreviewUsed(used >= 1);
      setIsMember(member);
      setSavedPlans((plansRes.data ?? []).map(dbPlanToUi));
      // members land straight in the app; everyone else meets the paywall
      setPreviewMode(false);
      setAuthStep(member ? "app" : "paywall");
      setDataLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  // --- Admin sponsor management (owner-only, gated by is_admin RLS) ---
  async function loadAdminSponsors() {
    const { data } = await supabase.from("sponsors").select("*").order("created_at", { ascending: false });
    setAdminSponsors(data ?? []);
  }
  async function refreshFeatured() {
    const { data } = await supabase.from("sponsors").select("*").eq("active", true).order("created_at", { ascending: false }).limit(1);
    setFeatured(data?.[0] ? dbSponsorToUi(data[0]) : null);
  }
  function openAdmin() {
    setShowAdmin(true);
    setSponsorForm(null);
    loadAdminSponsors();
  }
  function blankSponsor() {
    setSponsorForm({ name: "", neighborhood: "", pitch: "", ages: "", offer_label: "", link_url: "", active: true });
  }
  async function saveSponsor() {
    if (!sponsorForm?.name?.trim() || adminBusy) return;
    setAdminBusy(true);
    const payload = {
      name: sponsorForm.name,
      neighborhood: sponsorForm.neighborhood,
      pitch: sponsorForm.pitch,
      ages: sponsorForm.ages,
      offer_label: sponsorForm.offer_label,
      link_url: sponsorForm.link_url,
      active: sponsorForm.active,
    };
    const res = sponsorForm.id
      ? await supabase.from("sponsors").update(payload).eq("id", sponsorForm.id)
      : await supabase.from("sponsors").insert(payload);
    setAdminBusy(false);
    if (!res.error) {
      setSponsorForm(null);
      await loadAdminSponsors();
      await refreshFeatured();
    }
  }
  async function toggleSponsorActive(row) {
    if (adminBusy) return;
    setAdminBusy(true);
    await supabase.from("sponsors").update({ active: !row.active }).eq("id", row.id);
    setAdminBusy(false);
    await loadAdminSponsors();
    await refreshFeatured();
  }
  async function deleteSponsor(id) {
    if (adminBusy) return;
    setAdminBusy(true);
    await supabase.from("sponsors").delete().eq("id", id);
    setAdminBusy(false);
    await loadAdminSponsors();
    await refreshFeatured();
  }

  const authReady = email.includes("@") && password.length >= 6;

  async function handleAuthSubmit() {
    if (!authReady || authBusy) return;
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    if (authMode === "signup") {
      const { data, error: sErr } = await supabase.auth.signUp({ email, password });
      setAuthBusy(false);
      if (sErr) {
        setAuthError(/registered|exists/i.test(sErr.message) ? "That email already has an account — log in instead." : "Couldn't create your account — try again.");
        return;
      }
      if (!data.session) {
        // "Confirm email" is on in Supabase — they must confirm before logging in
        setAuthNotice("Check your email to confirm your account, then log in.");
        setAuthMode("signin");
        setPassword("");
      }
      // otherwise the auth listener picks up the session and the app moves on
    } else {
      const { error: iErr } = await supabase.auth.signInWithPassword({ email, password });
      setAuthBusy(false);
      if (iErr) setAuthError("Wrong email or password — try again.");
    }
  }

  async function handleForgotPassword() {
    if (!email.includes("@")) {
      setAuthError("Type your email first, then tap forgot password.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    const { error: rErr } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setAuthBusy(false);
    if (rErr) setAuthError("Couldn't send the reset email — try again.");
    else setAuthNotice("We emailed you a link to reset your password.");
  }

  async function handleSetNewPassword() {
    if (newPassword.length < 6 || authBusy) return;
    setAuthBusy(true);
    setAuthError("");
    const { error: uErr } = await supabase.auth.updateUser({ password: newPassword });
    setAuthBusy(false);
    if (uErr) {
      setAuthError("Couldn't update your password — try again.");
    } else {
      setRecoveryMode(false);
      setNewPassword("");
    }
  }

  function handleSignOut() {
    supabase.auth.signOut(); // the auth listener above resets state back to the login screen
  }

  const canGenerate = ages.some((a) => a.trim()) && location.trim() && slots.some((s) => s.from && s.to);

  async function handleGenerate() {
    // Preview users get exactly one plan — second attempt returns to paywall
    if (previewMode && previewUsed) { setAuthStep("paywall"); return; }
    setLoading(true);
    setError("");
    try {
      const token = session?.access_token;
      const p = await generatePlan({ ages, slots, location, planDate }, token);
      const genId = Date.now();
      setPlan({ ...p, id: genId, location, ages: [...ages], planDate, isPublic: false, savedAt: null });
      setTab("plan");
      if (previewMode) {
        // the server increments profiles.free_plans_used atomically
        setPreviewUsed(true);
        setFreePlansUsed(freePlansUsed + 1);
      }
      // Live events stream in AFTER the plan is on screen (~30s web search) —
      // a bonus, never a blocker. Local + worth-the-trip load in parallel and
      // each section paints as soon as its results land.
      setEvents(null);
      setEventsPlanId(genId);
      setEventsLoading(true);
      const mergeEvents = (partial) =>
        setEvents((prev) => ({ local: [], worthTheTrip: [], ...(prev || {}), ...partial }));
      Promise.allSettled([
        fetchTodaysEvents({ location, planDate, ages, kind: "local" }, token)
          .then(mergeEvents)
          .catch(() => mergeEvents({ local: [] })),
        fetchTodaysEvents({ location, planDate, ages, kind: "trip" }, token)
          .then(mergeEvents)
          .catch(() => mergeEvents({ worthTheTrip: [] })),
      ]).then(() => setEventsLoading(false));
    } catch (e) {
      if (e.message === "membership_required") {
        setPreviewUsed(true);
        setAuthStep("paywall");
      } else {
        setError("Couldn't generate a plan — try again in a moment.");
      }
    }
    setLoading(false);
  }

  async function handleStartMembership() {
    setCheckoutState("loading");
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ billing }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error("checkout failed");
      window.location.href = data.url; // Stripe Checkout; the webhook flips membership
    } catch (e) {
      setCheckoutState("error");
    }
  }

  async function savePlan(makePublic) {
    if (previewMode) { setAuthStep("paywall"); return; } // saving is a member feature
    if (!plan || !session?.user?.id || saving) return;
    setSaving(true);
    setError("");
    const payload = {
      profile_id: session.user.id,
      title: plan.title,
      summary: plan.summary,
      location: plan.location,
      plan_date: plan.planDate,
      ages: plan.ages,
      blocks: plan.blocks,
      pro_tip: plan.proTip,
      is_public: makePublic,
    };
    // freshly generated plans carry a Date.now() numeric id — omit it so Postgres mints the uuid
    if (typeof plan.id === "string" && plan.id.length === 36) payload.id = plan.id;
    const { data, error: saveError } = await supabase.from("plans").upsert(payload).select().single();
    setSaving(false);
    if (saveError || !data) {
      setError("Couldn't save your plan — try again in a moment.");
      return;
    }
    const saved = dbPlanToUi(data);
    setSavedPlans((prev) => [saved, ...prev.filter((p) => p.id !== saved.id && p.id !== plan.id)]);
    if (eventsPlanId === plan.id) setEventsPlanId(saved.id); // keep events attached across the id change
    setPlan(saved);
    if (makePublic) {
      const { data: fresh } = await supabase.rpc("community_feed");
      setFeed(fresh ?? []); // the newly public plan now shows in the real feed
    }
  }

  async function toggleLike(planId) {
    const item = feed.find((f) => f.id === planId);
    if (!item || !session?.user?.id) return;
    const liked = item.liked_by_me;
    // optimistic; the DB write follows
    setFeed((prev) => prev.map((f) => (f.id === planId ? { ...f, liked_by_me: !liked, like_count: Number(f.like_count) + (liked ? -1 : 1) } : f)));
    if (liked) {
      await supabase.from("plan_likes").delete().eq("plan_id", planId).eq("profile_id", session.user.id);
    } else {
      await supabase.from("plan_likes").insert({ plan_id: planId, profile_id: session.user.id });
    }
  }

  async function openComments(planId) {
    if (expandedPost === planId) { setExpandedPost(null); return; }
    setExpandedPost(planId);
    setNewComment("");
    const { data } = await supabase.rpc("plan_comments_for", { p_plan_id: planId });
    setFeedComments((prev) => ({ ...prev, [planId]: data ?? [] }));
  }

  async function addComment(planId) {
    const body = (newComment || "").trim();
    if (!body || !session?.user?.id) return;
    const { error: cErr } = await supabase.from("plan_comments").insert({ plan_id: planId, profile_id: session.user.id, body });
    if (cErr) return;
    setNewComment("");
    const { data } = await supabase.rpc("plan_comments_for", { p_plan_id: planId });
    setFeedComments((prev) => ({ ...prev, [planId]: data ?? [] }));
    setFeed((prev) => prev.map((f) => (f.id === planId ? { ...f, comment_count: Number(f.comment_count) + 1 } : f)));
  }

  async function deleteComment(planId, commentId) {
    await supabase.from("plan_comments").delete().eq("id", commentId);
    const { data } = await supabase.rpc("plan_comments_for", { p_plan_id: planId });
    setFeedComments((prev) => ({ ...prev, [planId]: data ?? [] }));
    setFeed((prev) => prev.map((f) => (f.id === planId ? { ...f, comment_count: Math.max(0, Number(f.comment_count) - 1) } : f)));
  }

  async function moderateRemovePost(planId) {
    await supabase.from("plans").update({ is_public: false }).eq("id", planId); // admin unpublish
    setFeed((prev) => prev.filter((f) => f.id !== planId));
  }

  async function toggleCommunityLive() {
    const next = !communityLive;
    setCommunityLive(next);
    await supabase.from("app_config").update({ community_live: next, updated_at: new Date().toISOString() }).eq("id", 1);
  }

  // ---------------- AUTH SPLASH ----------------
  if (authLoading) {
    return (
      <div className="mnn-root min-h-screen w-full flex items-center justify-center" style={{ background: C.cream }}>
        {FONT_LINK}
        <MnnLogo size={96} />
      </div>
    );
  }

  // ---------------- SET A NEW PASSWORD (arrived from the reset email) ----------------
  if (recoveryMode) {
    return (
      <div className="mnn-root min-h-screen w-full flex justify-center" style={{ background: C.cream }}>
        {FONT_LINK}
        <div className="w-full max-w-md flex flex-col items-center justify-center px-8 min-h-screen">
          <MnnLogo size={72} />
          <h1 className="mnn-display text-3xl font-bold mt-4 text-center" style={{ color: C.ink }}>
            Pick a new password
          </h1>
          <div className="w-full mt-6">
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSetNewPassword(); }}
              placeholder="new password"
              type="password"
              autoComplete="new-password"
              className="w-full rounded-2xl px-5 py-4 text-sm font-bold outline-none border-2 text-center"
              style={{ borderColor: "#F3EBDA", color: C.ink, background: C.card }}
            />
            <button
              disabled={newPassword.length < 6 || authBusy}
              onClick={handleSetNewPassword}
              className="mt-3 w-full rounded-2xl py-4 font-extrabold text-base transition-all active:scale-[.98]"
              style={{
                background: newPassword.length >= 6 ? C.terra : "#EAE6F2",
                color: newPassword.length >= 6 ? "#fff" : C.inkSoft,
                boxShadow: newPassword.length >= 6 ? "0 6px 20px rgba(255,93,143,.4)" : "none",
              }}
            >
              {authBusy ? "Saving..." : "Save password →"}
            </button>
            <p className="text-[11px] font-bold text-center mt-3" style={{ color: authError ? C.terra : C.inkSoft }}>
              {authError || "At least 6 characters."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- LOGIN SCREEN ----------------
  if (!session) {
    return (
      <div className="mnn-root min-h-screen w-full flex justify-center" style={{ background: C.cream }}>
        {FONT_LINK}
        <div className="w-full max-w-md flex flex-col items-center justify-center px-8 min-h-screen">
          <div className="fade-up"><MnnLogo size={96} /></div>
          <h1 className="mnn-display text-4xl font-bold mt-5 text-center leading-none tracking-tight fade-up fade-up-1" style={{ color: C.ink }}>
            the
            <span className="sticker-wiggle mx-1.5 px-2 rounded-lg" style={{ background: C.terra, color: "#fff", boxShadow: "2px 2px 0 #2E294E" }}>
              good
            </span>
            hours
          </h1>
          <p className="text-sm font-bold mt-3 text-center fade-up fade-up-2" style={{ color: C.inkSoft }}>
            The hours with little kids either drag or shine.<br />We make them shine — with real caregivers nearby.
          </p>
          <div className="w-full mt-8 fade-up fade-up-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              type="email"
              autoComplete="email"
              className="w-full rounded-2xl px-5 py-4 text-sm font-bold outline-none border-2 text-center"
              style={{ borderColor: "#F3EBDA", color: C.ink, background: C.card }}
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAuthSubmit(); }}
              placeholder="your password"
              type="password"
              autoComplete={authMode === "signup" ? "new-password" : "current-password"}
              className="mt-3 w-full rounded-2xl px-5 py-4 text-sm font-bold outline-none border-2 text-center"
              style={{ borderColor: "#F3EBDA", color: C.ink, background: C.card }}
            />
            <button
              disabled={!authReady || authBusy}
              onClick={handleAuthSubmit}
              className="mt-3 w-full rounded-2xl py-4 font-extrabold text-base transition-all active:scale-[.98]"
              style={{
                background: authReady ? C.terra : "#EAE6F2",
                color: authReady ? "#fff" : C.inkSoft,
                boxShadow: authReady ? "0 6px 20px rgba(255,93,143,.4)" : "none",
              }}
            >
              {authBusy ? "One sec..." : authMode === "signup" ? "Create account →" : "Log in →"}
            </button>

            {(authError || authNotice) && (
              <p className="text-[11px] font-bold text-center mt-3" style={{ color: authError ? C.terra : C.sage }}>
                {authError || authNotice}
              </p>
            )}

            <div className="flex items-center justify-center gap-4 mt-4">
              <button
                onClick={() => { setAuthMode(authMode === "signup" ? "signin" : "signup"); setAuthError(""); setAuthNotice(""); }}
                className="text-[11px] font-extrabold"
                style={{ color: C.terra }}
              >
                {authMode === "signup" ? "Already have an account? Log in" : "New here? Create an account"}
              </button>
              {authMode === "signin" && (
                <button onClick={handleForgotPassword} disabled={authBusy} className="text-[11px] font-extrabold" style={{ color: C.inkSoft }}>
                  Forgot password?
                </button>
              )}
            </div>

            <p className="text-[11px] font-bold text-center mt-3" style={{ color: C.inkSoft }}>
              {authMode === "signup"
                ? "Pick a password with at least 6 characters. 💛"
                : "Welcome back — let's make today a good one. ☀️"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- DATA SPLASH (loading the user's profile/plans) ----------------
  if (dataLoading) {
    return (
      <div className="mnn-root min-h-screen w-full flex items-center justify-center" style={{ background: C.cream }}>
        {FONT_LINK}
        <MnnLogo size={96} />
      </div>
    );
  }

  // ---------------- PAYWALL SCREEN ----------------
  if (authStep === "paywall") {
    return (
      <div className="mnn-root min-h-screen w-full flex justify-center" style={{ background: C.cream }}>
        {FONT_LINK}
        <div className="w-full max-w-md flex flex-col px-6 pt-12 pb-10 min-h-screen">
          <div className="flex justify-center fade-up"><MnnLogo size={64} /></div>
          <h1 className="mnn-display text-3xl font-bold mt-4 text-center fade-up fade-up-1" style={{ color: C.ink }}>
            Join the village 🏡
          </h1>
          <p className="text-sm font-bold mt-2 text-center leading-relaxed fade-up fade-up-1" style={{ color: C.inkSoft }}>
            Your membership is what keeps this space independent — no ads, no data selling, no noise. We'd rather charge you $7 than sell your data.
          </p>

          {/* Plan cards — hidden inside the app (no digital sales in-app) */}
          {!isNativeApp && (
          <div className="flex gap-3 mt-6 fade-up fade-up-2">
            <button
              onClick={() => setBilling("month")}
              className="flex-1 rounded-3xl p-4 text-left border-[3px] transition-all"
              style={{ borderColor: billing === "month" ? C.terra : "#F3EBDA", background: C.card }}
            >
              <p className="text-xs font-extrabold" style={{ color: C.inkSoft }}>MONTHLY</p>
              <p className="mnn-display text-2xl font-bold mt-1" style={{ color: C.ink }}>$7<span className="text-sm">/mo</span></p>
              <p className="text-[11px] font-bold mt-1" style={{ color: C.inkSoft }}>cancel anytime</p>
            </button>
            <button
              onClick={() => setBilling("year")}
              className="flex-1 rounded-3xl p-4 text-left border-[3px] relative transition-all"
              style={{ borderColor: billing === "year" ? C.terra : "#F3EBDA", background: C.card }}
            >
              <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-extrabold" style={{ background: C.gold, color: C.ink }}>
                SAVE 40%
              </span>
              <p className="text-xs font-extrabold" style={{ color: C.inkSoft }}>YEARLY</p>
              <p className="mnn-display text-2xl font-bold mt-1" style={{ color: C.ink }}>$50<span className="text-sm">/yr</span></p>
              <p className="text-[11px] font-bold mt-1" style={{ color: C.sage }}>≈ $4.17/mo</p>
            </button>
          </div>
          )}

          {/* What you get */}
          <div className="mt-5 rounded-3xl p-5 space-y-2.5 fade-up fade-up-3" style={{ background: C.card, boxShadow: "0 2px 12px rgba(46,41,78,.07)" }}>
            {[
              ["✨", "Unlimited AI day plans for your exact kids, hours & neighborhood"],
              ["🏡", "Your neighborhood's community — parents, nannies & grandparents alike"],
              ["🛡️", "No ads, ever — and we never sell your data"],
              ["📌", "Save & reuse the days that actually worked"],
            ].map(([emoji, line]) => (
              <div key={line} className="flex items-start gap-2.5">
                <span className="text-base">{emoji}</span>
                <p className="text-xs font-bold leading-relaxed" style={{ color: C.ink }}>{line}</p>
              </div>
            ))}
          </div>

          {isNativeApp ? (
            <div className="mt-6 rounded-2xl px-4 py-4 text-center fade-up fade-up-4" style={{ background: C.goldSoft }}>
              <p className="text-xs font-extrabold" style={{ color: "#9A5B00" }}>
                Memberships are managed on our website
              </p>
              <p className="text-[11px] font-bold mt-1 leading-relaxed" style={{ color: "#C77800" }}>
                Join at thegoodhours.co, then sign in here with the same email.
              </p>
            </div>
          ) : (
            <>
              <button
                onClick={handleStartMembership}
                disabled={checkoutState === "loading"}
                className="mt-6 w-full rounded-2xl py-4 font-extrabold text-base transition-all active:scale-[.98] fade-up fade-up-4"
                style={{ background: C.terra, color: "#fff", boxShadow: "0 6px 20px rgba(255,93,143,.4)" }}
              >
                {checkoutState === "loading"
                  ? "Starting checkout..."
                  : `Start my membership · ${billing === "year" ? "$50/yr" : "$7/mo"}`}
              </button>
              {checkoutState === "error" && (
                <p className="mt-2 text-center text-xs font-extrabold fade-up" style={{ color: C.terra }}>
                  Couldn't start checkout — try again in a moment.
                </p>
              )}
            </>
          )}
          {!previewUsed ? (
            <button
              onClick={() => { setPreviewMode(true); setAuthStep("app"); setTab("build"); }}
              className="mt-3 w-full rounded-2xl py-3.5 font-extrabold text-sm border-[3px] transition-all active:scale-[.98] fade-up fade-up-4"
              style={{ borderColor: C.sage, color: C.sage, background: "transparent" }}
            >
              👀 Not sure yet? Build one day plan free — no card
            </button>
          ) : (
            <p className="mt-3 text-center text-xs font-extrabold fade-up fade-up-4" style={{ color: C.sage }}>
              You've used your free plan — and it was a good one, right? 💛
            </p>
          )}
          {!isNativeApp && (
            <p className="text-[10px] font-bold text-center mt-3" style={{ color: C.inkSoft }}>
              Secure checkout via Stripe · cancel in two taps, no email required
            </p>
          )}
          <button onClick={handleSignOut} className="mt-4 w-full py-2 text-xs font-extrabold text-center" style={{ color: C.inkSoft }}>
            sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mnn-root min-h-screen w-full flex justify-center" style={{ background: C.cream }}>
      {FONT_LINK}
      <div className="w-full max-w-md flex flex-col min-h-screen">
        {/* Header */}
        <header className="px-6 pt-8 pb-4">
          <div className="flex items-center gap-3">
            <MnnLogo />
            <div className="flex-1">
              <h1 className="mnn-display text-3xl font-bold leading-none tracking-tight" style={{ color: C.ink }}>
                the
                <span
                  className="sticker-wiggle mx-1 px-2 rounded-lg"
                  style={{ background: C.terra, color: "#fff", boxShadow: "2px 2px 0 #2E294E" }}
                >
                  good
                </span>
                hours
              </h1>
              <p className="text-sm font-bold mt-1" style={{ color: C.inkSoft }}>
                make the little hours the good ones ✨
              </p>
            </div>
            <button onClick={handleSignOut} className="self-start text-[11px] font-extrabold" style={{ color: C.inkSoft }}>
              sign out
            </button>
          </div>
        </header>

        {/* Preview mode banner */}
        {previewMode && (
          <div className="mx-5 mb-2 rounded-2xl px-4 py-2.5 flex items-center justify-between" style={{ background: C.goldSoft }}>
            <p className="text-[11px] font-extrabold" style={{ color: "#9A5B00" }}>
              🍦 Free taste — {previewUsed ? "your plan is below!" : "1 day plan on us"}
            </p>
            <button onClick={() => setAuthStep("paywall")} className="px-3 py-1.5 rounded-lg text-[11px] font-extrabold" style={{ background: C.gold, color: C.ink }}>
              Join · $7/mo
            </button>
          </div>
        )}

        {/* Body */}
        <main className="flex-1 px-5 pb-28">
          {/* ---------------- BUILD TAB ---------------- */}
          {tab === "build" && (
            <div className="space-y-4">
              {/* Kids */}
              <section className="fade-up rounded-3xl p-5" style={{ background: C.card, boxShadow: "0 2px 12px rgba(46,41,78,.07)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Baby size={18} style={{ color: C.terra }} />
                  <h2 className="font-extrabold text-sm" style={{ color: C.ink }}>Who are we planning for?</h2>
                </div>
                <div className="space-y-2">
                  {ages.map((a, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={a}
                        onChange={(e) => setAges(ages.map((x, j) => (j === i ? e.target.value : x)))}
                        placeholder={`Child ${i + 1} age (e.g. 4, or 18 months)`}
                        className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold outline-none border-2 focus:border-current transition-colors"
                        style={{ borderColor: "#F3EBDA", color: C.ink, background: C.cream }}
                      />
                      {ages.length > 1 && (
                        <button onClick={() => setAges(ages.filter((_, j) => j !== i))} className="px-3 rounded-xl" style={{ background: C.terraSoft, color: C.terra }}>
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setAges([...ages, ""])}
                  className="mt-2 flex items-center gap-1.5 text-xs font-bold"
                  style={{ color: C.sage }}
                >
                  <Plus size={14} /> add another kid
                </button>
              </section>

              {/* Time slots */}
              <section className="fade-up fade-up-1 rounded-3xl p-5" style={{ background: C.card, boxShadow: "0 2px 12px rgba(46,41,78,.07)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={18} style={{ color: C.terra }} />
                  <h2 className="font-extrabold text-sm" style={{ color: C.ink }}>Which hours need a plan?</h2>
                </div>
                <div className="space-y-2">
                  {slots.map((s, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        value={s.from}
                        onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))}
                        placeholder="9:00 AM"
                        className="flex-1 min-w-0 rounded-xl px-4 py-3 text-sm font-semibold outline-none border-2"
                        style={{ borderColor: "#F3EBDA", color: C.ink, background: C.cream }}
                      />
                      <span className="text-xs font-bold" style={{ color: C.inkSoft }}>to</span>
                      <input
                        value={s.to}
                        onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))}
                        placeholder="12:00 PM"
                        className="flex-1 min-w-0 rounded-xl px-4 py-3 text-sm font-semibold outline-none border-2"
                        style={{ borderColor: "#F3EBDA", color: C.ink, background: C.cream }}
                      />
                      {slots.length > 1 && (
                        <button onClick={() => setSlots(slots.filter((_, j) => j !== i))} className="px-3 py-3 rounded-xl" style={{ background: C.terraSoft, color: C.terra }}>
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={() => setSlots([...slots, { from: "", to: "" }])} className="mt-2 flex items-center gap-1.5 text-xs font-bold" style={{ color: C.sage }}>
                  <Plus size={14} /> add time slot
                </button>
              </section>

              {/* Location */}
              <section className="fade-up fade-up-2 rounded-3xl p-5" style={{ background: C.card, boxShadow: "0 2px 12px rgba(46,41,78,.07)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin size={18} style={{ color: C.terra }} />
                  <h2 className="font-extrabold text-sm" style={{ color: C.ink }}>Where are you?</h2>
                </div>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Neighborhood, city (e.g. Park Slope, Brooklyn)"
                  className="w-full rounded-xl px-4 py-3 text-sm font-semibold outline-none border-2"
                  style={{ borderColor: "#F3EBDA", color: C.ink, background: C.cream }}
                />
                <p className="text-[11px] mt-2 font-semibold" style={{ color: C.inkSoft }}>
                  We'll pull in real nearby spots — libraries, parks, story times, open plays.
                </p>
              </section>

              {/* Which day */}
              <section className="fade-up fade-up-2 rounded-3xl p-5" style={{ background: C.card, boxShadow: "0 2px 12px rgba(46,41,78,.07)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={18} style={{ color: C.terra }} />
                  <h2 className="font-extrabold text-sm" style={{ color: C.ink }}>Which day?</h2>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  {[
                    { label: "Today", value: new Date().toISOString().slice(0, 10) },
                    { label: "Tomorrow", value: new Date(Date.now() + 86400000).toISOString().slice(0, 10) },
                  ].map((d) => (
                    <button
                      key={d.label}
                      onClick={() => setPlanDate(d.value)}
                      className="px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all active:scale-95"
                      style={{
                        background: planDate === d.value ? C.terra : C.cream,
                        color: planDate === d.value ? "#fff" : C.ink,
                        border: `2px solid ${planDate === d.value ? C.terra : "#F3EBDA"}`,
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                  <input
                    type="date"
                    value={planDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => e.target.value && setPlanDate(e.target.value)}
                    className="flex-1 min-w-[130px] rounded-xl px-3 py-2 text-xs font-extrabold outline-none border-2"
                    style={{ borderColor: "#F3EBDA", color: C.ink, background: C.cream }}
                  />
                </div>
                <p className="text-[11px] mt-2 font-semibold" style={{ color: C.inkSoft }}>
                  {new Date(planDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" })} plans are different — story times are weekday things, museums fill up on weekends. We factor it in.
                </p>
              </section>

              {error && (
                <div className="rounded-2xl px-4 py-3 text-sm font-bold" style={{ background: C.terraSoft, color: C.terra }}>
                  {error}
                </div>
              )}

              <button
                disabled={!canGenerate || loading}
                onClick={handleGenerate}
                className="fade-up fade-up-3 w-full rounded-2xl py-4 font-extrabold text-base flex items-center justify-center gap-2 transition-all active:scale-[.98]"
                style={{
                  background: canGenerate ? C.terra : "#EAE6F2",
                  color: canGenerate ? "#fff" : C.inkSoft,
                  boxShadow: canGenerate ? "0 6px 20px rgba(255,93,143,.4)" : "none",
                }}
              >
                <Sparkles size={18} />
                {loading ? "Building your day..." : "Build my day"}
              </button>
            </div>
          )}

          {/* ---------------- PLAN TAB ---------------- */}
          {tab === "plan" && (
            <div className="space-y-4">
              {!plan ? (
                <div className="text-center pt-16">
                  <p className="font-bold" style={{ color: C.inkSoft }}>No plan yet — build one first!</p>
                  <button onClick={() => setTab("build")} className="mt-3 px-5 py-2.5 rounded-xl font-bold text-sm" style={{ background: C.terra, color: "#fff" }}>
                    Start planning
                  </button>
                </div>
              ) : (
                <>
                  <div className="fade-up rounded-3xl p-5" style={{ background: C.ink }}>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Pill tone="gold">{plan.location}</Pill>
                      <Pill tone="terra">ages {plan.ages.filter(Boolean).join(", ")}</Pill>
                      {plan.planDate && (
                        <Pill tone="sage">{new Date(plan.planDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</Pill>
                      )}
                    </div>
                    <h2 className="mnn-display text-2xl font-bold mt-2" style={{ color: C.cream }}>{plan.title}</h2>
                    <p className="text-sm mt-1 font-semibold" style={{ color: "#B8B3D1" }}>{plan.summary}</p>
                  </div>

                  <div className="space-y-3">
                    {plan.blocks?.map((b, i) => (
                      <div key={i} className={`fade-up fade-up-${Math.min(i + 1, 4)} rounded-3xl p-5 flex gap-4`} style={{ background: C.card, boxShadow: "0 2px 12px rgba(46,41,78,.07)" }}>
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-xs" style={{ background: C.sageSoft, color: C.sage }}>
                            {i + 1}
                          </div>
                          {i < plan.blocks.length - 1 && <div className="w-0.5 flex-1 mt-2 rounded" style={{ background: "#F3EBDA" }} />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold" style={{ color: C.terra }}>{b.time}</span>
                            <Pill tone={b.cost?.toLowerCase() === "free" ? "sage" : "gold"}>{b.cost}</Pill>
                          </div>
                          <h3 className="font-extrabold mt-1" style={{ color: C.ink }}>{b.activity}</h3>
                          <p className="text-xs font-bold mt-0.5 flex items-center gap-1" style={{ color: C.inkSoft }}>
                            <MapPin size={12} /> {b.venue}
                          </p>
                          <p className="text-xs mt-1.5 font-semibold leading-relaxed" style={{ color: C.inkSoft }}>{b.why}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {plan.proTip && (
                    <div className="fade-up rounded-3xl p-4 flex gap-3 items-start" style={{ background: C.goldSoft }}>
                      <Sparkles size={17} style={{ color: "#C77800" }} className="mt-0.5 shrink-0" />
                      <p className="text-sm font-bold leading-relaxed" style={{ color: "#9A5B00" }}>{plan.proTip}</p>
                    </div>
                  )}

                  {/* Featured sponsor inside the plan — always labeled FEATURED */}
                  {featured && <FeaturedCard biz={featured} />}

                  {/* ---- Live events: happening today + worth the trip ---- */}
                  {eventsPlanId === plan.id && eventsLoading && (
                    <div className="fade-up rounded-2xl px-4 py-3 flex items-center gap-2" style={{ background: C.card, boxShadow: "0 2px 12px rgba(46,41,78,.07)" }}>
                      <span className="w-2 h-2 rounded-full animate-ping" style={{ background: C.terra }} />
                      <p className="text-xs font-bold" style={{ color: C.inkSoft }}>
                        Checking what's actually on in {plan.location} today — live search, ~30 seconds…
                      </p>
                    </div>
                  )}

                  {eventsPlanId === plan.id && events && events.local?.length > 0 && (
                    <div className="fade-up">
                      <p className="text-xs font-extrabold px-1 mb-2 flex items-center gap-1.5" style={{ color: C.ink }}>
                        <Calendar size={13} style={{ color: C.terra }} /> Happening today near you
                      </p>
                      <div className="space-y-2">
                        {events.local.map((ev, i) => (
                          <div key={i} className="rounded-2xl p-4" style={{ background: C.card, boxShadow: "0 2px 12px rgba(46,41,78,.07)", borderLeft: `4px solid ${C.terra}` }}>
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-extrabold text-sm flex-1 min-w-0" style={{ color: C.ink }}>{ev.name}</h4>
                              <span className="max-w-[38%] text-right"><Pill tone={String(ev.cost).toLowerCase() === "free" ? "sage" : "gold"}>{ev.cost}</Pill></span>
                            </div>
                            <p className="text-xs font-bold mt-0.5" style={{ color: C.terra }}>{ev.time} · {ev.venue}</p>
                            <p className="text-xs font-semibold mt-1.5 leading-relaxed" style={{ color: C.inkSoft }}>💡 {ev.note}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {eventsPlanId === plan.id && events && events.worthTheTrip?.length > 0 && (
                    <div className="fade-up">
                      <p className="text-xs font-extrabold px-1 mb-2 flex items-center gap-1.5" style={{ color: C.ink }}>
                        🚇 Worth the trip?
                      </p>
                      <div className="space-y-2">
                        {events.worthTheTrip.map((ev, i) => (
                          <div key={i} className="rounded-2xl p-4" style={{ background: C.ink }}>
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-extrabold text-sm flex-1 min-w-0" style={{ color: C.cream }}>{ev.name}</h4>
                              <span className="text-xs font-extrabold px-2 py-1 rounded-full max-w-[38%] text-center" style={{ background: C.gold, color: C.ink }}>{ev.cost}</span>
                            </div>
                            <p className="text-xs font-bold mt-0.5" style={{ color: C.gold }}>{ev.time} · {ev.venue}</p>
                            <p className="text-xs font-semibold mt-1.5 leading-relaxed" style={{ color: "#B8B3D1" }}>{ev.whyWorth}</p>
                            <p className="text-[11px] font-bold mt-1.5" style={{ color: C.sage }}>🚇 {ev.transitNote}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="rounded-2xl px-4 py-3 text-sm font-bold" style={{ background: C.terraSoft, color: C.terra }}>
                      {error}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => savePlan(false)} className="flex-1 rounded-2xl py-3.5 font-extrabold text-sm flex items-center justify-center gap-2 border-2 transition-all active:scale-[.98]" style={{ borderColor: C.ink, color: C.ink }}>
                      <Bookmark size={16} /> {plan.savedAt && !plan.isPublic ? "Saved ✓" : "Save private"}
                    </button>
                    <button onClick={() => savePlan(true)} className="flex-1 rounded-2xl py-3.5 font-extrabold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98]" style={{ background: C.sage, color: "#fff" }}>
                      <Globe size={16} /> {plan.isPublic ? "Shared ✓" : "Share public"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ---------------- SAVED TAB ---------------- */}
          {tab === "saved" && (
            <div className="space-y-3">
              {savedPlans.length === 0 ? (
                <div className="text-center pt-16">
                  <Bookmark size={36} className="mx-auto mb-3" style={{ color: "#DCD7EA" }} />
                  <p className="font-bold" style={{ color: C.inkSoft }}>Saved plans live here.</p>
                  <p className="text-xs font-semibold mt-1" style={{ color: C.inkSoft }}>Build a day and save it to reuse the good ones.</p>
                </div>
              ) : (
                savedPlans.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => { setPlan(p); setTab("plan"); }}
                    className={`fade-up fade-up-${Math.min(i + 1, 4)} w-full text-left rounded-3xl p-5 flex items-center justify-between`}
                    style={{ background: C.card, boxShadow: "0 2px 12px rgba(46,41,78,.07)" }}
                  >
                    <div>
                      <div className="flex gap-1.5 mb-1.5">
                        {p.isPublic ? <Pill tone="sage">public</Pill> : <Pill tone="terra">private</Pill>}
                        <Pill tone="gold">{p.savedAt}</Pill>
                      </div>
                      <h3 className="font-extrabold text-sm" style={{ color: C.ink }}>{p.title}</h3>
                      <p className="text-xs font-semibold mt-0.5" style={{ color: C.inkSoft }}>{p.location} · {p.blocks?.length} activities</p>
                    </div>
                    <ChevronRight size={18} style={{ color: C.inkSoft }} />
                  </button>
                ))
              )}
            </div>
          )}

          {/* ---------------- COMMUNITY TAB ---------------- */}
          {tab === "community" && (
            <div className="space-y-3">
              {/* Trust strip (softened — selfie verification is a future phase) */}
              <div className="fade-up rounded-2xl px-4 py-3 flex items-center gap-2.5" style={{ background: C.sageSoft }}>
                <ShieldCheck size={18} style={{ color: "#0E9488" }} className="shrink-0" />
                <p className="text-[11px] font-bold leading-snug" style={{ color: "#0E7C72" }}>
                  A space for real parents & caregivers to share the days that actually worked.
                </p>
              </div>

              {/* Admin-only entry point to the visual admin panel */}
              {isAdmin && (
                <button
                  onClick={openAdmin}
                  className="w-full rounded-2xl py-2.5 text-xs font-extrabold flex items-center justify-center gap-1.5 border-2 transition-all active:scale-[.98]"
                  style={{ borderColor: C.gold, color: "#9A5B00", background: C.goldSoft }}
                >
                  <Star size={13} fill="#9A5B00" /> Admin · community & featured
                </button>
              )}

              {/* Featured slot — a real paid sponsor, or an invite to become one */}
              {featured ? (
                <FeaturedCard biz={featured} />
              ) : (
                <FeaturedInvite neighborhood={(location && location.trim()) || savedPlans[0]?.location || ""} />
              )}
              {featured && (
                <a
                  href={TYPEFORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[10px] font-bold text-center"
                  style={{ color: C.inkSoft }}
                >
                  Own a kids' business? <span style={{ color: C.terra }}>Get featured in your neighborhood →</span>
                </a>
              )}

              {!communityLive ? (
                <div className="fade-up rounded-3xl p-6 text-center" style={{ background: C.card, boxShadow: "0 2px 12px rgba(46,41,78,.07)" }}>
                  <Users size={30} className="mx-auto mb-2" style={{ color: "#DCD7EA" }} />
                  <h3 className="mnn-display text-xl font-bold" style={{ color: C.ink }}>Community coming soon 🌱</h3>
                  <p className="text-xs font-semibold mt-1.5 leading-relaxed" style={{ color: C.inkSoft }}>
                    Soon you'll share your best days and see what's working for parents near you. Stay tuned 💛
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-bold px-1" style={{ color: C.inkSoft }}>
                    Real plans from real parents & caregivers near you. See what worked, steal a day, share your own.
                  </p>
                  {feed.length === 0 ? (
                    <div className="text-center pt-10">
                      <p className="font-bold" style={{ color: C.inkSoft }}>No shared plans yet.</p>
                      <p className="text-xs font-semibold mt-1" style={{ color: C.inkSoft }}>Build a day and tap "Share public" to be the first!</p>
                    </div>
                  ) : (
                    feed.map((post, i) => {
                      const mine = post.author_id === session?.user?.id;
                      return (
                        <div key={post.id} className={`fade-up fade-up-${Math.min(i + 1, 4)} rounded-3xl p-5`} style={{ background: mine ? C.sageSoft : C.card, boxShadow: "0 2px 12px rgba(46,41,78,.07)" }}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold min-w-0 truncate" style={{ color: C.sage }}>
                              {post.author_name}{post.author_neighborhood ? ` · ${post.author_neighborhood}` : ""}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {mine && <Pill tone="sage">yours</Pill>}
                              {isAdmin && (
                                <button onClick={() => moderateRemovePost(post.id)} className="text-[10px] font-extrabold px-2 py-1 rounded-full" style={{ background: C.terraSoft, color: C.terra }}>
                                  remove
                                </button>
                              )}
                            </div>
                          </div>
                          <h3 className="font-extrabold mt-1" style={{ color: C.ink }}>{post.title}</h3>
                          <ul className="mt-2 space-y-1">
                            {(post.blocks || []).map((b, j) => (
                              <li key={j} className="text-xs font-semibold flex gap-1.5" style={{ color: C.inkSoft }}>
                                <span style={{ color: C.terra }}>•</span> <span><span className="font-bold">{b.time}</span> {b.activity}</span>
                              </li>
                            ))}
                          </ul>

                          <div className="flex items-center gap-4 mt-3">
                            <button onClick={() => toggleLike(post.id)} className="flex items-center gap-1.5 text-xs font-extrabold transition-all active:scale-95" style={{ color: post.liked_by_me ? C.terra : C.inkSoft }}>
                              <Heart size={15} fill={post.liked_by_me ? C.terra : "none"} /> {Number(post.like_count)}
                            </button>
                            <button onClick={() => openComments(post.id)} className="flex items-center gap-1.5 text-xs font-extrabold" style={{ color: C.inkSoft }}>
                              <MessageCircle size={15} /> {Number(post.comment_count)}
                            </button>
                          </div>

                          {expandedPost === post.id && (
                            <div className="mt-3 pt-3 space-y-2" style={{ borderTop: "2px solid #F3EBDA" }}>
                              {(feedComments[post.id] || []).map((c) => {
                                const mineC = c.author_id === session?.user?.id;
                                return (
                                  <div key={c.id} className="text-xs font-semibold flex items-start justify-between gap-2" style={{ color: C.ink }}>
                                    <span><span className="font-extrabold" style={{ color: C.sage }}>{c.author_name}: </span>{c.body}</span>
                                    {(mineC || isAdmin) && (
                                      <button onClick={() => deleteComment(post.id, c.id)} className="shrink-0 text-[11px] font-extrabold px-1" style={{ color: C.inkSoft }}>✕</button>
                                    )}
                                  </div>
                                );
                              })}
                              <div className="flex gap-2 pt-1">
                                <input
                                  value={expandedPost === post.id ? newComment : ""}
                                  onChange={(e) => setNewComment(e.target.value)}
                                  placeholder="What worked? What didn't?"
                                  className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold outline-none border-2"
                                  style={{ borderColor: "#F3EBDA", background: C.cream, color: C.ink }}
                                />
                                <button onClick={() => addComment(post.id)} className="px-3.5 rounded-xl text-xs font-extrabold" style={{ background: C.ink, color: C.cream }}>
                                  Post
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </>
              )}
            </div>
          )}
        </main>

        {/* Admin: visual sponsor manager (owner-only) */}
        {showAdmin && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(46,41,78,.55)" }}>
            <div className="w-full max-w-md rounded-t-[2rem] p-6 pb-8 fade-up max-h-[88vh] overflow-y-auto" style={{ background: C.cream }}>
              <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "#E5DFEF" }} />
              <div className="flex items-center justify-between mb-1">
                <h2 className="mnn-display text-2xl font-bold" style={{ color: C.ink }}>Admin</h2>
                <button onClick={() => { setShowAdmin(false); setSponsorForm(null); }} className="p-1.5 rounded-lg" style={{ background: C.terraSoft, color: C.terra }}>
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs font-semibold mb-4" style={{ color: C.inkSoft }}>
                Flip the community on when you're ready, and manage featured local businesses below.
              </p>

              {/* Community on/off */}
              <div className="rounded-3xl p-4 mb-4 flex items-center justify-between" style={{ background: C.card, boxShadow: "0 2px 12px rgba(46,41,78,.07)" }}>
                <div className="min-w-0 pr-3">
                  <p className="font-extrabold text-sm" style={{ color: C.ink }}>Community feed</p>
                  <p className="text-[11px] font-semibold" style={{ color: C.inkSoft }}>
                    {communityLive ? "Live - members can share, like & comment" : "Showing 'coming soon' to members"}
                  </p>
                </div>
                <button onClick={toggleCommunityLive} className="shrink-0" aria-label="toggle community">
                  <span className="w-11 h-6 rounded-full flex items-center px-0.5 transition-all" style={{ background: communityLive ? C.sage : "#DCD7EA", justifyContent: communityLive ? "flex-end" : "flex-start" }}>
                    <span className="w-5 h-5 rounded-full" style={{ background: "#fff" }} />
                  </span>
                </button>
              </div>
              <p className="text-[11px] font-extrabold mb-2" style={{ color: C.inkSoft }}>FEATURED LISTINGS</p>

              {sponsorForm ? (
                <div className="rounded-3xl p-5 space-y-3" style={{ background: C.card, boxShadow: "0 2px 12px rgba(46,41,78,.07)" }}>
                  <h3 className="font-extrabold text-sm" style={{ color: C.ink }}>{sponsorForm.id ? "Edit listing" : "New listing"}</h3>
                  {[
                    { key: "name", label: "Business name", placeholder: "Tiny Tumblers Gymnastics" },
                    { key: "neighborhood", label: "Neighborhood", placeholder: "Park Slope" },
                    { key: "ages", label: "Ages", placeholder: "walkers–5" },
                    { key: "offer_label", label: "Offer badge (short)", placeholder: "FREE TRIAL" },
                    { key: "link_url", label: "Claim offer link (where the button goes)", placeholder: "https://their-site.com/good-hours" },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="text-[11px] font-extrabold" style={{ color: C.inkSoft }}>{f.label}</label>
                      <input
                        value={sponsorForm[f.key] || ""}
                        onChange={(e) => setSponsorForm({ ...sponsorForm, [f.key]: e.target.value })}
                        placeholder={f.placeholder}
                        className="w-full mt-1 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none border-2"
                        style={{ borderColor: "#F3EBDA", color: C.ink, background: C.cream }}
                      />
                    </div>
                  ))}
                  <div>
                    <label className="text-[11px] font-extrabold" style={{ color: C.inkSoft }}>Pitch (one or two lines)</label>
                    <textarea
                      value={sponsorForm.pitch || ""}
                      onChange={(e) => setSponsorForm({ ...sponsorForm, pitch: e.target.value })}
                      placeholder="Toddler open gym, weekdays 9–12. Free trial for Good Hours members."
                      rows={2}
                      className="w-full mt-1 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none border-2 resize-none"
                      style={{ borderColor: "#F3EBDA", color: C.ink, background: C.cream }}
                    />
                  </div>
                  <button
                    onClick={() => setSponsorForm({ ...sponsorForm, active: !sponsorForm.active })}
                    className="flex items-center gap-2 text-xs font-extrabold"
                    style={{ color: sponsorForm.active ? C.sage : C.inkSoft }}
                  >
                    <span className="w-9 h-5 rounded-full flex items-center px-0.5 transition-all" style={{ background: sponsorForm.active ? C.sage : "#DCD7EA", justifyContent: sponsorForm.active ? "flex-end" : "flex-start" }}>
                      <span className="w-4 h-4 rounded-full" style={{ background: "#fff" }} />
                    </span>
                    {sponsorForm.active ? "Active (visible to members)" : "Hidden"}
                  </button>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setSponsorForm(null)} className="flex-1 rounded-2xl py-3 font-extrabold text-sm border-2" style={{ borderColor: C.ink, color: C.ink }}>
                      Cancel
                    </button>
                    <button
                      onClick={saveSponsor}
                      disabled={!sponsorForm.name?.trim() || adminBusy}
                      className="flex-1 rounded-2xl py-3 font-extrabold text-sm transition-all active:scale-[.98]"
                      style={{ background: sponsorForm.name?.trim() ? C.terra : "#EAE6F2", color: sponsorForm.name?.trim() ? "#fff" : C.inkSoft }}
                    >
                      {adminBusy ? "Saving..." : "Save listing"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={blankSponsor}
                    className="w-full rounded-2xl py-3.5 font-extrabold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98]"
                    style={{ background: C.terra, color: "#fff", boxShadow: "0 6px 20px rgba(255,93,143,.4)" }}
                  >
                    <Plus size={16} /> Add a business
                  </button>
                  <div className="mt-3 space-y-2">
                    {adminSponsors.length === 0 ? (
                      <p className="text-center text-xs font-bold py-6" style={{ color: C.inkSoft }}>No listings yet — add your first one above.</p>
                    ) : (
                      adminSponsors.map((s) => (
                        <div key={s.id} className="rounded-2xl p-4" style={{ background: C.card, boxShadow: "0 2px 12px rgba(46,41,78,.07)" }}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-sm truncate" style={{ color: C.ink }}>{s.name}</h4>
                              <p className="text-[11px] font-bold" style={{ color: C.inkSoft }}>{s.neighborhood || "—"}</p>
                            </div>
                            <Pill tone={s.active ? "sage" : "terra"}>{s.active ? "active" : "hidden"}</Pill>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button onClick={() => toggleSponsorActive(s)} disabled={adminBusy} className="flex-1 rounded-xl py-2 text-[11px] font-extrabold border-2" style={{ borderColor: C.sage, color: C.sage }}>
                              {s.active ? "Hide" : "Show"}
                            </button>
                            <button onClick={() => setSponsorForm({ ...s })} className="flex-1 rounded-xl py-2 text-[11px] font-extrabold border-2" style={{ borderColor: C.ink, color: C.ink }}>
                              Edit
                            </button>
                            <button onClick={() => deleteSponsor(s.id)} disabled={adminBusy} className="flex-1 rounded-xl py-2 text-[11px] font-extrabold" style={{ background: C.terraSoft, color: C.terra }}>
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Bottom nav */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-5 pb-5">
          <div className="flex gap-1 p-1.5 rounded-3xl" style={{ background: C.card, boxShadow: "0 -2px 24px rgba(46,41,78,.14)" }}>
            <TabButton active={tab === "build"} onClick={() => setTab("build")} icon={Sparkles} label="Build" />
            <TabButton active={tab === "plan"} onClick={() => setTab("plan")} icon={Sun} label="Today" />
            <TabButton active={tab === "saved"} onClick={() => (previewMode ? setAuthStep("paywall") : setTab("saved"))} icon={Bookmark} label="Saved" />
            <TabButton active={tab === "community"} onClick={() => (previewMode ? setAuthStep("paywall") : setTab("community"))} icon={Users} label="Community" />
          </div>
        </nav>
      </div>
    </div>
  );
}
