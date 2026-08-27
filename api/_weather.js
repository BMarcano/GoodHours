// Weather helpers shared by the plan endpoint. Open-Meteo needs no key for its
// public API; production customers can set OPEN_METEO_API_KEY to use the
// customer endpoints without changing application code.

const DAILY_FIELDS = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "apparent_temperature_max",
  "apparent_temperature_min",
  "precipitation_probability_max",
  "precipitation_sum",
  "snowfall_sum",
].join(",");

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const FREEZING_CODES = new Set([56, 57, 66, 67]);
const HEAVY_RAIN_CODES = new Set([55, 57, 65, 67, 82]);

function finiteNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value) {
  return Math.round(finiteNumber(value));
}

export function weatherDescription(code) {
  const c = Number(code);
  if (c === 0) return "Clear";
  if (c === 1) return "Mostly clear";
  if (c === 2) return "Partly cloudy";
  if (c === 3) return "Overcast";
  if (c === 45 || c === 48) return "Foggy";
  if ([51, 53, 55].includes(c)) return "Drizzle";
  if ([56, 57].includes(c)) return "Freezing drizzle";
  if ([61, 63, 65].includes(c)) return "Rain";
  if ([66, 67].includes(c)) return "Freezing rain";
  if ([71, 73, 75, 77].includes(c)) return "Snow";
  if ([80, 81, 82].includes(c)) return "Rain showers";
  if ([85, 86].includes(c)) return "Snow showers";
  if ([95, 96, 99].includes(c)) return "Thunderstorms";
  return "Changeable weather";
}

// A deterministic safety layer. The AI receives the result, not the raw daily
// data, so "indoor" never depends on the model interpreting a WMO code.
export function classifyWeather(input) {
  const code = Number(input.weatherCode);
  const precipitationProbability = round(input.precipitationProbability);
  const precipitation = finiteNumber(input.precipitation);
  const snowfall = finiteNumber(input.snowfall);
  const apparentMax = finiteNumber(input.apparentMax, finiteNumber(input.temperatureMax));

  const snow = SNOW_CODES.has(code) || snowfall > 0.02;
  const thunder = code >= 95;
  const freezing = FREEZING_CODES.has(code);
  const rain = RAIN_CODES.has(code) && (precipitationProbability >= 45 || precipitation >= 0.05);
  const heavyRain = HEAVY_RAIN_CODES.has(code) || precipitation >= 0.3;
  const tooCold = apparentMax <= 42;
  const tooHot = apparentMax >= 92;

  let mode = "outdoor";
  let icon = code <= 1 ? "sun" : "cloud";
  let reason = "The forecast looks comfortable enough to keep outdoor options in the mix.";

  if (snow) {
    mode = "indoor";
    icon = "snow";
    reason = "Snow is in the forecast, so the itinerary stays indoors and keeps exposed transfers short.";
  } else if (thunder || freezing) {
    mode = "indoor";
    icon = "storm";
    reason = "Stormy or icy conditions are possible, so the itinerary uses indoor venues only.";
  } else if (rain || heavyRain) {
    mode = "indoor";
    icon = "rain";
    reason = "Rain is likely enough that the itinerary switches to indoor venues and easy drop-offs.";
  } else if (tooCold) {
    mode = "indoor";
    icon = "cold";
    reason = "It will feel too cold for a long kid outing, so the itinerary is built around warm indoor stops.";
  } else if (tooHot) {
    mode = "indoor";
    icon = "hot";
    reason = "The heat could be tough on young kids, so the itinerary prioritizes air-conditioned stops.";
  } else if (
    precipitationProbability >= 35 ||
    RAIN_CODES.has(code) ||
    [45, 48].includes(code) ||
    apparentMax <= 50 ||
    apparentMax >= 85
  ) {
    mode = "flexible";
    icon = RAIN_CODES.has(code) || precipitationProbability >= 35 ? "rain" : apparentMax <= 50 ? "cold" : "cloud";
    reason = "The forecast is borderline, so the itinerary favors indoor anchors with a short outdoor option if it feels good.";
  }

  return { mode, icon, reason };
}

export function locationQueries(location) {
  const raw = String(location || "").trim();
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  const candidates = [raw];
  if (parts.length >= 3) candidates.push(`${parts.at(-2)}, ${parts.at(-1)}`);
  // If a neighborhood + city pair fails as a qualified query, the city is a
  // safer forecast fallback than a same-named neighborhood in another state.
  if (parts.length === 2) candidates.push(parts[1], parts[0]);
  if (parts.length >= 3) candidates.push(parts[0], parts[1]);
  return [...new Set(candidates.filter((value) => value.length >= 2))].slice(0, 4);
}

async function fetchJson(url, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function apiUrl(kind, path, params) {
  const apiKey = process.env.OPEN_METEO_API_KEY;
  const host = kind === "geocoding"
    ? apiKey ? "customer-geocoding-api.open-meteo.com" : "geocoding-api.open-meteo.com"
    : apiKey ? "customer-api.open-meteo.com" : "api.open-meteo.com";
  const query = new URLSearchParams(params);
  if (apiKey) query.set("apikey", apiKey);
  return `https://${host}${path}?${query}`;
}

async function geocode(location) {
  for (const name of locationQueries(location)) {
    const url = apiUrl("geocoding", "/v1/search", { name, count: "5", language: "en", format: "json" });
    const data = await fetchJson(url);
    const result = data.results?.[0];
    if (result && Number.isFinite(result.latitude) && Number.isFinite(result.longitude)) return result;
  }
  return null;
}

function unavailable(reason) {
  return {
    available: false,
    mode: "unknown",
    reason,
    source: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/",
  };
}

export async function getWeatherForPlan({ location, planDate }) {
  try {
    const place = await geocode(location);
    if (!place) return unavailable("We couldn't match that neighborhood to a forecast location, so this plan includes weather-proof backups.");

    const forecastUrl = apiUrl("forecast", "/v1/forecast", {
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      daily: DAILY_FIELDS,
      temperature_unit: "fahrenheit",
      precipitation_unit: "inch",
      timezone: "auto",
      forecast_days: "16",
    });
    const data = await fetchJson(forecastUrl);
    const index = data.daily?.time?.indexOf(planDate) ?? -1;
    if (index < 0) {
      return unavailable("A reliable forecast isn't available this far out yet, so the plan includes weather-proof backups.");
    }

    const daily = data.daily;
    const weatherCode = finiteNumber(daily.weather_code?.[index]);
    const temperatureMax = round(daily.temperature_2m_max?.[index]);
    const temperatureMin = round(daily.temperature_2m_min?.[index]);
    const apparentMax = round(daily.apparent_temperature_max?.[index]);
    const apparentMin = round(daily.apparent_temperature_min?.[index]);
    const precipitationProbability = round(daily.precipitation_probability_max?.[index]);
    const precipitation = finiteNumber(daily.precipitation_sum?.[index]);
    const snowfall = finiteNumber(daily.snowfall_sum?.[index]);
    const classification = classifyWeather({
      weatherCode,
      temperatureMax,
      apparentMax,
      precipitationProbability,
      precipitation,
      snowfall,
    });
    const resolvedLocation = [place.name, place.admin1, place.country_code]
      .filter((value, position, values) => value && values.indexOf(value) === position)
      .join(", ");

    return {
      available: true,
      date: planDate,
      resolvedLocation,
      timezone: data.timezone || place.timezone,
      condition: weatherDescription(weatherCode),
      weatherCode,
      temperatureMax,
      temperatureMin,
      apparentMax,
      apparentMin,
      precipitationProbability,
      precipitation: Math.round(precipitation * 100) / 100,
      snowfall: Math.round(snowfall * 100) / 100,
      temperatureUnit: "°F",
      precipitationUnit: data.daily_units?.precipitation_sum || "inch",
      ...classification,
      source: "Open-Meteo",
      sourceUrl: "https://open-meteo.com/",
    };
  } catch (error) {
    console.error("weather lookup failed:", error?.message || error);
    return unavailable("The forecast service didn't answer, so the plan includes weather-proof backups instead.");
  }
}

export function weatherPlanningInstructions(weather) {
  if (!weather?.available) {
    return `WEATHER: No reliable forecast is available for this date/location. Do not claim to know the weather. Make each block resilient by favoring venues with a nearby indoor fallback, and mention one concise weather-proof backup in the plan's proTip.`;
  }

  const facts = `${weather.condition}; ${weather.temperatureMin}–${weather.temperatureMax}°F; feels like ${weather.apparentMin}–${weather.apparentMax}°F; precipitation probability ${weather.precipitationProbability}%.`;
  if (weather.mode === "indoor") {
    return `WEATHER: ${facts}\nWEATHER MODE — INDOOR REQUIRED: Build an indoor itinerary. Every primary activity must be inside (library, children's museum, indoor play space, aquarium, conservatory, bookstore story time, recreation center, or another genuinely indoor venue). Minimize walking and exposed transfers. Do not recommend parks, playgrounds, markets, splash pads, outdoor festivals, or "if the rain stops" as primary activities. Make the title or summary clearly signal that this is a cozy indoor/weather-safe day.`;
  }
  if (weather.mode === "flexible") {
    return `WEATHER: ${facts}\nWEATHER MODE — FLEXIBLE: Use indoor venues as the anchors. At most one short outdoor activity may appear, and only with an immediate indoor fallback stated in the same block. Keep transfers easy.`;
  }
  return `WEATHER: ${facts}\nWEATHER MODE — OUTDOOR FRIENDLY: Outdoor activities are welcome, but keep one practical indoor backup in the proTip because forecasts can change.`;
}
