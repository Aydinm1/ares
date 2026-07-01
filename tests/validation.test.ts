import test from "node:test";
import assert from "node:assert/strict";
import {
  validateAssignmentCompletionWrite,
  validateAssignmentWrite,
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
  assert.throws(
    () => validateAssignmentCompletionWrite({ status: "graded" }),
    ValidationError
  );
  assert.throws(
    () => validateAssignmentCompletionWrite({ status: "submitted", title: "Do not mutate me" }),
    ValidationError
  );
  assert.throws(() => validateAssignmentCompletionWrite(null), ValidationError);
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
