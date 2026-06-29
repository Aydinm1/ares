import type { Assignment } from "../domain/types.js";
import type { DueTone, MonthGridDay } from "./types.js";

const DAY_MS = 86_400_000;

function validDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Returns YYYY-MM-DD using the runtime's local timezone. */
export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

/** Formats an assignment deadline relative to the supplied local "now". */
export function getDueState(
  dueAt: string | undefined,
  now = new Date()
): { dueLabel: string; dueTone: DueTone } {
  const due = validDate(dueAt);
  if (!due) return { dueLabel: "No due date", dueTone: "undated" };

  const difference = localDayNumber(due) - localDayNumber(now);
  if (difference < 0) return { dueLabel: "Overdue", dueTone: "overdue" };
  if (difference === 0) return { dueLabel: "Due today", dueTone: "today" };
  if (difference === 1) return { dueLabel: "Due tomorrow", dueTone: "soon" };
  if (difference <= 7) return { dueLabel: `Due in ${difference} days`, dueTone: "soon" };
  return {
    dueLabel: new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: due.getFullYear() === now.getFullYear() ? undefined : "numeric"
    }).format(due),
    dueTone: "normal"
  };
}

/** Produces the smallest complete Sunday-first month grid: five or six weeks. */
export function buildMonthGrid(month: Date, today = new Date()): MonthGridDay[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  const todayKey = localDateKey(today);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const gridLength = first.getDay() + daysInMonth <= 35 ? 35 : 42;

  return Array.from({ length: gridLength }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return {
      date,
      dateKey: localDateKey(date),
      dayOfMonth: date.getDate(),
      inMonth:
        date.getFullYear() === first.getFullYear() && date.getMonth() === first.getMonth(),
      isToday: localDateKey(date) === todayKey
    };
  });
}

/** Formats the last successful Airtable synchronization as a compact relative label. */
export function formatLastSyncedLabel(lastSyncedAt: Date, now = new Date()): string {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((now.getTime() - lastSyncedAt.getTime()) / 60_000)
  );
  if (elapsedMinutes < 1) return "Last synced just now";
  if (elapsedMinutes < 60) return `Last synced ${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Last synced ${elapsedHours}h ago`;
  return `Last synced ${Math.floor(elapsedHours / 24)}d ago`;
}

/** Moves to the first day of an adjacent month without date overflow. */
export function shiftMonth(month: Date, offset: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + offset, 1);
}

/** Returns the first day of the month containing the supplied local date. */
export function monthForToday(today = new Date()): Date {
  return new Date(today.getFullYear(), today.getMonth(), 1);
}

/** Milliseconds until the next browser-local day, with a small rollover buffer. */
export function millisecondsUntilNextLocalDay(now = new Date()): number {
  const nextDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );
  return Math.max(1, nextDay.getTime() - now.getTime() + 100);
}

/** Compares calendar months in the runtime's local timezone. */
export function isSameLocalMonth(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

/** Groups valid deadlines by their browser-local calendar date. */
export function groupAssignmentsByLocalDate(
  assignments: readonly Assignment[]
): Readonly<Record<string, Assignment[]>> {
  const grouped: Record<string, Assignment[]> = {};
  for (const assignment of assignments) {
    const due = validDate(assignment.dueAt);
    if (!due) continue;
    const key = localDateKey(due);
    (grouped[key] ??= []).push(assignment);
  }
  return grouped;
}

/** Converts a valid deadline to a timestamp; invalid/missing values sort last. */
export function dueTimestamp(assignment: Assignment): number {
  return validDate(assignment.dueAt)?.getTime() ?? Number.POSITIVE_INFINITY;
}
