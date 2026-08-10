// Calendar-date helpers shared by the plan and events endpoints.
// Underscore-prefixed so Vercel treats this as a shared module, not an endpoint.
//
// planDate is a bare calendar date ("2026-07-18") the user picked in their own
// timezone — it is not an instant in time. Everything here pins to UTC so the
// weekday we hand the model can never drift a day off whatever timezone the
// serverless function happens to boot in.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function pad(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function monthNumber(word) {
  const w = String(word).toLowerCase();
  if (w.length < 3) return null;
  const i = MONTHS.findIndex((m) => m === w || m.startsWith(w));
  return i === -1 ? null : i + 1;
}

// A UTC-midnight Date for a YYYY-MM-DD string, or null if it isn't a real date.
function utcDate(isoDate) {
  const m = ISO_DATE.exec(String(isoDate || "").trim());
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  // catches impossible dates (2026-02-31 would roll forward into March)
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function isValidPlanDate(isoDate) {
  return utcDate(isoDate) !== null;
}

// "Saturday, July 18, 2026" — what the model gets told the plan is for.
export function dayLabel(isoDate) {
  const dt = utcDate(isoDate);
  if (!dt) return "";
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// "Saturday"
export function weekdayName(isoDate) {
  const dt = utcDate(isoDate);
  if (!dt) return "";
  return dt.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

// Best-effort YYYY-MM-DD out of whatever the model wrote in its "date" field.
// Returns null when there's nothing date-shaped in there — callers treat that
// as "unverifiable", which means the event gets dropped.
export function normalizeDate(value, fallbackYear) {
  if (!value) return null;
  const s = String(value).trim();

  const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return pad(+iso[1], +iso[2], +iso[3]);

  // "July 18, 2026" / "Sat, Jul 18" / "Jul 18". The \b around the day keeps it
  // from biting the first two digits of a bare year ("July 2026" -> the 20th).
  for (const m of s.matchAll(/([A-Za-z]{3,9})\.?,?\s+\b(\d{1,2})\b(?:\s*,?\s*(\d{4}))?/g)) {
    const mon = monthNumber(m[1]);
    if (mon) return pad(+(m[3] || fallbackYear), mon, +m[2]);
  }
  // "18 July 2026"
  for (const m of s.matchAll(/\b(\d{1,2})\b\s+([A-Za-z]{3,9})\.?,?\s*(\d{4})?/g)) {
    const mon = monthNumber(m[2]);
    if (mon) return pad(+(m[3] || fallbackYear), mon, +m[1]);
  }
  // "7/18/2026" or "7/18/26" — US order; the app is US-only today
  const slash = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slash) {
    const y = +slash[3] < 100 ? 2000 + +slash[3] : +slash[3];
    return pad(y, +slash[1], +slash[2]);
  }
  return null;
}

const WEEKDAYS = [
  "sunday", "monday", "tuesday", "wednesday",
  "thursday", "friday", "saturday",
];

// True when the text names a weekday that isn't the plan's own. Backstop for
// the model filling in a correct-looking "date" on an event whose title gives
// the real day away ("Sunday Funday Market" on a Saturday plan).
export function namesAnotherWeekday(text, planWeekday) {
  const t = String(text || "").toLowerCase();
  const mine = String(planWeekday).toLowerCase();
  if (t.includes(mine)) return false; // mentions our day too — not a wrong-day signal
  return WEEKDAYS.some((d) => d !== mine && new RegExp(`\\b${d}\\b`).test(t));
}
