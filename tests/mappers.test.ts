import test from "node:test";
import assert from "node:assert/strict";
import {
  assignmentCompletionToAirtable,
  assignmentUpdateToAirtable,
  habitCheckInToAirtable,
  habitToAirtable,
  habitUpdateToAirtable,
  inboxItemToAirtable,
  mapAssignment,
  mapCourse,
  mapGeneralEducationRequirement,
  mapHabit,
  mapHabitCheckIn,
  mapInboxItem
} from "../src/airtable/mappers.js";
import { fields } from "../src/airtable/schema.js";

test("maps course history fields from Airtable", () => {
  const course = mapCourse({
    id: "recCourse",
    fields: {
      [fields.courses.name]: "PHIL 101",
      [fields.courses.status]: "In Progress",
      [fields.courses.quarterTaken]: "Fall 2024",
      [fields.courses.grade]: "A-",
      [fields.courses.majorRequirements]: ["Cognitive Science"],
      [fields.courses.geRequirementsUsed]: ["recGE"],
      [fields.courses.creditHours]: 3
    }
  });

  assert.deepEqual(course, {
    id: "recCourse",
    name: "PHIL 101",
    status: "in_progress",
    quarterTaken: "Fall 2024",
    grade: "A-",
    majorRequirements: ["Cognitive Science"],
    geRequirementUsedIds: ["recGE"],
    creditHours: 3
  });
});

test("maps and serializes Inbox Items", () => {
  assert.deepEqual(
    mapInboxItem({
      id: "recInbox",
      fields: {
        [fields.inboxItems.text]: "Capture this",
        [fields.inboxItems.createdAt]: "2026-06-30T18:00:00.000Z",
        [fields.inboxItems.processed]: false
      }
    }),
    {
      id: "recInbox",
      text: "Capture this",
      createdAt: "2026-06-30T18:00:00.000Z",
      processed: false
    }
  );
  assert.deepEqual(
    inboxItemToAirtable("Capture this", "2026-06-30T18:00:00.000Z"),
    {
      [fields.inboxItems.text]: "Capture this",
      [fields.inboxItems.createdAt]: "2026-06-30T18:00:00.000Z",
      [fields.inboxItems.processed]: false
    }
  );
});

test("maps and serializes habits and dated check-ins", () => {
  assert.deepEqual(mapHabit({
    id: "recHabit",
    fields: {
      [fields.habits.name]: "Gym",
      [fields.habits.targetDaysPerWeek]: 4,
      [fields.habits.status]: "Active",
      [fields.habits.createdAt]: "2026-07-01T18:00:00.000Z",
      [fields.habits.sortOrder]: 1000
    }
  }), {
    id: "recHabit",
    name: "Gym",
    targetDaysPerWeek: 4,
    status: "active",
    createdAt: "2026-07-01T18:00:00.000Z",
    sortOrder: 1000
  });
  assert.deepEqual(
    habitToAirtable("Gym", 4, "2026-07-01T18:00:00.000Z", 1000),
    {
      [fields.habits.name]: "Gym",
      [fields.habits.targetDaysPerWeek]: 4,
      [fields.habits.status]: "Active",
      [fields.habits.createdAt]: "2026-07-01T18:00:00.000Z",
      [fields.habits.sortOrder]: 1000
    }
  );
  assert.deepEqual(habitUpdateToAirtable({ name: "Lift", status: "archived", sortOrder: 2000 }), {
    [fields.habits.name]: "Lift",
    [fields.habits.status]: "Archived",
    [fields.habits.sortOrder]: 2000
  });
  assert.deepEqual(mapHabitCheckIn({
    id: "recCheckIn",
    fields: {
      [fields.habitCheckIns.habit]: ["recHabit"],
      [fields.habitCheckIns.date]: "2026-07-01",
      [fields.habitCheckIns.createdAt]: "2026-07-01T18:00:00.000Z"
    }
  }), {
    id: "recCheckIn",
    habitId: "recHabit",
    date: "2026-07-01",
    createdAt: "2026-07-01T18:00:00.000Z"
  });
  assert.deepEqual(
    habitCheckInToAirtable("recHabit", "2026-07-01", "2026-07-01T18:00:00.000Z"),
    {
      [fields.habitCheckIns.key]: "recHabit:2026-07-01",
      [fields.habitCheckIns.habit]: ["recHabit"],
      [fields.habitCheckIns.date]: "2026-07-01",
      [fields.habitCheckIns.createdAt]: "2026-07-01T18:00:00.000Z"
    }
  );
});

test("maps readable general education requirement records", () => {
  assert.deepEqual(
    mapGeneralEducationRequirement({
      id: "recGE",
      fields: { [fields.generalEducation.category]: "Arts & Humanities (AH)" }
    }),
    { id: "recGE", category: "Arts & Humanities (AH)" }
  );
});

test("maps Airtable assignment completion and category", () => {
  const assignment = mapAssignment({
    id: "recAssignment",
    createdTime: "2026-06-09T01:00:00.000Z",
    fields: {
      [fields.assignments.title]: "Problem Set 1",
      [fields.assignments.course]: ["recCourse"],
      [fields.assignments.completed]: true,
      [fields.assignments.hiddenFromList]: true,
      [fields.assignments.typeLabel]: "Problem Set"
    }
  });

  assert.equal(assignment.status, "submitted");
  assert.equal(assignment.category, "problem_set");
  assert.equal(assignment.courseId, "recCourse");
  assert.equal(assignment.hiddenFromList, true);
});

test("maps unchecked and empty assignment checkboxes as not started", () => {
  for (const completed of [false, undefined]) {
    const assignment = mapAssignment({
      id: "recAssignment",
      fields: {
        [fields.assignments.title]: "Problem Set 1",
        ...(completed === undefined ? {} : { [fields.assignments.completed]: completed })
      }
    });

    assert.equal(assignment.status, "not_started");
  }
});

test("serializes completion-only writes in both directions", () => {
  assert.deepEqual(assignmentCompletionToAirtable("submitted"), {
    [fields.assignments.completed]: true
  });
  assert.deepEqual(assignmentCompletionToAirtable("not_started"), {
    [fields.assignments.completed]: false
  });
});

test("serializes editable assignment fields without touching omitted fields", () => {
  assert.deepEqual(
    assignmentUpdateToAirtable({
      title: "Revised essay",
      courseId: "recCourse",
      dueAt: null,
      pointsPossible: 25,
      weekLabel: null,
      hiddenFromList: true
    }),
    {
      [fields.assignments.title]: "Revised essay",
      [fields.assignments.course]: ["recCourse"],
      [fields.assignments.dueAt]: null,
      [fields.assignments.pointsPossible]: 25,
      [fields.assignments.weekLabel]: null,
      [fields.assignments.hiddenFromList]: true
    }
  );
  assert.deepEqual(assignmentUpdateToAirtable({ courseId: null }), {
    [fields.assignments.course]: []
  });
});
