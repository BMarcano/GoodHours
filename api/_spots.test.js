import test from "node:test";
import assert from "node:assert/strict";
import { normalizeExtraction, spotsForPlan, spotsPromptSection, attachSavedSpots, MAX_SPOTS_IN_PROMPT } from "./_spots.js";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

test("a thin extraction still yields an editable low-confidence row", () => {
  const row = normalizeExtraction({ name: null, confidence: "high" }, { name: "", sourceUrl: "instagram.com/p/abc" });
  assert.equal(row.name, "Saved spot");
  assert.equal(row.confidence, "low");
  assert.equal(row.source_url, "https://instagram.com/p/abc");
});

test("a clear extraction keeps the model's confidence and normalizes the date", () => {
  const row = normalizeExtraction({
    name: "  Brooklyn Children's   Museum ",
    description: "Hands-on exhibits, great under-5 zone",
    address: "145 Brooklyn Ave, Brooklyn, NY",
    eventName: "Toddler Time",
    eventDate: "Sat, Oct 3",
    eventTime: "10 AM",
    price: "Free w/ admission",
    confidence: "high",
  });
  assert.equal(row.name, "Brooklyn Children's Museum");
  assert.equal(row.confidence, "high");
  assert.match(row.event_date, /^\d{4}-10-03$/);
  assert.equal(row.event_time, "10 AM");
});

test("junk placeholders and bad urls become null instead of shipping", () => {
  const row = normalizeExtraction({ name: "Prospect Park", address: "N/A", price: "unknown", sourceUrl: "not a url", confidence: "low" });
  assert.equal(row.address, null);
  assert.equal(row.price, null);
  assert.equal(row.source_url, null);
});

test("dated saves only qualify on their own day; evergreen saves always do", () => {
  const spots = [
    { id: A, name: "Park", event_date: null },
    { id: B, name: "Fair", event_date: "2026-09-26" },
    { id: "x", name: "Old pop-up", event_date: "2026-09-19" },
  ];
  assert.deepEqual(spotsForPlan(spots, "2026-09-22").map((s) => s.id), [A]);
  assert.deepEqual(spotsForPlan(spots, "2026-09-26").map((s) => s.id), [A, B]);
});

test("the prompt is capped and empty when there is nothing saved", () => {
  assert.equal(spotsPromptSection([], { location: "Park Slope", weekday: "Tuesday" }), "");
  const many = Array.from({ length: MAX_SPOTS_IN_PROMPT + 5 }, (_, i) => ({ id: `id-${i}`, name: `Spot ${i}` }));
  assert.equal(spotsForPlan(many, "2026-09-22").length, MAX_SPOTS_IN_PROMPT);
  const text = spotsPromptSection([{ id: A, name: "Little Gym", address: "5th Ave" }], { location: "Park Slope", weekday: "Tuesday" });
  assert.match(text, new RegExp(A));
  assert.match(text, /Little Gym/);
  assert.match(text, /Tuesday/);
});

test("only ids we handed the model earn the badge", () => {
  const plan = {
    title: "t",
    blocks: [
      { time: "9–10", activity: "Swings", venue: "Park", savedSpotId: A },
      { time: "10–11", activity: "Snack", venue: "Cafe", savedSpotId: "made-up" },
      { time: "11–12", activity: "Story time", venue: "Library", yourSave: true },
    ],
  };
  const out = attachSavedSpots(plan, [{ id: A, name: "Park" }]);
  assert.equal(out.blocks[0].yourSave, true);
  assert.equal(out.blocks[0].savedSpotName, "Park");
  assert.equal("savedSpotId" in out.blocks[1], false);
  assert.equal("yourSave" in out.blocks[1], false);
  assert.equal("yourSave" in out.blocks[2], false);
  assert.equal(out.title, "t");
});
