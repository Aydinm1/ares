import type { Assignment, Course } from "../domain/types.js";
import { dueTimestamp, getDueState } from "./dates.js";
import type {
  AssignmentFilters,
  AssignmentRowViewModel,
  OptimisticCompletionState,
  CompletionMutation
} from "./types.js";

export const COURSE_COLORS = [
  "#1D4ED8",
  "#0369A1",
  "#047857",
  "#B45309",
  "#B91C1C",
  "#475569",
  "#0F766E",
  "#9F1239"
] as const;

export function isCompleted(assignment: Assignment): boolean {
  return assignment.status === "submitted";
}

/** Applies course/completion filters without mutating input. */
export function filterAssignments(
  assignments: readonly Assignment[],
  filters: AssignmentFilters = {}
): Assignment[] {
  const courseId = filters.courseId ?? "all";
  return assignments.filter(
    (assignment) =>
      (!filters.hideHiddenFromList || assignment.hiddenFromList !== true) &&
      (
        !isCompleted(assignment) ||
        filters.retainedCompletedIds?.has(assignment.id) === true ||
        (
          !filters.hideCompleted &&
          (
            filters.completedCourseIds === undefined ||
            (
              assignment.courseId !== undefined &&
              filters.completedCourseIds.has(assignment.courseId)
            )
          )
        )
      ) &&
      (courseId === "all" || assignment.courseId === courseId)
  );
}

/** Sorts deadlines first, then course name, title, and record ID for total stability. */
export function sortAssignments(
  assignments: readonly Assignment[],
  courses: readonly Course[],
  options: { completedFirst?: boolean } = {}
): Assignment[] {
  const courseNames = new Map(courses.map((course) => [course.id, course.name]));
  const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
  return [...assignments].sort((left, right) => {
    if (options.completedFirst) {
      const leftCompleted = isCompleted(left);
      const rightCompleted = isCompleted(right);
      if (leftCompleted !== rightCompleted) return leftCompleted ? -1 : 1;
      if (leftCompleted && rightCompleted) {
        const byDate = compareDueTimestamp(left, right, "desc");
        if (Number.isFinite(byDate) && byDate !== 0) return byDate;
      }
    }

    const byDate = compareDueTimestamp(left, right, "asc");
    if (Number.isFinite(byDate) && byDate !== 0) return byDate;
    const byCourse = collator.compare(
      courseNames.get(left.courseId ?? "") ?? "",
      courseNames.get(right.courseId ?? "") ?? ""
    );
    return byCourse || collator.compare(left.title, right.title) || left.id.localeCompare(right.id);
  });
}

function compareDueTimestamp(
  left: Assignment,
  right: Assignment,
  order: "asc" | "desc"
): number {
  const leftTimestamp = dueTimestamp(left);
  const rightTimestamp = dueTimestamp(right);
  const leftMissing = leftTimestamp === Number.POSITIVE_INFINITY;
  const rightMissing = rightTimestamp === Number.POSITIVE_INFINITY;
  if (leftMissing || rightMissing) {
    if (leftMissing && rightMissing) return 0;
    return leftMissing ? 1 : -1;
  }
  return order === "asc" ? leftTimestamp - rightTimestamp : rightTimestamp - leftTimestamp;
}

/** Maps a course record ID deterministically onto the shared accessible palette. */
export function courseColor(courseId: string | undefined): string {
  if (!courseId) return "#64748B";
  let hash = 2_166_136_261;
  for (let index = 0; index < courseId.length; index += 1) {
    hash ^= courseId.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return COURSE_COLORS[(hash >>> 0) % COURSE_COLORS.length]!;
}

/** Joins course metadata and due state into the shared presentation contract. */
export function buildAssignmentRowViewModels(
  assignments: readonly Assignment[],
  courses: readonly Course[],
  now = new Date()
): AssignmentRowViewModel[] {
  const courseById = new Map(courses.map((course) => [course.id, course]));
  return assignments.map((assignment) => ({
    assignment,
    course: assignment.courseId ? courseById.get(assignment.courseId) : undefined,
    courseColor: courseColor(assignment.courseId),
    ...getDueState(assignment.dueAt, now),
    completed: isCompleted(assignment)
  }));
}

/** Creates immutable optimistic state from the current server snapshot. */
export function createOptimisticCompletionState(
  assignments: readonly Assignment[]
): OptimisticCompletionState {
  return { assignments: [...assignments], revisions: {}, pending: {} };
}

/** Applies a completion toggle and returns a revision token for later settlement. */
export function beginCompletionChange(
  state: OptimisticCompletionState,
  assignmentId: string,
  completed: boolean
): { state: OptimisticCompletionState; mutation: CompletionMutation } {
  return beginAssignmentChange(state, assignmentId, {
    status: completed ? "submitted" : "not_started"
  });
}

/** Applies an optimistic assignment patch and returns a revision token for settlement. */
export function beginAssignmentChange(
  state: OptimisticCompletionState,
  assignmentId: string,
  patch: Partial<Assignment>
): { state: OptimisticCompletionState; mutation: CompletionMutation } {
  const prior = state.assignments.find((assignment) => assignment.id === assignmentId);
  if (!prior) throw new Error(`Unknown assignment: ${assignmentId}`);
  const revision = (state.revisions[assignmentId] ?? 0) + 1;
  return {
    mutation: { assignmentId, revision },
    state: {
      assignments: state.assignments.map((assignment) =>
        assignment.id === assignmentId
          ? { ...assignment, ...patch }
          : assignment
      ),
      revisions: { ...state.revisions, [assignmentId]: revision },
      pending: { ...state.pending, [assignmentId]: { revision, prior } }
    }
  };
}

/** Reconciles the server record; stale mutation tokens leave state untouched. */
export function commitCompletionChange(
  state: OptimisticCompletionState,
  mutation: CompletionMutation,
  serverAssignment: Assignment
): OptimisticCompletionState {
  if (state.revisions[mutation.assignmentId] !== mutation.revision) return state;
  const pending = { ...state.pending };
  delete pending[mutation.assignmentId];
  return {
    ...state,
    assignments: state.assignments.map((assignment) =>
      assignment.id === mutation.assignmentId ? serverAssignment : assignment
    ),
    pending
  };
}

/** Restores the exact pre-toggle record; stale mutation tokens are ignored. */
export function rollbackCompletionChange(
  state: OptimisticCompletionState,
  mutation: CompletionMutation
): OptimisticCompletionState {
  const pendingChange = state.pending[mutation.assignmentId];
  if (
    state.revisions[mutation.assignmentId] !== mutation.revision ||
    pendingChange?.revision !== mutation.revision
  ) {
    return state;
  }
  const pending = { ...state.pending };
  delete pending[mutation.assignmentId];
  return {
    ...state,
    assignments: state.assignments.map((assignment) =>
      assignment.id === mutation.assignmentId ? pendingChange.prior : assignment
    ),
    pending
  };
}
