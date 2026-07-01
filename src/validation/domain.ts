import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { AssignmentUpdate, HabitUpdate } from "../domain/types.js";

export class ValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join("; "));
    this.name = "ValidationError";
  }
}

export function validateInboxCapture(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(["Request body must be an object."]);
  }
  const payload = value as Record<string, unknown>;
  const issues: string[] = [];
  if (Object.keys(payload).some((key) => key !== "text")) {
    issues.push("Only text can be supplied.");
  }
  if (typeof payload.text !== "string" || payload.text.trim().length === 0) {
    issues.push("text must be a non-empty string.");
  } else if (payload.text.trim().length > 2000) {
    issues.push("text must be 2,000 characters or fewer.");
  }
  if (issues.length) throw new ValidationError(issues);
  return (payload.text as string).trim();
}

const ASSIGNMENT_UPDATE_FIELDS = new Set([
  "title",
  "courseId",
  "dueDate",
  "dueTime",
  "pointsPossible",
  "weekLabel",
  "status"
]);
const ASSIGNMENT_WEEKS = new Set([
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Finals"
]);
const AIRTABLE_RECORD_ID = /^rec[A-Za-z0-9]{14}$/;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const ACADEMIC_TIME_ZONE = "America/Los_Angeles";
const HABIT_WRITE_FIELDS = new Set(["name", "targetDaysPerWeek", "status"]);

export function validateHabitCreate(value: unknown): {
  name: string;
  targetDaysPerWeek: number;
} {
  const update = validateHabitPayload(value, false);
  if (!update.name || update.targetDaysPerWeek === undefined) {
    throw new ValidationError(["name and targetDaysPerWeek are required."]);
  }
  return { name: update.name, targetDaysPerWeek: update.targetDaysPerWeek };
}

export function validateHabitUpdate(value: unknown): HabitUpdate {
  return validateHabitPayload(value, true);
}

export function validateHabitDate(value: string): string {
  if (!isValidLocalDate(value)) {
    throw new ValidationError(["date must be a valid YYYY-MM-DD date."]);
  }
  return value;
}

export function validateHabitCheckInDate(value: string, now = new Date()): string {
  const date = validateHabitDate(value);
  const today = formatInTimeZone(now, ACADEMIC_TIME_ZONE, "yyyy-MM-dd");
  if (date > today) {
    throw new ValidationError(["Habit check-ins cannot be created for future dates."]);
  }
  return date;
}

export function validateHabitWeekStart(value: string | null): string {
  if (!value || !isValidLocalDate(value)) {
    throw new ValidationError(["weekStart must be a valid YYYY-MM-DD date."]);
  }
  const [year, month, day] = value.split("-").map(Number);
  if (new Date(Date.UTC(year!, month! - 1, day)).getUTCDay() !== 1) {
    throw new ValidationError(["weekStart must be a Monday."]);
  }
  return value;
}

function validateHabitPayload(value: unknown, partial: boolean): HabitUpdate {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(["Request body must be an object."]);
  }
  const payload = value as Record<string, unknown>;
  const keys = Object.keys(payload);
  const issues: string[] = [];
  if (keys.length === 0) issues.push("At least one field must be supplied.");
  if (keys.some((key) => !HABIT_WRITE_FIELDS.has(key))) {
    issues.push("Request contains fields that cannot be changed.");
  }
  if (!partial && keys.some((key) => key === "status")) {
    issues.push("status cannot be supplied when creating a habit.");
  }
  const update: HabitUpdate = {};
  if ("name" in payload) {
    if (typeof payload.name !== "string" || !payload.name.trim()) {
      issues.push("name must be a non-empty string.");
    } else if (payload.name.trim().length > 120) {
      issues.push("name must be 120 characters or fewer.");
    } else {
      update.name = payload.name.trim();
    }
  }
  if ("targetDaysPerWeek" in payload) {
    if (
      typeof payload.targetDaysPerWeek !== "number" ||
      !Number.isInteger(payload.targetDaysPerWeek) ||
      payload.targetDaysPerWeek < 1 ||
      payload.targetDaysPerWeek > 7
    ) {
      issues.push("targetDaysPerWeek must be an integer from 1 through 7.");
    } else {
      update.targetDaysPerWeek = payload.targetDaysPerWeek;
    }
  }
  if ("status" in payload) {
    if (payload.status !== "active" && payload.status !== "archived") {
      issues.push("status must be active or archived.");
    } else {
      update.status = payload.status;
    }
  }
  if (issues.length) throw new ValidationError(issues);
  return update;
}

export function validateAssignmentWrite(value: unknown): AssignmentUpdate {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(["Request body must be an object."]);
  }

  const payload = value as Record<string, unknown>;
  const issues: string[] = [];
  const keys = Object.keys(payload);
  if (keys.length === 0) issues.push("At least one field must be changed.");
  if (keys.some((key) => !ASSIGNMENT_UPDATE_FIELDS.has(key))) {
    issues.push("Request contains fields that cannot be changed.");
  }

  const update: AssignmentUpdate = {};
  if ("title" in payload) {
    if (typeof payload.title !== "string" || payload.title.trim().length === 0) {
      issues.push("title must be a non-empty string.");
    } else if (payload.title.trim().length > 200) {
      issues.push("title must be 200 characters or fewer.");
    } else {
      update.title = payload.title.trim();
    }
  }
  if ("courseId" in payload) {
    if (payload.courseId !== null && (
      typeof payload.courseId !== "string" || !AIRTABLE_RECORD_ID.test(payload.courseId)
    )) {
      issues.push("courseId must be an Airtable record ID or null.");
    } else {
      update.courseId = payload.courseId as string | null;
    }
  }
  if ("status" in payload) {
    if (payload.status !== "submitted" && payload.status !== "not_started") {
      issues.push("status must be submitted or not_started.");
    } else {
      update.status = payload.status;
    }
  }
  if ("pointsPossible" in payload) {
    if (payload.pointsPossible !== null && (
      typeof payload.pointsPossible !== "number" ||
      !Number.isFinite(payload.pointsPossible) ||
      payload.pointsPossible < 0
    )) {
      issues.push("pointsPossible must be a non-negative number or null.");
    } else {
      update.pointsPossible = payload.pointsPossible as number | null;
    }
  }
  if ("weekLabel" in payload) {
    if (payload.weekLabel !== null && (
      typeof payload.weekLabel !== "string" || !ASSIGNMENT_WEEKS.has(payload.weekLabel)
    )) {
      issues.push("weekLabel must be 1 through 10, Finals, or null.");
    } else {
      update.weekLabel = payload.weekLabel as string | null;
    }
  }

  const hasDueDate = "dueDate" in payload;
  const hasDueTime = "dueTime" in payload;
  if (hasDueTime && !hasDueDate) issues.push("dueTime cannot be changed without dueDate.");
  if (hasDueDate) {
    if (payload.dueDate === null) {
      if (hasDueTime && payload.dueTime !== null && payload.dueTime !== "") {
        issues.push("dueTime cannot be set when dueDate is null.");
      }
      update.dueAt = null;
    } else if (typeof payload.dueDate !== "string" || !isValidLocalDate(payload.dueDate)) {
      issues.push("dueDate must be a valid YYYY-MM-DD date or null.");
    } else if (
      hasDueTime &&
      payload.dueTime !== null &&
      payload.dueTime !== "" &&
      (typeof payload.dueTime !== "string" || !LOCAL_TIME.test(payload.dueTime))
    ) {
      issues.push("dueTime must be HH:mm, empty, or null.");
    } else {
      const dueTime =
        typeof payload.dueTime === "string" && payload.dueTime ? payload.dueTime : "23:59";
      update.dueAt = fromZonedTime(
        `${payload.dueDate}T${dueTime}:00`,
        ACADEMIC_TIME_ZONE
      ).toISOString();
    }
  }

  if (issues.length) throw new ValidationError(issues);
  return update;
}

export function validateAssignmentCompletionWrite(
  value: unknown
): "submitted" | "not_started" {
  const update = validateAssignmentWrite(value);
  if (Object.keys(update).length !== 1 || update.status === undefined) {
    throw new ValidationError(["Only status can be changed."]);
  }
  return update.status;
}

function isValidLocalDate(value: string): boolean {
  if (!LOCAL_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
  );
}
