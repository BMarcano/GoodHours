import test from "node:test";
import assert from "node:assert/strict";
import { classifyWeather, locationQueries, weatherDescription } from "./_weather.js";

test("snow always produces an indoor plan", () => {
  const result = classifyWeather({ weatherCode: 71, apparentMax: 48, precipitationProbability: 40, snowfall: 0.1 });
  assert.equal(result.mode, "indoor");
  assert.equal(result.icon, "snow");
});

test("likely rain produces an indoor plan", () => {
  const result = classifyWeather({ weatherCode: 61, apparentMax: 65, precipitationProbability: 70, precipitation: 0.2 });
  assert.equal(result.mode, "indoor");
  assert.equal(result.icon, "rain");
});

test("cold apparent temperature produces an indoor plan", () => {
  const result = classifyWeather({ weatherCode: 2, apparentMax: 39, precipitationProbability: 5 });
  assert.equal(result.mode, "indoor");
  assert.equal(result.icon, "cold");
});

test("borderline precipitation produces a flexible plan", () => {
  const result = classifyWeather({ weatherCode: 2, apparentMax: 64, precipitationProbability: 38 });
  assert.equal(result.mode, "flexible");
});

test("a mild clear day stays outdoor friendly", () => {
  const result = classifyWeather({ weatherCode: 0, apparentMax: 70, precipitationProbability: 10 });
  assert.equal(result.mode, "outdoor");
  assert.equal(weatherDescription(0), "Clear");
});

test("neighborhood input falls back to a geocodable city/state pair", () => {
  assert.deepEqual(locationQueries("Park Slope, Brooklyn, NY"), [
    "Park Slope, Brooklyn, NY",
    "Brooklyn, NY",
    "Park Slope",
    "Brooklyn",
  ]);
  assert.deepEqual(locationQueries("Park Slope, Brooklyn"), [
    "Park Slope, Brooklyn",
    "Brooklyn",
    "Park Slope",
  ]);
});
