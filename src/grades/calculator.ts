import type { Assignment, Course, GradeCategory } from "../domain/types.js";

export interface GradeComponentResult {
  category: GradeCategory;
  assignments: Assignment[];
  pointsEarned?: number;
  pointsPossible?: number;
  percent?: number;
  weightedEarned?: number;
  isComplete: boolean;
  isExtraCredit: boolean;
}

export interface CourseGradeSummary {
  course: Course;
  categories: GradeCategory[];
  components: GradeComponentResult[];
  requiredWeightPercent: number;
  completedRequiredWeightPercent: number;
  currentPercent?: number;
  earnedFinalPercent: number;
  projectedFinalPercent: number;
  extraCreditEarnedPercent: number;
  extraCreditCapPercent: number;
  warnings: string[];
}

export interface ProjectionOverrides {
  assignmentPercents?: Record<string, number | undefined>;
}

export function calculateCourseGrade(
  course: Course,
  assignments: Assignment[],
  categories: GradeCategory[],
  overrides: ProjectionOverrides = {}
): CourseGradeSummary {
  const courseCategories = categories.filter((category) => category.courseId === course.id);
  const courseAssignments = assignments.filter((assignment) => assignment.courseId === course.id);
  const assignmentsByCategory = new Map<string, Assignment[]>();
  for (const assignment of courseAssignments) {
    if (!assignment.categoryId) continue;
    assignmentsByCategory.set(assignment.categoryId, [
      ...(assignmentsByCategory.get(assignment.categoryId) ?? []),
      assignment
    ]);
  }

  const components = courseCategories.map((category) =>
    calculateComponent(category, assignmentsByCategory.get(category.id) ?? [], overrides)
  );
  const requiredComponents = components.filter((component) => !component.isExtraCredit);
  const extraCreditComponents = components.filter((component) => component.isExtraCredit);
  const requiredWeightPercent = roundOne(
    requiredComponents.reduce((total, component) => total + component.category.weightPercent, 0)
  );
  const completedRequiredWeightPercent = roundOne(
    requiredComponents.reduce(
      (total, component) => total + (component.isComplete ? component.category.weightPercent : 0),
      0
    )
  );
  const earnedRequiredFinalPercent = requiredComponents.reduce(
    (total, component) => total + (component.weightedEarned ?? 0),
    0
  );
  const extraCreditCapPercent = extraCreditComponents.reduce(
    (total, component) =>
      total + (component.category.maxExtraCreditPercent ?? component.category.weightPercent),
    0
  );
  const extraCreditEarnedPercent = Math.min(
    extraCreditCapPercent,
    extraCreditComponents.reduce((total, component) => total + (component.weightedEarned ?? 0), 0)
  );
  const projectedRequiredFinalPercent = requiredComponents.reduce((total, component) => {
    if (component.weightedEarned !== undefined) return total + component.weightedEarned;
    const projected = projectedPercentForComponent(component, overrides);
    return total + (projected / 100) * component.category.weightPercent;
  }, 0);

  return {
    course,
    categories: courseCategories,
    components,
    requiredWeightPercent,
    completedRequiredWeightPercent,
    currentPercent:
      completedRequiredWeightPercent > 0
        ? roundOne((earnedRequiredFinalPercent / completedRequiredWeightPercent) * 100)
        : undefined,
    earnedFinalPercent: roundOne(earnedRequiredFinalPercent + extraCreditEarnedPercent),
    projectedFinalPercent: roundOne(projectedRequiredFinalPercent + extraCreditEarnedPercent),
    extraCreditEarnedPercent: roundOne(extraCreditEarnedPercent),
    extraCreditCapPercent: roundOne(extraCreditCapPercent),
    warnings: gradeWarnings(courseAssignments, courseCategories, components, requiredWeightPercent)
  };
}

function calculateComponent(
  category: GradeCategory,
  assignments: Assignment[],
  overrides: ProjectionOverrides
): GradeComponentResult {
  const isExtraCredit = category.calculationType === "extra_credit";
  const scoredAssignments = assignments.filter(
    (assignment) =>
      assignment.pointsEarned !== undefined &&
      assignment.pointsPossible !== undefined &&
      assignment.pointsPossible > 0
  );
  const pointsEarned = scoredAssignments.reduce(
    (total, assignment) => total + (assignment.pointsEarned ?? 0),
    0
  );
  const pointsPossible = scoredAssignments.reduce(
    (total, assignment) => total + (assignment.pointsPossible ?? 0),
    0
  );
  const percent =
    pointsPossible > 0
      ? Math.min(100, Math.max(0, (pointsEarned / pointsPossible) * 100))
      : undefined;
  const overridePercent = aggregateOverridePercent(assignments, overrides);
  const effectivePercent = percent ?? overridePercent;
  const cap = category.maxExtraCreditPercent ?? category.weightPercent;
  const weightedEarned =
    effectivePercent !== undefined
      ? (effectivePercent / 100) * (isExtraCredit ? cap : category.weightPercent)
      : undefined;

  return {
    category,
    assignments,
    pointsEarned: pointsPossible > 0 ? pointsEarned : undefined,
    pointsPossible: pointsPossible > 0 ? pointsPossible : undefined,
    percent: percent === undefined ? undefined : roundOne(percent),
    weightedEarned: weightedEarned === undefined ? undefined : roundOne(weightedEarned),
    isComplete: percent !== undefined,
    isExtraCredit
  };
}

function aggregateOverridePercent(
  assignments: Assignment[],
  overrides: ProjectionOverrides
): number | undefined {
  const values = assignments
    .map((assignment) => overrides.assignmentPercents?.[assignment.id])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) return undefined;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function projectedPercentForComponent(
  component: GradeComponentResult,
  overrides: ProjectionOverrides
): number {
  const override = aggregateOverridePercent(component.assignments, overrides);
  if (override !== undefined) return override;
  return 0;
}

function gradeWarnings(
  assignments: Assignment[],
  categories: GradeCategory[],
  components: GradeComponentResult[],
  requiredWeightPercent: number
): string[] {
  const warnings: string[] = [];
  if (categories.length === 0) {
    warnings.push("No grade categories are configured for this course.");
  }
  if (requiredWeightPercent !== 100) {
    warnings.push(`Required category weights total ${requiredWeightPercent}%, not 100%.`);
  }
  for (const component of components) {
    if (
      !component.isExtraCredit &&
      component.category.weightPercent > 0 &&
      component.assignments.length === 0
    ) {
      warnings.push(`${component.category.name} has no linked assignments.`);
    }
    for (const assignment of component.assignments) {
      if (assignment.pointsEarned !== undefined && !assignment.pointsPossible) {
        warnings.push(`${assignment.title} has points earned but no points possible.`);
      }
    }
  }
  const categoryIds = new Set(categories.map((category) => category.id));
  const uncategorized = assignments.filter(
    (assignment) =>
      assignment.pointsPossible !== undefined &&
      assignment.pointsPossible > 0 &&
      (!assignment.categoryId || !categoryIds.has(assignment.categoryId))
  );
  if (uncategorized.length) {
    warnings.push(`${uncategorized.length} graded assignment(s) have no matching category.`);
  }
  return warnings;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}
