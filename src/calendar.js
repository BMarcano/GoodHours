// Calendar days follow the browser's local timezone, including DST changes.
export function localDateStr(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function localDayOffset(days, now = new Date()) {
  return localDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 12));
}

export function upcomingPlanDate(date, now = new Date()) {
  const today = localDateStr(now);
  // Only compare normalized calendar dates. Missing/invalid form state should
  // never slip through as a server timezone-dependent default.
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return today;
  const parsed = new Date(`${date}T12:00:00`);
  if (!Number.isFinite(parsed.getTime()) || localDateStr(parsed) !== date) return today;
  return date < today ? today : date;
}

export function millisecondsUntilNextDay(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
}
