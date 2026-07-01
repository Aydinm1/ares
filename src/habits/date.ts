const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function localDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

export function mondayForDate(date: Date): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  return localDateKey(monday);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return utcDateKey(date);
}

export function shiftWeekStart(weekStart: string, weeks: number): string {
  return addDaysToDateKey(weekStart, weeks * 7);
}

export function weekDateKeys(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDaysToDateKey(weekStart, index));
}

export function formatWeekRange(weekStart: string): string {
  const start = parseDateKey(weekStart);
  const end = parseDateKey(addDaysToDateKey(weekStart, 6));
  const startMonth = start.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const endMonth = end.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const year = end.getUTCFullYear();
  return startMonth === endMonth
    ? `${startMonth} ${startDay} – ${endDay}, ${year}`
    : `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
}

export function dateKeyDayNumber(dateKey: string): number {
  return parseDateKey(dateKey).getUTCDate();
}

export function parseDateKey(dateKey: string): Date {
  if (!DATE_KEY.test(dateKey)) throw new Error(`Invalid date key: ${dateKey}`);
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month! - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  return date;
}

function utcDateKey(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}
