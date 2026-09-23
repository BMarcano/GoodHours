// Plan-shape helpers shared by the plan endpoints: nap windows and
// after-school mode. Underscore-prefixed so Vercel treats this as a shared
// module, not an endpoint.

const TIME_RE = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i;

// "3:00 PM" → 15, "15:30" → 15.5, "9 am" → 9. Free text with no AM/PM marker
// below 7 is read as afternoon ("3:00" is a 3 PM slot, nobody plans 3 AM).
export function parseHour(text) {
  const m = TIME_RE.exec(String(text || "").trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (!Number.isFinite(h) || h > 24 || min > 59) return null;
  const ap = (m[3] || "").toLowerCase().replace(/\./g, "");
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (!ap && h < 7) h += 12;
  return h + min / 60;
}

// After-school shape: the day starts mid-afternoon and wraps by dinner.
export function isAfterSchool(slots) {
  const ranges = (Array.isArray(slots) ? slots : [])
    .map((s) => [parseHour(s?.from), parseHour(s?.to)])
    .filter(([a, b]) => a !== null && b !== null && b > a);
  if (!ranges.length) return false;
  const start = Math.min(...ranges.map((r) => r[0]));
  const end = Math.max(...ranges.map((r) => r[1]));
  return start >= 14 && start <= 16.5 && end <= 19.5;
}

export function afterSchoolInstructions() {
  return `AFTER-SCHOOL MODE — these hours come right after a school day, so plan them as a wind-down, not a fresh morning:
- Open with decompression: a snack and free movement (playground, open field, a run around) before anything structured.
- Then at most ONE anchor activity (library, a drop-in class, a park with a feature), close to home — no long transit.
- Finish with an easy transition home before dinner: low stimulation, homework-friendly. Anything that needs early-day energy (a big museum, a far trip) does not belong here.
- Younger siblings tagging along still need a stroller-friendly route and one quiet moment.`;
}

export function napWindowInstructions(napWindow) {
  const nap = String(napWindow || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!nap) return "";
  return `NAP WINDOW: this family's kids nap ${nap}. Schedule NOTHING during it. If a requested slot overlaps the nap, plan a calm wind-down right before, keep that stretch stroller-nap or at-home friendly, and pick back up after. Mention the nap in that block's "why" so the caregiver can see it was respected.`;
}
