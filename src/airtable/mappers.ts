import type {
  Assignment,
  AssignmentUpdate,
  AssignmentCategory,
  AssignmentStatus,
  Competency,
  CompetencyFocus,
  CompetencyFocusUpdate,
  CompetencyStatus,
  CompetencyUpdate,
  Course,
  CourseStatus,
  GeneralEducationRequirement,
  GradeCategory,
  Habit,
  HabitCheckIn,
  HabitUpdate,
  InboxItem
} from "../domain/types.js";
import type { AirtableRecord } from "./client.js";
import { fields } from "./schema.js";

type AnyFields = Record<string, unknown>;

const firstLinkedId = (value: unknown): string | undefined =>
  Array.isArray(value) && typeof value[0] === "string" ? value[0] : undefined;

const stringValues = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const numberValue = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

function courseStatusFromAirtable(value: unknown): CourseStatus | undefined {
  if (value === "In Progress") return "in_progress";
  if (value === "Not Started") return "not_started";
  if (value === "Completed") return "completed";
  return undefined;
}

export function assignmentStatusFromAirtable(recordFields: AnyFields): AssignmentStatus {
  return recordFields[fields.assignments.completed] === true ? "submitted" : "not_started";
}

export function assignmentCategoryFromLabel(label: unknown): AssignmentCategory {
  const normalized = typeof label === "string" ? label.toLowerCase() : "";
  if (normalized.includes("read")) return "reading";
  if (normalized.includes("problem")) return "problem_set";
  if (normalized.includes("paper") || normalized.includes("essay")) return "paper";
  if (normalized.includes("quiz")) return "quiz";
  if (normalized.includes("exam") || normalized.includes("midterm") || normalized.includes("final")) return "exam";
  if (normalized.includes("project")) return "project";
  if (normalized.includes("discussion")) return "discussion";
  return "other";
}

export function mapCourse(record: AirtableRecord<AnyFields>): Course {
  const value = record.fields;
  return {
    id: record.id,
    name: stringValue(value[fields.courses.name])?.trim() || "Untitled course",
    status: courseStatusFromAirtable(value[fields.courses.status]),
    quarterTaken: stringValue(value[fields.courses.quarterTaken]),
    grade: stringValue(value[fields.courses.grade]),
    majorRequirements: stringValues(value[fields.courses.majorRequirements]),
    geRequirementUsedIds: stringValues(value[fields.courses.geRequirementsUsed]),
    creditHours: numberValue(value[fields.courses.creditHours])
  };
}

export function mapGeneralEducationRequirement(
  record: AirtableRecord<AnyFields>
): GeneralEducationRequirement {
  return {
    id: record.id,
    category: stringValue(record.fields[fields.generalEducation.category]) ?? "Unnamed requirement"
  };
}

export function mapAssignment(record: AirtableRecord<AnyFields>): Assignment {
  const value = record.fields;
  const typeLabel = stringValue(value[fields.assignments.typeLabel]);
  return {
    id: record.id,
    title: stringValue(value[fields.assignments.title]) ?? "Untitled assignment",
    courseId: firstLinkedId(value[fields.assignments.course]),
    dueAt: stringValue(value[fields.assignments.dueAt]),
    status: assignmentStatusFromAirtable(value),
    category: assignmentCategoryFromLabel(typeLabel),
    categoryId: firstLinkedId(value[fields.assignments.gradeCategory]),
    pointsEarned: numberValue(value[fields.assignments.pointsEarned]),
    pointsPossible: numberValue(value[fields.assignments.pointsPossible]),
    typeLabel,
    weekLabel: stringValue(value[fields.assignments.weekLabel]),
    hiddenFromList: value[fields.assignments.hiddenFromList] === true,
    createdAt: record.createdTime
  };
}

export function mapInboxItem(record: AirtableRecord<AnyFields>): InboxItem {
  return {
    id: record.id,
    text: stringValue(record.fields[fields.inboxItems.text])?.trim() || "Untitled capture",
    createdAt:
      stringValue(record.fields[fields.inboxItems.createdAt]) ??
      record.createdTime ??
      new Date(0).toISOString(),
    processed: record.fields[fields.inboxItems.processed] === true
  };
}

export function inboxItemToAirtable(text: string, createdAt: string): AnyFields {
  return {
    [fields.inboxItems.text]: text,
    [fields.inboxItems.createdAt]: createdAt,
    [fields.inboxItems.processed]: false
  };
}

export function mapHabit(record: AirtableRecord<AnyFields>): Habit {
  return {
    id: record.id,
    name: stringValue(record.fields[fields.habits.name])?.trim() || "Untitled habit",
    targetDaysPerWeek: numberValue(record.fields[fields.habits.targetDaysPerWeek]) ?? 4,
    status: record.fields[fields.habits.status] === "Archived" ? "archived" : "active",
    createdAt:
      stringValue(record.fields[fields.habits.createdAt]) ??
      record.createdTime ??
      new Date(0).toISOString(),
    sortOrder: numberValue(record.fields[fields.habits.sortOrder])
  };
}

export function habitToAirtable(
  name: string,
  targetDaysPerWeek: number,
  createdAt: string,
  sortOrder: number
): AnyFields {
  return {
    [fields.habits.name]: name,
    [fields.habits.targetDaysPerWeek]: targetDaysPerWeek,
    [fields.habits.status]: "Active",
    [fields.habits.createdAt]: createdAt,
    [fields.habits.sortOrder]: sortOrder
  };
}

export function habitUpdateToAirtable(update: HabitUpdate): AnyFields {
  const result: AnyFields = {};
  if (update.name !== undefined) result[fields.habits.name] = update.name;
  if (update.targetDaysPerWeek !== undefined) {
    result[fields.habits.targetDaysPerWeek] = update.targetDaysPerWeek;
  }
  if (update.status !== undefined) {
    result[fields.habits.status] = update.status === "archived" ? "Archived" : "Active";
  }
  if (update.sortOrder !== undefined) result[fields.habits.sortOrder] = update.sortOrder;
  return result;
}

export function mapHabitCheckIn(record: AirtableRecord<AnyFields>): HabitCheckIn {
  return {
    id: record.id,
    habitId: firstLinkedId(record.fields[fields.habitCheckIns.habit]) ?? "",
    date: stringValue(record.fields[fields.habitCheckIns.date]) ?? "",
    createdAt:
      stringValue(record.fields[fields.habitCheckIns.createdAt]) ??
      record.createdTime ??
      new Date(0).toISOString()
  };
}

export function habitCheckInToAirtable(
  habitId: string,
  date: string,
  createdAt: string
): AnyFields {
  return {
    [fields.habitCheckIns.key]: `${habitId}:${date}`,
    [fields.habitCheckIns.habit]: [habitId],
    [fields.habitCheckIns.date]: date,
    [fields.habitCheckIns.createdAt]: createdAt
  };
}

function competencyStatusFromAirtable(value: unknown): CompetencyStatus {
  if (value === "Dormant") return "dormant";
  if (value === "Someday") return "someday";
  if (value === "Archived") return "archived";
  return "current";
}

function competencyStatusToAirtable(status: CompetencyStatus): string {
  if (status === "dormant") return "Dormant";
  if (status === "someday") return "Someday";
  if (status === "archived") return "Archived";
  return "Current";
}

export function mapCompetency(record: AirtableRecord<AnyFields>): Competency {
  return {
    id: record.id,
    name: stringValue(record.fields[fields.competencies.name])?.trim() || "Untitled competency",
    category: stringValue(record.fields[fields.competencies.category]),
    status: competencyStatusFromAirtable(record.fields[fields.competencies.status]),
    vision: stringValue(record.fields[fields.competencies.vision]),
    description: stringValue(record.fields[fields.competencies.description]),
    sortOrder: numberValue(record.fields[fields.competencies.sortOrder]),
    createdAt:
      stringValue(record.fields[fields.competencies.createdAt]) ??
      record.createdTime ??
      new Date(0).toISOString()
  };
}

export function competencyToAirtable(
  name: string,
  category: string | undefined,
  vision: string | undefined,
  description: string | undefined,
  createdAt: string,
  sortOrder: number
): AnyFields {
  return {
    [fields.competencies.name]: name,
    [fields.competencies.category]: category ?? null,
    [fields.competencies.status]: "Current",
    [fields.competencies.vision]: vision ?? null,
    [fields.competencies.description]: description ?? null,
    [fields.competencies.sortOrder]: sortOrder,
    [fields.competencies.createdAt]: createdAt
  };
}

export function competencyUpdateToAirtable(update: CompetencyUpdate): AnyFields {
  const result: AnyFields = {};
  if (update.name !== undefined) result[fields.competencies.name] = update.name;
  if (update.category !== undefined) result[fields.competencies.category] = update.category;
  if (update.status !== undefined) result[fields.competencies.status] = competencyStatusToAirtable(update.status);
  if (update.vision !== undefined) result[fields.competencies.vision] = update.vision;
  if (update.description !== undefined) result[fields.competencies.description] = update.description;
  if (update.sortOrder !== undefined) result[fields.competencies.sortOrder] = update.sortOrder;
  return result;
}

export function mapCompetencyFocus(record: AirtableRecord<AnyFields>): CompetencyFocus {
  return {
    id: record.id,
    competencyId: firstLinkedId(record.fields[fields.competencyFocuses.competency]) ?? "",
    title: stringValue(record.fields[fields.competencyFocuses.title])?.trim() || "Untitled focus",
    startedAt: stringValue(record.fields[fields.competencyFocuses.startedAt]) ?? "",
    endedAt: stringValue(record.fields[fields.competencyFocuses.endedAt]),
    notes: stringValue(record.fields[fields.competencyFocuses.notes]),
    endReason: stringValue(record.fields[fields.competencyFocuses.endReason]),
    createdAt:
      stringValue(record.fields[fields.competencyFocuses.createdAt]) ??
      record.createdTime ??
      new Date(0).toISOString()
  };
}

export function competencyFocusToAirtable(
  competencyId: string,
  title: string,
  startedAt: string,
  notes: string | undefined,
  createdAt: string
): AnyFields {
  return {
    [fields.competencyFocuses.competency]: [competencyId],
    [fields.competencyFocuses.title]: title,
    [fields.competencyFocuses.startedAt]: startedAt,
    [fields.competencyFocuses.notes]: notes ?? null,
    [fields.competencyFocuses.createdAt]: createdAt
  };
}

export function competencyFocusUpdateToAirtable(update: CompetencyFocusUpdate): AnyFields {
  const result: AnyFields = {};
  if (update.title !== undefined) result[fields.competencyFocuses.title] = update.title;
  if (update.startedAt !== undefined) result[fields.competencyFocuses.startedAt] = update.startedAt;
  if (update.endedAt !== undefined) result[fields.competencyFocuses.endedAt] = update.endedAt;
  if (update.notes !== undefined) result[fields.competencyFocuses.notes] = update.notes;
  if (update.endReason !== undefined) result[fields.competencyFocuses.endReason] = update.endReason;
  return result;
}

export function assignmentCompletionToAirtable(
  status: "submitted" | "not_started"
): AnyFields {
  return { [fields.assignments.completed]: status === "submitted" };
}

export function assignmentUpdateToAirtable(update: AssignmentUpdate): AnyFields {
  const fieldsToUpdate: AnyFields = {};
  if (update.title !== undefined) fieldsToUpdate[fields.assignments.title] = update.title;
  if (update.courseId !== undefined) {
    fieldsToUpdate[fields.assignments.course] = update.courseId ? [update.courseId] : [];
  }
  if (update.dueAt !== undefined) fieldsToUpdate[fields.assignments.dueAt] = update.dueAt;
  if (update.status !== undefined) {
    fieldsToUpdate[fields.assignments.completed] = update.status === "submitted";
  }
  if (update.pointsPossible !== undefined) {
    fieldsToUpdate[fields.assignments.pointsPossible] = update.pointsPossible;
  }
  if (update.weekLabel !== undefined) {
    fieldsToUpdate[fields.assignments.weekLabel] = update.weekLabel;
  }
  if (update.hiddenFromList !== undefined) {
    fieldsToUpdate[fields.assignments.hiddenFromList] = update.hiddenFromList;
  }
  return fieldsToUpdate;
}

export function mapGradeCategory(record: AirtableRecord<AnyFields>): GradeCategory {
  const value = record.fields;
  return {
    id: record.id,
    courseId: firstLinkedId(value[fields.gradeCategories.course]) ?? "",
    name: stringValue(value[fields.gradeCategories.name]) ?? "Uncategorized",
    weightPercent: numberValue(value[fields.gradeCategories.weightPercent]) ?? 0
  };
}
