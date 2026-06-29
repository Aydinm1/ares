import test from "node:test";
import assert from "node:assert/strict";
import {
  assignmentCompletionToAirtable,
  mapAssignment,
  mapCourse,
  mapGeneralEducationRequirement
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
      [fields.assignments.typeLabel]: "Problem Set"
    }
  });

  assert.equal(assignment.status, "submitted");
  assert.equal(assignment.category, "problem_set");
  assert.equal(assignment.courseId, "recCourse");
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
