import { useState } from "react";
import { Sun, MapPin, Clock, Heart, Users, Bookmark, Globe, MessageCircle, Sparkles, ChevronRight, Plus, X, Calendar, ThumbsUp, Baby, ShieldCheck, Star, Camera } from "lucide-react";

// ------------------------------------------------------------------
// THE GOOD HOURS — MVP
// Screens: Plan Builder → Generated Plan → My Plans → Community
// Backend notes for Supabase dev are at the bottom of this file.
// NOTE: plan generation now runs server-side via /api/generate-plan
// (Anthropic key protected). Auth + paywall are still the mock versions;
// Supabase Auth (magic link) + Stripe land in the next update.
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

// ---------- Mock community data (seeded; Supabase table later) ----------
const SEED_COMMUNITY = [
  {
    id: "c1",
    author: "Dana · Park Slope",
    verified: true,
    trustedHost: false,
    title: "Rainy Tuesday, 2 kids (4 & 1)",
    blocks: ["9:30 Brooklyn Public Library story time", "11:00 Little Gym open play", "12:30 lunch + nap reset at home"],
    likes: 14,
    comments: [
      { who: "Priya", verified: true, text: "Story time was PACKED, get there 15 min early" },
      { who: "Mel", verified: false, text: "Little Gym has a 2-for-1 sibling deal rn!" },
    ],
    meetup: null,
  },
  {
    id: "c2",
    author: "Jess · Astoria",
    verified: true,
    trustedHost: true,
    title: "Friday park crawl (3yo, high energy)",
    blocks: ["10:00 Astoria Park playground", "11:30 picnic by the pool lawn", "1:00 walk the track till she crashes"],
    likes: 22,
    comments: [{ who: "Sam", verified: true, text: "We did this exact plan — nap achieved by 1:40 😅" }],
    meetup: { when: "Fri 10:00 AM", where: "Astoria Park playground", going: 4 },
  },
  {
    id: "c3",
    author: "Roxane · UWS",
    verified: true,
    trustedHost: true,
    title: "Museum morning that actually worked (5yo)",
    blocks: ["9:45 AMNH right at open — dinosaurs first", "11:15 snack at Margaret Mead Green", "12:00 home for quiet time"],
    likes: 31,
    comments: [
      { who: "Tina", verified: true, text: "Going at open is the whole game. After 11 it's chaos." },
    ],
    meetup: { when: "Sat 9:45 AM", where: "AMNH main entrance", going: 7 },
  },
];

// ---------- Featured listings (local kids' businesses pay for placement) ----------
const SEED_FEATURED = [
  {
    id: "f1",
    name: "Tiny Tumblers Gymnastics",
    neighborhood: "Park Slope",
    pitch: "Toddler open gym, weekdays 9–12. Free trial class for Good Hours members 💕",
    ages: "walkers–5",
    offer: "FREE TRIAL",
  },
];

// ---------- Plan generation (server-side, key protected) ----------
async function generatePlan({ ages, slots, location, planDate }) {
  const res = await fetch("/api/generate-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ages, slots, location, planDate }),
  });
  if (!res.ok) throw new Error("Plan generation failed");
  return await res.json();
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
  const [community, setCommunity] = useState(SEED_COMMUNITY);
  const [expandedPost, setExpandedPost] = useState(null);
  const [newComment, setNewComment] = useState("");
  // --- Trust & safety state ---
  const [isVerified, setIsVerified] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // re-run after verify
  const [meetupRated, setMeetupRated] = useState(false);
  const [ratingTags, setRatingTags] = useState([]);
  // --- Auth + membership state ---
  const [authStep, setAuthStep] = useState("login"); // login | paywall | app
  const [previewMode, setPreviewMode] = useState(false); // free taste: 1 plan, no card
  const [previewUsed, setPreviewUsed] = useState(false);
  const [email, setEmail] = useState("");
  const [billing, setBilling] = useState("year"); // month | year

  // Gate: verified users only for public actions (comment, share, join meetup)
  function requireVerified(actionFn) {
    if (isVerified) { actionFn(); return; }
    setPendingAction(() => actionFn);
    setShowVerify(true);
  }

  function completeVerification() {
    setIsVerified(true);
    setShowVerify(false);
    if (pendingAction) { pendingAction(); setPendingAction(null); }
  }

  const canGenerate = ages.some((a) => a.trim()) && location.trim() && slots.some((s) => s.from && s.to);

  async function handleGenerate() {
    // Preview users get exactly one plan — second attempt returns to paywall
    if (previewMode && previewUsed) { setAuthStep("paywall"); return; }
    setLoading(true);
    setError("");
    try {
      const p = await generatePlan({ ages, slots, location, planDate });
      setPlan({ ...p, id: Date.now(), location, ages: [...ages], planDate, isPublic: false, savedAt: null });
      setTab("plan");
      if (previewMode) setPreviewUsed(true);
    } catch (e) {
      setError("Couldn't generate a plan — try again in a moment.");
    }
    setLoading(false);
  }

  function savePlan(makePublic) {
    if (previewMode) { setAuthStep("paywall"); return; } // saving is a member feature
    if (!plan) return;
    const saved = { ...plan, isPublic: makePublic, savedAt: new Date().toLocaleDateString() };
    setSavedPlans((prev) => [saved, ...prev.filter((p) => p.id !== plan.id)]);
    setPlan(saved);
    if (makePublic) {
      setCommunity((prev) => [
        {
          id: "me-" + saved.id,
          author: "You · " + saved.location,
          verified: true,
          trustedHost: false,
          title: saved.title,
          blocks: saved.blocks.map((b) => `${b.time} ${b.activity}`),
          likes: 0,
          comments: [],
          meetup: null,
          mine: true,
        },
        ...prev,
      ]);
    }
  }

  function toggleLike(id) {
    setCommunity((prev) => prev.map((p) => (p.id === id ? { ...p, likes: p.liked ? p.likes - 1 : p.likes + 1, liked: !p.liked } : p)));
  }

  function addComment(id) {
    if (!newComment.trim()) return;
    setCommunity((prev) =>
      prev.map((p) => (p.id === id ? { ...p, comments: [...p.comments, { who: "You", verified: true, text: newComment }] } : p))
    );
    setNewComment("");
  }

  function joinMeetup(id) {
    setCommunity((prev) =>
      prev.map((p) =>
        p.id === id && p.meetup
          ? { ...p, meetup: { ...p.meetup, going: p.meetup.joined ? p.meetup.going - 1 : p.meetup.going + 1, joined: !p.meetup.joined } }
          : p
      )
    );
  }

  // ---------------- LOGIN SCREEN ----------------
  if (authStep === "login") {
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
              className="w-full rounded-2xl px-5 py-4 text-sm font-bold outline-none border-2 text-center"
              style={{ borderColor: "#F3EBDA", color: C.ink, background: C.card }}
            />
            <button
              disabled={!email.includes("@")}
              onClick={() => setAuthStep("paywall")}
              className="mt-3 w-full rounded-2xl py-4 font-extrabold text-base transition-all active:scale-[.98]"
              style={{
                background: email.includes("@") ? C.terra : "#EAE6F2",
                color: email.includes("@") ? "#fff" : C.inkSoft,
                boxShadow: email.includes("@") ? "0 6px 20px rgba(255,93,143,.4)" : "none",
              }}
            >
              Continue →
            </button>
            <p className="text-[11px] font-bold text-center mt-3" style={{ color: C.inkSoft }}>
              We'll email you a magic link — no password to remember. 🪄
            </p>
          </div>
        </div>
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
            Your membership is what keeps this space safe — it funds selfie verification and moderation. We'd rather charge you $7 than sell your data.
          </p>

          {/* Plan cards */}
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
                2 MONTHS FREE
              </span>
              <p className="text-xs font-extrabold" style={{ color: C.inkSoft }}>YEARLY</p>
              <p className="mnn-display text-2xl font-bold mt-1" style={{ color: C.ink }}>$70<span className="text-sm">/yr</span></p>
              <p className="text-[11px] font-bold mt-1" style={{ color: C.sage }}>≈ $5.83/mo</p>
            </button>
          </div>

          {/* What you get */}
          <div className="mt-5 rounded-3xl p-5 space-y-2.5 fade-up fade-up-3" style={{ background: C.card, boxShadow: "0 2px 12px rgba(46,41,78,.07)" }}>
            {[
              ["✨", "Unlimited AI day plans for your exact kids, hours & neighborhood"],
              ["🏡", "Your neighborhood's community — parents, nannies & grandparents alike"],
              ["🛡️", "Selfie-verified members only at every meetup"],
              ["📌", "Save & reuse the days that actually worked"],
            ].map(([emoji, line]) => (
              <div key={line} className="flex items-start gap-2.5">
                <span className="text-base">{emoji}</span>
                <p className="text-xs font-bold leading-relaxed" style={{ color: C.ink }}>{line}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => { setPreviewMode(false); setAuthStep("app"); }}
            className="mt-6 w-full rounded-2xl py-4 font-extrabold text-base transition-all active:scale-[.98] fade-up fade-up-4"
            style={{ background: C.terra, color: "#fff", boxShadow: "0 6px 20px rgba(255,93,143,.4)" }}
          >
            Start my membership · {billing === "year" ? "$70/yr" : "$7/mo"}
          </button>
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
          <p className="text-[10px] font-bold text-center mt-3" style={{ color: C.inkSoft }}>
            Secure checkout via Stripe · cancel in two taps, no email required
          </p>
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
            <div>
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
                        className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold outline-none border-2"
                        style={{ borderColor: "#F3EBDA", color: C.ink, background: C.cream }}
                      />
                      <span className="text-xs font-bold" style={{ color: C.inkSoft }}>to</span>
                      <input
                        value={s.to}
                        onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))}
                        placeholder="12:00 PM"
                        className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold outline-none border-2"
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

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => savePlan(false)} className="flex-1 rounded-2xl py-3.5 font-extrabold text-sm flex items-center justify-center gap-2 border-2 transition-all active:scale-[.98]" style={{ borderColor: C.ink, color: C.ink }}>
                      <Bookmark size={16} /> {plan.savedAt && !plan.isPublic ? "Saved ✓" : "Save private"}
                    </button>
                    <button onClick={() => requireVerified(() => savePlan(true))} className="flex-1 rounded-2xl py-3.5 font-extrabold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98]" style={{ background: C.sage, color: "#fff" }}>
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
              {/* Trust strip */}
              <div className="fade-up rounded-2xl px-4 py-3 flex items-center gap-2.5" style={{ background: C.sageSoft }}>
                <ShieldCheck size={18} style={{ color: "#0E9488" }} className="shrink-0" />
                <p className="text-[11px] font-bold leading-snug" style={{ color: "#0E7C72" }}>
                  Every member who posts, comments, or joins a meetup is selfie-verified. Meetups happen in public places only.
                </p>
              </div>

              {/* Post-meetup rating prompt */}
              {!meetupRated ? (
                <div className="fade-up fade-up-1 rounded-3xl p-5" style={{ background: C.ink }}>
                  <div className="flex items-center gap-2">
                    <Star size={16} fill={C.gold} style={{ color: C.gold }} />
                    <p className="text-xs font-extrabold" style={{ color: C.gold }}>YOU WENT · Astoria Park crawl</p>
                  </div>
                  <h3 className="mnn-display text-lg font-bold mt-1" style={{ color: C.cream }}>How was Jess's meetup?</h3>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {["Great group 💕", "Kids loved it", "Easy to find", "Would go again", "Not for us"].map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setRatingTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]))}
                        className="px-3 py-1.5 rounded-full text-xs font-extrabold transition-all active:scale-95"
                        style={{
                          background: ratingTags.includes(tag) ? C.terra : "rgba(255,255,255,.12)",
                          color: ratingTags.includes(tag) ? "#fff" : "#B8B3D1",
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setMeetupRated(true)}
                    disabled={ratingTags.length === 0}
                    className="mt-3 w-full rounded-xl py-2.5 text-xs font-extrabold transition-all active:scale-[.98]"
                    style={{
                      background: ratingTags.length ? C.gold : "rgba(255,255,255,.1)",
                      color: ratingTags.length ? C.ink : "#6B6590",
                    }}
                  >
                    Submit rating
                  </button>
                </div>
              ) : (
                <div className="fade-up fade-up-1 rounded-2xl px-4 py-3 flex items-center gap-2" style={{ background: C.goldSoft }}>
                  <ThumbsUp size={15} style={{ color: "#C77800" }} />
                  <p className="text-[11px] font-extrabold" style={{ color: "#9A5B00" }}>
                    Thanks! Your rating counts toward Jess's Trusted Host badge.
                  </p>
                </div>
              )}

              <p className="text-xs font-bold px-1" style={{ color: C.inkSoft }}>
                Real plans from real parents & caregivers near you. See what worked, steal a day, or join a meetup.
              </p>

              {/* Featured listing — paid placement by neighborhood */}
              {SEED_FEATURED.map((biz) => (
                <div
                  key={biz.id}
                  className="fade-up fade-up-2 rounded-3xl p-5 relative overflow-hidden"
                  style={{ background: C.card, border: `3px solid ${C.gold}`, boxShadow: "0 2px 12px rgba(46,41,78,.07)" }}
                >
                  <div className="flex items-center justify-between">
                    <Pill tone="gold">📌 FEATURED · {biz.neighborhood}</Pill>
                    <span className="text-[10px] font-extrabold px-2 py-1 rounded-full" style={{ background: C.terraSoft, color: C.terra }}>
                      {biz.offer}
                    </span>
                  </div>
                  <h3 className="font-extrabold mt-2" style={{ color: C.ink }}>{biz.name}</h3>
                  <p className="text-xs font-semibold mt-1 leading-relaxed" style={{ color: C.inkSoft }}>{biz.pitch}</p>
                  <div className="flex items-center justify-between mt-3">
                    <Pill tone="sage">ages {biz.ages}</Pill>
                    <button className="px-4 py-2 rounded-xl text-xs font-extrabold transition-all active:scale-95" style={{ background: C.gold, color: C.ink }}>
                      Claim offer →
                    </button>
                  </div>
                </div>
              ))}
              <p className="text-[10px] font-bold text-center" style={{ color: C.inkSoft }}>
                Own a kids' business? <span style={{ color: C.terra }}>Get featured in your neighborhood →</span>
              </p>
              {community.map((post, i) => (
                <div key={post.id} className={`fade-up fade-up-${Math.min(i + 1, 4)} rounded-3xl p-5`} style={{ background: post.mine ? C.sageSoft : C.card, boxShadow: "0 2px 12px rgba(46,41,78,.07)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold flex items-center gap-1.5 flex-wrap" style={{ color: C.sage }}>
                      {post.author}
                      {post.verified && <VerifiedBadge />}
                      {post.trustedHost && <HostBadge />}
                    </span>
                    {post.mine && <Pill tone="sage">yours</Pill>}
                  </div>
                  <h3 className="font-extrabold mt-1" style={{ color: C.ink }}>{post.title}</h3>
                  <ul className="mt-2 space-y-1">
                    {post.blocks.map((b, j) => (
                      <li key={j} className="text-xs font-semibold flex gap-1.5" style={{ color: C.inkSoft }}>
                        <span style={{ color: C.terra }}>•</span> {b}
                      </li>
                    ))}
                  </ul>

                  {post.meetup && (
                    <div className="mt-3 rounded-2xl p-3 flex items-center justify-between" style={{ background: C.goldSoft }}>
                      <div>
                        <p className="text-xs font-extrabold flex items-center gap-1" style={{ color: "#9A5B00" }}>
                          <Calendar size={12} /> Meetup · {post.meetup.when}
                        </p>
                        <p className="text-[11px] font-bold mt-0.5" style={{ color: "#C77800" }}>
                          {post.meetup.where} · {post.meetup.going} going · public place ✓
                        </p>
                      </div>
                      <button
                        onClick={() => requireVerified(() => joinMeetup(post.id))}
                        className="px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all active:scale-95"
                        style={{
                          background: post.meetup.joined ? "#9A5B00" : "#fff",
                          color: post.meetup.joined ? "#fff" : "#9A5B00",
                        }}
                      >
                        {post.meetup.joined ? "Going ✓" : "Join"}
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-4 mt-3">
                    <button onClick={() => toggleLike(post.id)} className="flex items-center gap-1.5 text-xs font-extrabold transition-all active:scale-95" style={{ color: post.liked ? C.terra : C.inkSoft }}>
                      <Heart size={15} fill={post.liked ? C.terra : "none"} /> {post.likes}
                    </button>
                    <button onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)} className="flex items-center gap-1.5 text-xs font-extrabold" style={{ color: C.inkSoft }}>
                      <MessageCircle size={15} /> {post.comments.length}
                    </button>
                  </div>

                  {expandedPost === post.id && (
                    <div className="mt-3 pt-3 space-y-2" style={{ borderTop: "2px solid #F3EBDA" }}>
                      {post.comments.map((c, j) => (
                        <div key={j} className="text-xs font-semibold" style={{ color: C.ink }}>
                          <span className="font-extrabold" style={{ color: C.sage }}>{c.who}</span>
                          {c.verified && <span className="mx-1 align-middle"><VerifiedBadge small /></span>}
                          <span className="font-extrabold" style={{ color: C.sage }}>: </span>
                          {c.text}
                        </div>
                      ))}
                      <div className="flex gap-2 pt-1">
                        <input
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="What worked? What didn't?"
                          className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold outline-none border-2"
                          style={{ borderColor: "#F3EBDA", background: C.cream, color: C.ink }}
                        />
                        <button onClick={() => requireVerified(() => addComment(post.id))} className="px-3.5 rounded-xl text-xs font-extrabold" style={{ background: C.ink, color: C.cream }}>
                          Post
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Verification sheet */}
        {showVerify && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(46,41,78,.55)" }}>
            <div className="w-full max-w-md rounded-t-[2rem] p-6 pb-8 fade-up" style={{ background: C.card }}>
              <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "#E5DFEF" }} />
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center" style={{ background: C.sageSoft }}>
                <ShieldCheck size={30} style={{ color: "#0E9488" }} />
              </div>
              <h2 className="mnn-display text-2xl font-bold text-center mt-4" style={{ color: C.ink }}>
                Real grown-ups only 💛
              </h2>
              <p className="text-sm font-semibold text-center mt-2 leading-relaxed" style={{ color: C.inkSoft }}>
                To comment, share plans, or join meetups, take a quick selfie so we can confirm you're a real person. Parents, nannies, grandparents — everyone welcome, everyone verified. It keeps every playground meetup safe.
              </p>
              <ul className="mt-4 space-y-2">
                {["Your selfie is never shown publicly", "Verified members get the badge on every post", "Browsing never requires verification"].map((line) => (
                  <li key={line} className="flex items-start gap-2 text-xs font-bold" style={{ color: C.ink }}>
                    <span style={{ color: C.sage }}>✓</span> {line}
                  </li>
                ))}
              </ul>
              <button
                onClick={completeVerification}
                className="mt-5 w-full rounded-2xl py-4 font-extrabold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98]"
                style={{ background: C.terra, color: "#fff", boxShadow: "0 6px 20px rgba(255,93,143,.4)" }}
              >
                <Camera size={17} /> Take my selfie (demo: instant ✓)
              </button>
              <button onClick={() => { setShowVerify(false); setPendingAction(null); }} className="mt-2 w-full py-2.5 text-xs font-extrabold" style={{ color: C.inkSoft }}>
                Maybe later
              </button>
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
