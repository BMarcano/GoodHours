import test from "node:test";
import assert from "node:assert/strict";
import { localDateStr, localDayOffset, upcomingPlanDate, millisecondsUntilNextDay } from "../src/calendar.js";

test("an overnight form advances to today while a future selection stays selected", () => {
  const openedAt = new Date(2026, 8, 30, 23, 50);
  const resumedAt = new Date(2026, 9, 1, 8, 30);
  assert.equal(upcomingPlanDate(localDateStr(openedAt), resumedAt), "2026-10-01");
  assert.equal(upcomingPlanDate("2026-10-04", resumedAt), "2026-10-04");
  assert.equal(upcomingPlanDate("2026-10-01", resumedAt), "2026-10-01");
  for (const invalid of [null, undefined, "", "10/04/2026", "2026-02-30", "2026-99-01"]) {
    assert.equal(upcomingPlanDate(invalid, resumedAt), "2026-10-01");
  }
});

test("tomorrow, yesterday and midnight follow calendar days across daylight saving changes", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    const fallBack = new Date(2026, 10, 1, 0, 30);
    assert.equal(localDayOffset(1, fallBack), "2026-11-02");
    assert.equal(millisecondsUntilNextDay(fallBack), 24.5 * 60 * 60 * 1000);
    const springForward = new Date(2026, 2, 8, 0, 30);
    assert.equal(localDayOffset(1, springForward), "2026-03-09");
    assert.equal(millisecondsUntilNextDay(springForward), 22.5 * 60 * 60 * 1000);
    assert.equal(localDayOffset(-1, new Date(2026, 2, 9, 0, 30)), "2026-03-08");
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});
