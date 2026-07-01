export type AirtableRecordId = string;

export type AssignmentStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "graded"
  | "missing";

export type AssignmentCategory =
  | "reading"
  | "problem_set"
  | "paper"
  | "quiz"
  | "exam"
  | "project"
  | "discussion"
  | "other";

export type CourseStatus = "not_started" | "in_progress" | "completed";

export interface GradeCategory {
  id: AirtableRecordId;
  courseId: AirtableRecordId;
  name: string;
  weightPercent: number;
}

export interface GradePolicy {
  courseId: AirtableRecordId;
  categories: GradeCategory[];
  usesWeightedCategories: boolean;
}

export interface GeneralEducationRequirement {
  id: AirtableRecordId;
  category: string;
}

export interface Course {
  id: AirtableRecordId;
  name: string;
  status?: CourseStatus;
  quarterTaken?: string;
  grade?: string;
  majorRequirements?: string[];
  geRequirementUsedIds?: AirtableRecordId[];
  geRequirementsUsed?: GeneralEducationRequirement[];
  creditHours?: number;
  gradePolicy?: GradePolicy;
}

export interface Assignment {
  id: AirtableRecordId;
  title: string;
  courseId?: AirtableRecordId;
  dueAt?: string;
  status: AssignmentStatus;
  category: AssignmentCategory;
  categoryId?: AirtableRecordId;
  pointsEarned?: number;
  pointsPossible?: number;
  typeLabel?: string;
  weekLabel?: string;
  notes?: string;
  createdAt?: string;
}

export interface AssignmentUpdate {
  title?: string;
  courseId?: AirtableRecordId | null;
  dueAt?: string | null;
  status?: "submitted" | "not_started";
  pointsPossible?: number | null;
  weekLabel?: string | null;
}

export interface InboxItem {
  id: AirtableRecordId;
  text: string;
  createdAt: string;
  processed: boolean;
}

export type HabitStatus = "active" | "archived";

export interface Habit {
  id: AirtableRecordId;
  name: string;
  targetDaysPerWeek: number;
  status: HabitStatus;
  createdAt: string;
}

export interface HabitCheckIn {
  id: AirtableRecordId;
  habitId: AirtableRecordId;
  date: string;
  createdAt: string;
}

export interface HabitWeek {
  habits: Habit[];
  checkIns: HabitCheckIn[];
  weekStart: string;
  weekEnd: string;
}

export interface HabitUpdate {
  name?: string;
  targetDaysPerWeek?: number;
  status?: HabitStatus;
}
