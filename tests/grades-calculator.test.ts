import test from "node:test";
import assert from "node:assert/strict";
import { calculateCourseGrade } from "../src/grades/calculator.js";
import type { Assignment, Course, GradeCategory } from "../src/domain/types.js";

const course: Course = {
  id: "recCourse00000000",
  name: "PSC 141",
  status: "in_progress"
};

const categories: GradeCategory[] = [
  required("recExam100000000", "Exam 1", 25),
  required("recExam200000000", "Exam 2", 25),
  required("recSummary000000", "Selection and Summary Assignment", 10),
  required("recPaper00000000", "Background Paper", 20),
  required("recAdvice0000000", "Advice Column", 16),
  required("recWorkshop00000", "Workshops", 4),
  {
    id: "recExtra00000000",
    courseId: course.id,
    name: "Extra Credit",
    weightPercent: 0,
    calculationType: "extra_credit",
    maxExtraCreditPercent: 3
  }
];

test("calculates full PSC 141 required and capped extra credit grade", () => {
  const summary = calculateCourseGrade(course, [
    assignment("Exam 1", "recExam100000000", 23, 25),
    assignment("Exam 2", "recExam200000000", 24, 25),
    assignment("Selection", "recSummary000000", 10, 10),
    assignment("Background", "recPaper00000000", 18, 20),
    assignment("Advice", "recAdvice0000000", 15, 16),
    assignment("Workshops", "recWorkshop00000", 4, 4),
    assignment("Extra", "recExtra00000000", 5, 3)
  ], categories);

  assert.equal(summary.requiredWeightPercent, 100);
  assert.equal(summary.completedRequiredWeightPercent, 100);
  assert.equal(summary.currentPercent, 94);
  assert.equal(summary.extraCreditEarnedPercent, 3);
  assert.equal(summary.earnedFinalPercent, 97);
  assert.equal(summary.projectedFinalPercent, 97);
  assert.deepEqual(summary.warnings, []);
});

test("normalizes current grade over completed required weight", () => {
  const summary = calculateCourseGrade(course, [
    assignment("Exam 1", "recExam100000000", 20, 25),
    assignment("Selection", "recSummary000000", 10, 10)
  ], categories);

  assert.equal(summary.completedRequiredWeightPercent, 35);
  assert.equal(summary.currentPercent, 85.7);
  assert.equal(summary.earnedFinalPercent, 30);
  assert.equal(summary.projectedFinalPercent, 30);
});

test("warns when required weights do not total 100", () => {
  const summary = calculateCourseGrade(course, [], [
    required("recOnly00000000", "Only", 50)
  ]);

  assert.deepEqual(summary.warnings, [
    "Required category weights total 50%, not 100%.",
    "Only has no linked assignments."
  ]);
});

function required(id: string, name: string, weightPercent: number): GradeCategory {
  return {
    id,
    courseId: course.id,
    name,
    weightPercent,
    calculationType: "required"
  };
}

function assignment(
  title: string,
  categoryId: string,
  pointsEarned: number,
  pointsPossible: number
): Assignment {
  return {
    id: `rec${title.replace(/[^A-Za-z0-9]/g, "").padEnd(14, "0").slice(0, 14)}`,
    title,
    courseId: course.id,
    status: "submitted",
    category: "other",
    categoryId,
    pointsEarned,
    pointsPossible
  };
}
