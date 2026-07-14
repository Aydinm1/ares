import test from "node:test";
import assert from "node:assert/strict";
import {
  validateAssignmentCompletionWrite,
  validateAssignmentWrite,
  validateCompetencyCreate,
  validateCompetencyFocusCreate,
  validateCompetencyFocusUpdate,
  validateCompetencyOrder,
  validateCompetencyUpdate,
  validateHabitCreate,
  validateHabitCheckInDate,
  validateHabitDate,
  validateHabitOrder,
  validateHabitUpdate,
  validateHabitWeekStart,
  validateInboxCapture,
  ValidationError
} from "../src/validation/domain.js";

test("accepts only completion statuses and rejects extra fields", () => {
  assert.equal(
    validateAssignmentCompletionWrite({ status: "submitted" }),
    "submitted"
  );
  assert.equal(
    validateAssignmentCompletionWrite({ status: "not_started" }),
    "not_started"
  );
  assert.deepEqual(validateAssignmentWrite({ hiddenFromList: true }), {
    hiddenFromList: true
  });
  assert.throws(
    () => validateAssignmentCompletionWrite({ status: "graded" }),
    ValidationError
  );
  assert.throws(
    () => validateAssignmentCompletionWrite({ status: "submitted", title: "Do not mutate me" }),
    ValidationError
  );
  assert.throws(() => validateAssignmentWrite({ hiddenFromList: "true" }), ValidationError);
  assert.throws(() => validateAssignmentCompletionWrite(null), ValidationError);
});

test("validates low-friction Inbox captures", () => {
  assert.equal(validateInboxCapture({ text: "  Remember this  " }), "Remember this");
  for (const value of [
    null,
    {},
    { text: "   " },
    { text: "Valid", processed: true },
    { text: "x".repeat(2001) }
  ]) {
    assert.throws(() => validateInboxCapture(value), ValidationError);
  }
});

test("validates habit definitions and week dates", () => {
  assert.deepEqual(
    validateHabitCreate({ name: "  Gym  ", targetDaysPerWeek: 4 }),
    { name: "Gym", targetDaysPerWeek: 4 }
  );
  assert.deepEqual(validateHabitUpdate({ targetDaysPerWeek: 7 }), {
    targetDaysPerWeek: 7
  });
  assert.deepEqual(validateHabitUpdate({ status: "archived" }), {
    status: "archived"
  });
  assert.deepEqual(validateHabitUpdate({ sortOrder: 1000 }), {
    sortOrder: 1000
  });
  assert.deepEqual(validateHabitOrder({
    habitIds: ["recHabit000000000", "recOther000000000"]
  }), ["recHabit000000000", "recOther000000000"]);
  assert.equal(validateHabitDate("2026-07-01"), "2026-07-01");
  assert.equal(
    validateHabitCheckInDate("2026-07-01", new Date("2026-07-01T20:00:00.000Z")),
    "2026-07-01"
  );
  assert.equal(validateHabitWeekStart("2026-06-29"), "2026-06-29");
  for (const value of [
    {},
    { name: "", targetDaysPerWeek: 4 },
    { name: "Gym", targetDaysPerWeek: 0 },
    { name: "Gym", targetDaysPerWeek: 8 },
    { name: "Gym", targetDaysPerWeek: 4.5 },
    { name: "Gym", targetDaysPerWeek: 4, status: "active" },
    { name: "Gym", targetDaysPerWeek: 4, sortOrder: 1000 }
  ]) {
    assert.throws(() => validateHabitCreate(value), ValidationError);
  }
  assert.throws(() => validateHabitUpdate({ status: "paused" }), ValidationError);
  assert.throws(() => validateHabitUpdate({ sortOrder: -1 }), ValidationError);
  assert.throws(() => validateHabitOrder({ habitIds: ["recHabit000000000", "recHabit000000000"] }), ValidationError);
  assert.throws(() => validateHabitOrder({ habitIds: ["bad"] }), ValidationError);
  assert.throws(() => validateHabitDate("2026-02-30"), ValidationError);
  assert.throws(
    () => validateHabitCheckInDate("2026-07-02", new Date("2026-07-01T20:00:00.000Z")),
    ValidationError
  );
  assert.throws(() => validateHabitWeekStart("2026-07-01"), ValidationError);
});

test("validates competencies and focus timelines", () => {
  assert.deepEqual(validateCompetencyCreate({
    name: "  Piano  ",
    category: "Creative",
    vision: "Play expressively."
  }), {
    name: "Piano",
    category: "Creative",
    vision: "Play expressively.",
    description: undefined
  });
  assert.deepEqual(validateCompetencyUpdate({ status: "dormant", vision: null }), {
    status: "dormant",
    vision: null
  });
  assert.deepEqual(validateCompetencyOrder({
    competencyIds: ["recSkill000000000", "recOther000000000"]
  }), ["recSkill000000000", "recOther000000000"]);
  assert.deepEqual(validateCompetencyFocusCreate({
    title: "  Chord Vocabulary  ",
    startedAt: "2026-07-13",
    notes: "ii-V-I"
  }), {
    title: "Chord Vocabulary",
    startedAt: "2026-07-13",
    notes: "ii-V-I"
  });
  assert.deepEqual(validateCompetencyFocusUpdate({
    endedAt: "2026-09-18",
    endReason: "Ready to shift."
  }), {
    endedAt: "2026-09-18",
    endReason: "Ready to shift."
  });
  for (const value of [
    {},
    { name: "", category: "Creative" },
    { name: "Piano", status: "current" },
    { name: "Piano", sortOrder: 1000 }
  ]) {
    assert.throws(() => validateCompetencyCreate(value), ValidationError);
  }
  assert.throws(() => validateCompetencyUpdate({ status: "active" }), ValidationError);
  assert.throws(() => validateCompetencyOrder({ competencyIds: ["bad"] }), ValidationError);
  assert.throws(() => validateCompetencyFocusCreate({ title: "Piano", startedAt: "2026-02-30" }), ValidationError);
  assert.throws(() => validateCompetencyFocusCreate({ title: "Piano", startedAt: "2026-07-13", endedAt: "2026-07-14" }), ValidationError);
  assert.throws(() => validateCompetencyFocusUpdate({ startedAt: "2026-09-18", endedAt: "2026-07-13" }), ValidationError);
});

test("validates and normalizes editable assignment fields", () => {
  assert.deepEqual(
    validateAssignmentWrite({
      title: "  Revised essay  ",
      courseId: "rec12345678901234",
      dueDate: "2026-07-03",
      dueTime: "",
      pointsPossible: 20,
      weekLabel: "2"
    }),
    {
      title: "Revised essay",
      courseId: "rec12345678901234",
      dueAt: "2026-07-04T06:59:00.000Z",
      pointsPossible: 20,
      weekLabel: "2"
    }
  );
  assert.deepEqual(validateAssignmentWrite({ dueDate: null }), { dueAt: null });
  assert.equal(
    validateAssignmentWrite({
      dueDate: "2026-12-15",
      dueTime: "09:30"
    }).dueAt,
    "2026-12-15T17:30:00.000Z"
  );
});

test("rejects invalid assignment updates", () => {
  for (const value of [
    {},
    { unknown: true },
    { title: " " },
    { courseId: "course-a" },
    { pointsPossible: -1 },
    { weekLabel: "11" },
    { dueDate: "2026-02-30" },
    { dueTime: "09:00" },
    { dueDate: null, dueTime: "09:00" }
  ]) {
    assert.throws(() => validateAssignmentWrite(value), ValidationError);
  }
});
