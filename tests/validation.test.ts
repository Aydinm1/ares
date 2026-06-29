import test from "node:test";
import assert from "node:assert/strict";
import {
  validateAssignmentCompletionWrite,
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
