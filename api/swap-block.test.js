import test from "node:test";
import assert from "node:assert/strict";
import handler, { buildSwapPrompt } from "./swap-block.js";

const plan = {
  location: "Park Slope, Brooklyn",
  ages: ["3", "5"],
  planDate: "2026-09-26",
  blocks: [
    { time: "9:00–10:30", activity: "Playground", venue: "Harmony Playground", cost: "Free" },
    { time: "10:30–12:00", activity: "Story time", venue: "Park Slope Library", cost: "Free" },
  ],
};

test("the swap prompt pins the time, names the problem and lists the other stops to avoid", () => {
  const text = buildSwapPrompt({ plan, blockIndex: 1, reason: "packed", dayLabel: "Saturday, September 26, 2026", weekday: "Saturday", weatherInstructions: "" });
  assert.match(text, /"time" is exactly "10:30–12:00"/);
  assert.match(text, /too packed/);
  assert.match(text, /Harmony Playground/);
  assert.match(text, /open on Saturday/);
  assert.match(text, /aged 3, 5/);
});

function fakeRes() {
  const out = { statusCode: null, body: null };
  return { out, status(c) { out.statusCode = c; return this; }, json(p) { out.body = p; return this; } };
}

test("handler rejects non-POST and anonymous calls before touching any provider", async () => {
  const get = fakeRes();
  await handler({ method: "GET", headers: {}, body: {} }, get);
  assert.equal(get.out.statusCode, 405);
  const anon = fakeRes();
  await handler({ method: "POST", headers: {}, body: { plan, blockIndex: 0 } }, anon);
  assert.equal(anon.out.statusCode, 401);
});
