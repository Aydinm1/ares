import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type {
  AssignmentUpdate,
  CompetencyFocusUpdate,
  CompetencyStatus,
  CompetencyUpdate,
  ContactEvidenceUpdate,
  ContactOutreachReadiness,
  ContactRelationshipRisk,
  ContactResearchStatus,
  ContactVerificationStatus,
  ContactWorkflow,
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
const CONTACT_EVIDENCE_WRITE_FIELDS = new Set([
  "linkedInUrl",
  "identityStatus",
  "organizationMatchStatus",
  "evidenceNotes",
  "notes",
  "outreachStatus",
  "lastContacted",
  "nextFollowUp",
  "relationshipRisk",
  "outreachReadiness",
  "relationshipContext",
  "researchStatus",
  "researchDossier",
  "researchSourceUrls",
  "lastResearchedAt"
]);
const CONTACT_VERIFICATION_STATUSES = new Set<ContactVerificationStatus>([
  "Unverified",
  "Needs Review",
  "Verified",
  "Rejected"
]);
const CONTACT_RELATIONSHIP_RISKS = new Set<ContactRelationshipRisk>([
  "Cold Practice",
  "Warm Light",
  "Warm Sensitive",
  "Big Ask Later",
  "Avoid / Need Context"
]);
const CONTACT_OUTREACH_READINESS = new Set<ContactOutreachReadiness>([
  "Practice Candidate",
  "Research First",
  "Ready to DM",
  "Ask Family Context",
  "Hold"
]);
const CONTACT_RESEARCH_STATUSES = new Set<ContactResearchStatus>([
  "Not Started",
  "Queued",
  "Researched",
  "Needs More Sources"
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

export function validateContactEvidenceWrite(value: unknown): ContactEvidenceUpdate {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(["Request body must be an object."]);
  }

  const payload = value as Record<string, unknown>;
  const issues: string[] = [];
  const keys = Object.keys(payload);
  if (keys.length === 0) issues.push("At least one field must be changed.");
  if (keys.some((key) => !CONTACT_EVIDENCE_WRITE_FIELDS.has(key))) {
    issues.push("Request contains fields that cannot be changed.");
  }

  const update: ContactEvidenceUpdate = {};
  if ("linkedInUrl" in payload) {
    if (payload.linkedInUrl === null || payload.linkedInUrl === "") {
      update.linkedInUrl = null;
    } else if (typeof payload.linkedInUrl !== "string") {
      issues.push("linkedInUrl must be a URL string or null.");
    } else {
      const url = payload.linkedInUrl.trim();
      if (url.length > 500) {
        issues.push("linkedInUrl must be 500 characters or fewer.");
      } else if (!/^https?:\/\//i.test(url)) {
        issues.push("linkedInUrl must start with http:// or https://.");
      } else {
        update.linkedInUrl = url;
      }
    }
  }

  for (const field of ["identityStatus", "organizationMatchStatus"] as const) {
    if (field in payload) {
      const value = payload[field];
      if (typeof value !== "string" || !CONTACT_VERIFICATION_STATUSES.has(value as ContactVerificationStatus)) {
        issues.push(`${field} must be a valid verification status.`);
      } else {
        update[field] = value as ContactVerificationStatus;
      }
    }
  }

  if ("evidenceNotes" in payload) {
    if (payload.evidenceNotes === null || payload.evidenceNotes === "") {
      update.evidenceNotes = null;
    } else if (typeof payload.evidenceNotes !== "string") {
      issues.push("evidenceNotes must be a string or null.");
    } else if (payload.evidenceNotes.trim().length > 4000) {
      issues.push("evidenceNotes must be 4,000 characters or fewer.");
    } else {
      update.evidenceNotes = payload.evidenceNotes.trim();
    }
  }

  if ("notes" in payload) {
    if (payload.notes === null || payload.notes === "") {
      update.notes = null;
    } else if (typeof payload.notes !== "string") {
      issues.push("notes must be a string or null.");
    } else if (payload.notes.trim().length > 8000) {
      issues.push("notes must be 8,000 characters or fewer.");
    } else {
      update.notes = payload.notes.trim();
    }
  }

  if ("outreachStatus" in payload) {
    if (payload.outreachStatus === null || payload.outreachStatus === "") {
      update.outreachStatus = null;
    } else if (typeof payload.outreachStatus !== "string") {
      issues.push("outreachStatus must be a string or null.");
    } else if (payload.outreachStatus.trim().length > 80) {
      issues.push("outreachStatus must be 80 characters or fewer.");
    } else {
      update.outreachStatus = payload.outreachStatus.trim();
    }
  }

  for (const field of ["lastContacted", "nextFollowUp"] as const) {
    if (field in payload) {
      const value = payload[field];
      if (value === null || value === "") {
        update[field] = null;
      } else if (typeof value !== "string") {
        issues.push(`${field} must be a local date string or null.`);
      } else if (!isValidLocalDate(value.trim())) {
        issues.push(`${field} must use YYYY-MM-DD format.`);
      } else {
        update[field] = value.trim();
      }
    }
  }

  if ("relationshipRisk" in payload) {
    if (payload.relationshipRisk === null || payload.relationshipRisk === "") {
      update.relationshipRisk = null;
    } else if (
      typeof payload.relationshipRisk !== "string" ||
      !CONTACT_RELATIONSHIP_RISKS.has(payload.relationshipRisk as ContactRelationshipRisk)
    ) {
      issues.push("relationshipRisk must be a valid relationship risk.");
    } else {
      update.relationshipRisk = payload.relationshipRisk as ContactRelationshipRisk;
    }
  }

  if ("outreachReadiness" in payload) {
    if (payload.outreachReadiness === null || payload.outreachReadiness === "") {
      update.outreachReadiness = null;
    } else if (
      typeof payload.outreachReadiness !== "string" ||
      !CONTACT_OUTREACH_READINESS.has(payload.outreachReadiness as ContactOutreachReadiness)
    ) {
      issues.push("outreachReadiness must be a valid outreach readiness.");
    } else {
      update.outreachReadiness = payload.outreachReadiness as ContactOutreachReadiness;
    }
  }

  if ("researchStatus" in payload) {
    if (payload.researchStatus === null || payload.researchStatus === "") {
      update.researchStatus = null;
    } else if (
      typeof payload.researchStatus !== "string" ||
      !CONTACT_RESEARCH_STATUSES.has(payload.researchStatus as ContactResearchStatus)
    ) {
      issues.push("researchStatus must be a valid research status.");
    } else {
      update.researchStatus = payload.researchStatus as ContactResearchStatus;
    }
  }

  for (const [field, limit] of [
    ["relationshipContext", 4000],
    ["researchDossier", 12000],
    ["researchSourceUrls", 4000]
  ] as const) {
    if (field in payload) {
      const value = payload[field];
      if (value === null || value === "") {
        update[field] = null;
      } else if (typeof value !== "string") {
        issues.push(`${field} must be a string or null.`);
      } else if (value.trim().length > limit) {
        issues.push(`${field} must be ${limit.toLocaleString()} characters or fewer.`);
      } else {
        update[field] = value.trim();
      }
    }
  }

  if ("lastResearchedAt" in payload) {
    if (payload.lastResearchedAt === null || payload.lastResearchedAt === "") {
      update.lastResearchedAt = null;
    } else if (typeof payload.lastResearchedAt !== "string") {
      issues.push("lastResearchedAt must be an ISO timestamp or null.");
    } else {
      const timestamp = payload.lastResearchedAt.trim();
      if (Number.isNaN(new Date(timestamp).getTime())) {
        issues.push("lastResearchedAt must be a valid timestamp.");
      } else {
        update.lastResearchedAt = timestamp;
      }
    }
  }

  if (issues.length) throw new ValidationError(issues);
  return update;
}

export function validateContactIntakeRequest(value: unknown): {
  rawText: string;
  dryRun: boolean;
  action: "create" | "updateExisting";
  targetWorkflows: ContactWorkflow[];
  sourceOverride?: string;
  createUnmatched: boolean;
  saveEligibleClientFit: boolean;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(["Request body must be an object."]);
  }
  const payload = value as Record<string, unknown>;
  const issues: string[] = [];
  const allowedKeys = new Set([
    "rawText",
    "dryRun",
    "action",
    "targetWorkflows",
    "sourceOverride",
    "createUnmatched",
    "saveEligibleClientFit"
  ]);
  if (Object.keys(payload).some((key) => !allowedKeys.has(key))) {
    issues.push("Request contains fields that cannot be supplied.");
  }
  if (typeof payload.rawText !== "string" || payload.rawText.trim().length === 0) {
    issues.push("rawText must be a non-empty string.");
  } else if (payload.rawText.length > 250_000) {
    issues.push("rawText must be 250,000 characters or fewer.");
  }
  if ("dryRun" in payload && typeof payload.dryRun !== "boolean") {
    issues.push("dryRun must be a boolean.");
  }
  if (
    "action" in payload &&
    payload.action !== "create" &&
    payload.action !== "updateExisting"
  ) {
    issues.push("action must be create or updateExisting.");
  }
  const workflowChoices = new Set([
    "School",
    "CodeLab Outreach",
    "180DC Outreach",
    "Personal Networking",
    "Friends/Family",
    "Birthdays",
    "Community",
    "Recruiting/Talent",
    "Needs Cleanup"
  ]);
  const targetWorkflows: ContactWorkflow[] = [];
  if ("targetWorkflows" in payload) {
    if (!Array.isArray(payload.targetWorkflows)) {
      issues.push("targetWorkflows must be an array.");
    } else {
      for (const item of payload.targetWorkflows) {
        if (typeof item !== "string" || !workflowChoices.has(item)) {
          issues.push("Every targetWorkflows item must be a known workflow.");
          break;
        }
        if (!targetWorkflows.includes(item as ContactWorkflow)) {
          targetWorkflows.push(item as ContactWorkflow);
        }
      }
    }
  }
  let sourceOverride: string | undefined;
  if ("sourceOverride" in payload) {
    if (typeof payload.sourceOverride !== "string" || !payload.sourceOverride.trim()) {
      issues.push("sourceOverride must be a non-empty string.");
    } else if (payload.sourceOverride.trim().length > 120) {
      issues.push("sourceOverride must be 120 characters or fewer.");
    } else {
      sourceOverride = payload.sourceOverride.trim();
    }
  }
  if ("createUnmatched" in payload && typeof payload.createUnmatched !== "boolean") {
    issues.push("createUnmatched must be a boolean.");
  }
  if ("saveEligibleClientFit" in payload && typeof payload.saveEligibleClientFit !== "boolean") {
    issues.push("saveEligibleClientFit must be a boolean.");
  }
  if (issues.length) throw new ValidationError(issues);
  return {
    rawText: String(payload.rawText).trim(),
    dryRun: payload.dryRun !== false,
    action: payload.action === "updateExisting" ? "updateExisting" : "create",
    targetWorkflows,
    sourceOverride,
    createUnmatched: payload.createUnmatched === true,
    saveEligibleClientFit: payload.saveEligibleClientFit === true
  };
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
