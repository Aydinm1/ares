import type { Assignment, Course } from "../domain/types.js";

export type DueTone = "overdue" | "today" | "soon" | "normal" | "undated";

export interface AssignmentRowViewModel {
  assignment: Assignment;
  course?: Course;
  courseColor: string;
  dueLabel: string;
  dueTone: DueTone;
  completed: boolean;
}

export interface MonthGridDay {
  date: Date;
  dateKey: string;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
}

export interface AssignmentFilters {
  courseId?: "all" | string;
  hideCompleted?: boolean;
}

export interface CompletionMutation {
  assignmentId: string;
  revision: number;
}

interface PendingCompletion {
  revision: number;
  prior: Assignment;
}

export interface OptimisticCompletionState {
  assignments: Assignment[];
  revisions: Readonly<Record<string, number>>;
  pending: Readonly<Record<string, PendingCompletion | undefined>>;
}
