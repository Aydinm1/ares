import test from "node:test";
import assert from "node:assert/strict";
import { SchoolRepository } from "../src/airtable/repository.js";
import { fields, tableRef } from "../src/airtable/schema.js";
import {
  ACADEMIC_YEARS,
  COURSE_HISTORY_QUARTERS,
  courseGpa,
  courseGradeLabel,
  coursesForAcademicYear,
  coursesForQuarter,
  quarterUnitTotal
} from "../src/courses/history.js";
import type { Course } from "../src/domain/types.js";

test("course listing resolves GE links into readable requirement labels", async () => {
  const client = {
    async list(table: string) {
      if (table === tableRef("courses")) {
        return [{
          id: "recCourse",
          fields: {
            [fields.courses.name]: "PHI 010",
            [fields.courses.quarterTaken]: "Fall 2024",
            [fields.courses.geRequirementsUsed]: ["recGE"]
          }
        }];
      }
      if (table === tableRef("generalEducation")) {
        return [{
          id: "recGE",
          fields: { [fields.generalEducation.category]: "Scientific Literacy (SL)" }
        }];
      }
      return [];
    }
  };

  const [course] = await new SchoolRepository(client as never).listCourses();
  assert.equal(course?.quarterTaken, "Fall 2024");
  assert.deepEqual(course?.geRequirementsUsed, [
    { id: "recGE", category: "Scientific Literacy (SL)" }
  ]);
});

test("course history filters exact quarters, totals units, and formats grades", () => {
  const courses: Course[] = [
    { id: "b", name: "BIO", quarterTaken: "Fall 2024", creditHours: 5, grade: "A", status: "completed" },
    { id: "a", name: "AHI", quarterTaken: "Fall 2024", creditHours: 4, grade: "B+", status: "completed" },
    { id: "c", name: "MAT", quarterTaken: "Summer 2026", creditHours: 4, status: "in_progress" }
  ];
  const fall = coursesForQuarter(courses, "Fall 2024");
  assert.deepEqual(fall.map(({ id }) => id), ["a", "b"]);
  assert.equal(quarterUnitTotal(fall), 9);
  assert.equal(courseGpa(fall)?.toFixed(2), "3.69");
  assert.equal(courseGpa([courses[2]!] as Course[]), undefined);
  assert.equal(courseGradeLabel(fall[0]!), "B+");
  assert.equal(courseGradeLabel(courses[2]!), "In progress");
  assert.equal(courseGradeLabel({ id: "d", name: "Unknown" }), "—");
});

test("course history defines 13 chronological quarters across four academic years", () => {
  assert.equal(COURSE_HISTORY_QUARTERS.length, 13);
  assert.equal(ACADEMIC_YEARS.length, 4);
  assert.deepEqual(ACADEMIC_YEARS.map(({ quarters }) => quarters.length), [3, 4, 3, 3]);
  assert.deepEqual(ACADEMIC_YEARS.flatMap(({ quarters }) => quarters), COURSE_HISTORY_QUARTERS);
  assert.equal(
    coursesForAcademicYear(
      [
        { id: "fall", name: "Fall", quarterTaken: "Fall 2025" },
        { id: "summer", name: "Summer", quarterTaken: "Summer 2026" },
        { id: "other", name: "Other", quarterTaken: "Fall 2027" }
      ],
      ACADEMIC_YEARS[1]!.quarters
    ).length,
    2
  );
});
