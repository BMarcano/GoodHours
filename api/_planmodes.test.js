import test from "node:test";
import assert from "node:assert/strict";
import { parseHour, isAfterSchool, napWindowInstructions, afterSchoolInstructions } from "./_planmodes.js";

test("parseHour reads the ways parents type times", () => {
  assert.equal(parseHour("3:00 PM"), 15);
  assert.equal(parseHour("15:30"), 15.5);
  assert.equal(parseHour("9 am"), 9);
  assert.equal(parseHour("12:00 PM"), 12);
  assert.equal(parseHour("12 AM"), 0);
  assert.equal(parseHour("3:00"), 15); // bare afternoon hour
  assert.equal(parseHour("9:00"), 9);
  assert.equal(parseHour("whenever"), null);
});

test("after-school mode is the 3–6 PM shape, not a morning or a full day", () => {
  assert.equal(isAfterSchool([{ from: "3:00 PM", to: "6:00 PM" }]), true);
  assert.equal(isAfterSchool([{ from: "2:30 PM", to: "5:00 PM" }]), true);
  assert.equal(isAfterSchool([{ from: "9:00 AM", to: "12:00 PM" }]), false);
  assert.equal(isAfterSchool([{ from: "1:00 PM", to: "4:00 PM" }]), false);
  assert.equal(isAfterSchool([{ from: "3:00 PM", to: "9:00 PM" }]), false);
  assert.equal(isAfterSchool([]), false);
  assert.match(afterSchoolInstructions(), /AFTER-SCHOOL MODE/);
});

test("nap window instructions only appear when a window is set", () => {
  assert.equal(napWindowInstructions(""), "");
  assert.equal(napWindowInstructions(null), "");
  assert.match(napWindowInstructions("  12:30–2:30   PM "), /nap 12:30–2:30 PM\./);
});
