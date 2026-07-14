import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type {
  AssignmentUpdate,
  CompetencyFocusUpdate,
  CompetencyStatus,
  CompetencyUpdate,
  HabitUpdate
} from "../domain/types.js";

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
  "status",
  "hiddenFromList"
]);
const ASSIGNMENT_WEEKS = new Set([
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Finals"
]);
const AIRTABLE_RECORD_ID = /^rec[A-Za-z0-9]{14}$/;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const ACADEMIC_TIME_ZONE = "America/Los_Angeles";
const HABIT_WRITE_FIELDS = new Set(["name", "targetDaysPerWeek", "status", "sortOrder"]);
const COMPETENCY_STATUSES = new Set(["current", "dormant", "someday", "archived"]);
const COMPETENCY_WRITE_FIELDS = new Set([
  "name",
  "category",
  "status",
  "vision",
  "description",
  "sortOrder"
]);
const FOCUS_WRITE_FIELDS = new Set([
  "title",
  "startedAt",
  "endedAt",
  "notes",
  "endReason"
]);

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

export function validateHabitOrder(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(["Request body must be an object."]);
  }
  const payload = value as Record<string, unknown>;
  const issues: string[] = [];
  if (Object.keys(payload).some((key) => key !== "habitIds")) {
    issues.push("Only habitIds can be supplied.");
  }
  if (
    !Array.isArray(payload.habitIds) ||
    payload.habitIds.length === 0 ||
    payload.habitIds.some((id) => typeof id !== "string" || !AIRTABLE_RECORD_ID.test(id))
  ) {
    issues.push("habitIds must be a non-empty array of Airtable record IDs.");
  } else if (new Set(payload.habitIds).size !== payload.habitIds.length) {
    issues.push("habitIds must not contain duplicates.");
  }
  if (issues.length) throw new ValidationError(issues);
  return payload.habitIds as string[];
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

export function validateCompetencyCreate(value: unknown): {
  name: string;
  category?: string;
  vision?: string;
  description?: string;
} {
  const update = validateCompetencyPayload(value, false);
  if (!update.name) {
    throw new ValidationError(["name is required."]);
  }
  return {
    name: update.name,
    category: update.category ?? undefined,
    vision: update.vision ?? undefined,
    description: update.description ?? undefined
  };
}

export function validateCompetencyUpdate(value: unknown): CompetencyUpdate {
  return validateCompetencyPayload(value, true);
}

export function validateCompetencyOrder(value: unknown): string[] {
  return validateRecordOrder(value, "competencyIds");
}

export function validateCompetencyFocusCreate(value: unknown): {
  title: string;
  startedAt: string;
  notes?: string;
} {
  const update = validateCompetencyFocusPayload(value, false);
  if (!update.title || !update.startedAt) {
    throw new ValidationError(["title and startedAt are required."]);
  }
  return {
    title: update.title,
    startedAt: update.startedAt,
    notes: update.notes ?? undefined
  };
}

export function validateCompetencyFocusUpdate(value: unknown): CompetencyFocusUpdate {
  return validateCompetencyFocusPayload(value, true);
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
  if (!partial && keys.some((key) => key === "status" || key === "sortOrder")) {
    issues.push("status and sortOrder cannot be supplied when creating a habit.");
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
  if ("sortOrder" in payload) {
    if (
      typeof payload.sortOrder !== "number" ||
      !Number.isInteger(payload.sortOrder) ||
      payload.sortOrder < 0
    ) {
      issues.push("sortOrder must be a non-negative integer.");
    } else {
      update.sortOrder = payload.sortOrder;
    }
  }
  if (issues.length) throw new ValidationError(issues);
  return update;
}

function validateCompetencyPayload(value: unknown, partial: boolean): CompetencyUpdate {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(["Request body must be an object."]);
  }
  const payload = value as Record<string, unknown>;
  const keys = Object.keys(payload);
  const issues: string[] = [];
  if (keys.length === 0) issues.push("At least one field must be supplied.");
  if (keys.some((key) => !COMPETENCY_WRITE_FIELDS.has(key))) {
    issues.push("Request contains fields that cannot be changed.");
  }
  if (!partial && keys.some((key) => key === "status" || key === "sortOrder")) {
    issues.push("status and sortOrder cannot be supplied when creating a competency.");
  }
  const update: CompetencyUpdate = {};
  if ("name" in payload) {
    if (typeof payload.name !== "string" || !payload.name.trim()) {
      issues.push("name must be a non-empty string.");
    } else if (payload.name.trim().length > 120) {
      issues.push("name must be 120 characters or fewer.");
    } else {
      update.name = payload.name.trim();
    }
  }
  for (const field of ["category", "vision", "description"] as const) {
    if (field in payload) {
      const value = payload[field];
      if (value === null) {
        update[field] = null;
      } else if (typeof value !== "string") {
        issues.push(`${field} must be a string or null.`);
      } else if (value.trim().length > (field === "category" ? 80 : 2000)) {
        issues.push(`${field} is too long.`);
      } else {
        update[field] = value.trim() || null;
      }
    }
  }
  if ("status" in payload) {
    if (typeof payload.status !== "string" || !COMPETENCY_STATUSES.has(payload.status)) {
      issues.push("status must be current, dormant, someday, or archived.");
    } else {
      update.status = payload.status as CompetencyStatus;
    }
  }
  if ("sortOrder" in payload) {
    if (
      typeof payload.sortOrder !== "number" ||
      !Number.isInteger(payload.sortOrder) ||
      payload.sortOrder < 0
    ) {
      issues.push("sortOrder must be a non-negative integer.");
    } else {
      update.sortOrder = payload.sortOrder;
    }
  }
  if (issues.length) throw new ValidationError(issues);
  return update;
}

function validateCompetencyFocusPayload(
  value: unknown,
  partial: boolean
): CompetencyFocusUpdate {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(["Request body must be an object."]);
  }
  const payload = value as Record<string, unknown>;
  const keys = Object.keys(payload);
  const issues: string[] = [];
  if (keys.length === 0) issues.push("At least one field must be supplied.");
  if (keys.some((key) => !FOCUS_WRITE_FIELDS.has(key))) {
    issues.push("Request contains fields that cannot be changed.");
  }
  if (!partial && keys.some((key) => key === "endedAt" || key === "endReason")) {
    issues.push("endedAt and endReason cannot be supplied when creating a focus.");
  }
  const update: CompetencyFocusUpdate = {};
  if ("title" in payload) {
    if (typeof payload.title !== "string" || !payload.title.trim()) {
      issues.push("title must be a non-empty string.");
    } else if (payload.title.trim().length > 160) {
      issues.push("title must be 160 characters or fewer.");
    } else {
      update.title = payload.title.trim();
    }
  }
  if ("startedAt" in payload) {
    if (typeof payload.startedAt !== "string" || !isValidLocalDate(payload.startedAt)) {
      issues.push("startedAt must be a valid YYYY-MM-DD date.");
    } else {
      update.startedAt = payload.startedAt;
    }
  }
  if ("endedAt" in payload) {
    if (typeof payload.endedAt !== "string" || !isValidLocalDate(payload.endedAt)) {
      issues.push("endedAt must be a valid YYYY-MM-DD date.");
    } else {
      update.endedAt = payload.endedAt;
    }
  }
  for (const field of ["notes", "endReason"] as const) {
    if (field in payload) {
      const fieldValue = payload[field];
      if (fieldValue === null) {
        update[field] = null;
      } else if (typeof fieldValue !== "string") {
        issues.push(`${field} must be a string or null.`);
      } else if (fieldValue.trim().length > 2000) {
        issues.push(`${field} must be 2,000 characters or fewer.`);
      } else {
        update[field] = fieldValue.trim() || null;
      }
    }
  }
  if (update.startedAt && update.endedAt && update.endedAt < update.startedAt) {
    issues.push("endedAt cannot be before startedAt.");
  }
  if (issues.length) throw new ValidationError(issues);
  return update;
}

function validateRecordOrder(value: unknown, fieldName: string): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(["Request body must be an object."]);
  }
  const payload = value as Record<string, unknown>;
  const issues: string[] = [];
  if (Object.keys(payload).some((key) => key !== fieldName)) {
    issues.push(`Only ${fieldName} can be supplied.`);
  }
  const ids = payload[fieldName];
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.some((id) => typeof id !== "string" || !AIRTABLE_RECORD_ID.test(id))
  ) {
    issues.push(`${fieldName} must be a non-empty array of Airtable record IDs.`);
  } else if (new Set(ids).size !== ids.length) {
    issues.push(`${fieldName} must not contain duplicates.`);
  }
  if (issues.length) throw new ValidationError(issues);
  return ids as string[];
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
  if ("hiddenFromList" in payload) {
    if (typeof payload.hiddenFromList !== "boolean") {
      issues.push("hiddenFromList must be a boolean.");
    } else {
      update.hiddenFromList = payload.hiddenFromList;
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
