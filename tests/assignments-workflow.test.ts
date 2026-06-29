import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Assignment, Course } from "../src/domain/types.js";
import {
  beginCompletionChange,
  buildAssignmentRowViewModels,
  buildMonthGrid,
  formatLastSyncedLabel,
  commitCompletionChange,
  courseColor,
  createOptimisticCompletionState,
  filterAssignments,
  getDueState,
  groupAssignmentsByLocalDate,
  isSameLocalMonth,
  localDateKey,
  millisecondsUntilNextLocalDay,
  monthForToday,
  rollbackCompletionChange,
  shiftMonth,
  sortAssignments
} from "../src/assignments/index.js";

const courses: Course[] = [
  { id: "course-z", name: "Zoology" },
  { id: "course-a", name: "Art" }
];

function assignment(
  id: string,
  overrides: Partial<Assignment> = {}
): Assignment {
  return {
    id,
    title: id,
    status: "not_started",
    category: "other",
    ...overrides
  };
}

describe("assignment filtering and ordering", () => {
  const values = [
    assignment("undated", { courseId: "course-z" }),
    assignment("done", {
      courseId: "course-a",
      dueAt: "2026-06-01T10:00:00",
      status: "submitted"
    }),
    assignment("z-title", {
      title: "Zebra",
      courseId: "course-a",
      dueAt: "2026-06-02T10:00:00"
    }),
    assignment("a-title", {
      title: "Alpha",
      courseId: "course-a",
      dueAt: "2026-06-02T10:00:00"
    }),
    assignment("other-course", {
      title: "Alpha",
      courseId: "course-z",
      dueAt: "2026-06-02T10:00:00"
    })
  ];

  it("combines all/course and completed filters", () => {
    assert.deepEqual(
      filterAssignments(values, { courseId: "all", hideCompleted: true }).map(({ id }) => id),
      ["undated", "z-title", "a-title", "other-course"]
    );
    assert.deepEqual(
      filterAssignments(values, { courseId: "course-a", hideCompleted: false }).map(({ id }) => id),
      ["done", "z-title", "a-title"]
    );
  });

  it("sorts dates, tied course/title values, and undated work", () => {
    assert.deepEqual(
      sortAssignments(values, courses).map(({ id }) => id),
      ["done", "a-title", "z-title", "other-course", "undated"]
    );
  });
});

describe("local date workflow", () => {
  it("labels deadlines across day and year boundaries", () => {
    const now = new Date(2026, 11, 31, 12);
    assert.deepEqual(getDueState(new Date(2026, 11, 30, 23).toISOString(), now), {
      dueLabel: "Overdue",
      dueTone: "overdue"
    });
    assert.equal(getDueState(new Date(2026, 11, 31, 0).toISOString(), now).dueLabel, "Due today");
    assert.equal(getDueState(new Date(2027, 0, 1, 0).toISOString(), now).dueLabel, "Due tomorrow");
    assert.equal(getDueState(new Date(2027, 0, 4, 0).toISOString(), now).dueLabel, "Due in 4 days");
    assert.equal(getDueState(undefined, now).dueTone, "undated");
    assert.equal(getDueState("invalid", now).dueLabel, "No due date");
  });

  it("uses the minimum complete five- or six-week month grid", () => {
    for (let month = 0; month < 12; month += 1) {
      const grid = buildMonthGrid(new Date(2026, month, 1));
      const firstDay = new Date(2026, month, 1).getDay();
      const daysInMonth = new Date(2026, month + 1, 0).getDate();
      assert.equal(grid.length, firstDay + daysInMonth <= 35 ? 35 : 42);
      assert.equal(grid[0]?.date.getDay(), 0);
      assert.equal(grid.at(-1)?.date.getDay(), 6);
      assert.equal(grid.filter(({ inMonth }) => inMonth).length, new Date(2026, month + 1, 0).getDate());
    }
    assert.equal(buildMonthGrid(new Date(2026, 5, 1)).length, 35);
    assert.equal(buildMonthGrid(new Date(2026, 7, 1)).length, 42);
  });

  it("formats relative Airtable synchronization timestamps", () => {
    const now = new Date("2026-06-28T12:00:00.000Z");
    assert.equal(formatLastSyncedLabel(new Date("2026-06-28T11:59:45.000Z"), now), "Last synced just now");
    assert.equal(formatLastSyncedLabel(new Date("2026-06-28T11:48:00.000Z"), now), "Last synced 12m ago");
    assert.equal(formatLastSyncedLabel(new Date("2026-06-28T09:30:00.000Z"), now), "Last synced 2h ago");
    assert.equal(formatLastSyncedLabel(new Date("2026-06-26T09:30:00.000Z"), now), "Last synced 2d ago");
  });

  it("handles leap-year February and month navigation", () => {
    const grid = buildMonthGrid(new Date(2028, 1, 18));
    assert.equal(grid.filter(({ inMonth }) => inMonth).length, 29);
    assert.equal(localDateKey(shiftMonth(new Date(2028, 0, 31), 1)), "2028-02-01");
    assert.equal(localDateKey(monthForToday(new Date(2028, 6, 20))), "2028-07-01");
    assert.equal(isSameLocalMonth(new Date(2028, 6, 1), new Date(2028, 6, 31)), true);
    assert.equal(isSameLocalMonth(new Date(2028, 6, 31), new Date(2028, 7, 1)), false);
  });

  it("schedules local date refresh just after midnight", () => {
    const now = new Date(2026, 5, 8, 23, 59, 30, 0);
    assert.equal(millisecondsUntilNextLocalDay(now), 30_100);
  });

  it("groups UTC timestamps by the runtime's local date", () => {
    const instant = "2026-07-01T01:00:00.000Z";
    const expectedKey = localDateKey(new Date(instant));
    const grouped = groupAssignmentsByLocalDate([
      assignment("utc", { dueAt: instant }),
      assignment("bad", { dueAt: "not-a-date" })
    ]);
    assert.deepEqual(grouped[expectedKey]?.map(({ id }) => id), ["utc"]);
    assert.equal(Object.values(grouped).flat().length, 1);
  });
});

describe("row view models and colors", () => {
  it("keeps course colors stable and handles missing links", () => {
    assert.equal(courseColor("course-a"), courseColor("course-a"));
    assert.notEqual(courseColor("course-a"), "#64748B");
    assert.equal(courseColor(undefined), "#64748B");

    const rows = buildAssignmentRowViewModels(
      [
        assignment("known", { courseId: "course-a", status: "submitted" }),
        assignment("missing", { courseId: "absent" })
      ],
      courses,
      new Date(2026, 0, 1)
    );
    assert.equal(rows[0]?.course?.name, "Art");
    assert.equal(rows[0]?.completed, true);
    assert.equal(rows[1]?.course, undefined);
  });
});

describe("optimistic completion", () => {
  it("commits the authoritative server assignment", () => {
    const original = assignment("a", { notes: "prior" });
    const started = beginCompletionChange(createOptimisticCompletionState([original]), "a", true);
    assert.equal(started.state.assignments[0]?.status, "submitted");

    const server = { ...original, status: "submitted" as const, updatedAt: "server" };
    const committed = commitCompletionChange(started.state, started.mutation, server);
    assert.equal(committed.assignments[0], server);
    assert.equal(committed.pending.a, undefined);
  });

  it("rolls back to the exact prior object", () => {
    const original = assignment("a", { status: "in_progress", notes: "retain me" });
    const started = beginCompletionChange(createOptimisticCompletionState([original]), "a", true);
    const rolledBack = rollbackCompletionChange(started.state, started.mutation);
    assert.equal(rolledBack.assignments[0], original);
  });

  it("ignores stale success and failure after a rapid second toggle", () => {
    const original = assignment("a");
    const first = beginCompletionChange(createOptimisticCompletionState([original]), "a", true);
    const second = beginCompletionChange(first.state, "a", false);

    const staleSuccess = commitCompletionChange(
      second.state,
      first.mutation,
      { ...original, status: "submitted" }
    );
    assert.equal(staleSuccess, second.state);
    assert.equal(staleSuccess.assignments[0]?.status, "not_started");
    assert.equal(rollbackCompletionChange(staleSuccess, first.mutation), staleSuccess);
  });
});
