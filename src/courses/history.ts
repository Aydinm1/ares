import type { Course } from "../domain/types.js";

export const COURSE_HISTORY_QUARTERS = [
  "Fall 2024",
  "Winter 2025",
  "Spring 2025",
  "Fall 2025",
  "Winter 2026",
  "Spring 2026",
  "Summer 2026",
  "Fall 2026",
  "Winter 2027",
  "Spring 2027",
  "Fall 2027",
  "Winter 2028",
  "Spring 2028"
] as const;

export type CourseHistoryQuarter = (typeof COURSE_HISTORY_QUARTERS)[number];

export const ACADEMIC_YEARS: ReadonlyArray<{
  label: string;
  quarters: readonly CourseHistoryQuarter[];
}> = [
  { label: "Year 1", quarters: ["Fall 2024", "Winter 2025", "Spring 2025"] },
  { label: "Year 2", quarters: ["Fall 2025", "Winter 2026", "Spring 2026", "Summer 2026"] },
  { label: "Year 3", quarters: ["Fall 2026", "Winter 2027", "Spring 2027"] },
  { label: "Year 4", quarters: ["Fall 2027", "Winter 2028", "Spring 2028"] }
];

export function coursesForQuarter(
  courses: readonly Course[],
  quarter: CourseHistoryQuarter
): Course[] {
  return courses
    .filter((course) => course.quarterTaken === quarter)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function quarterUnitTotal(courses: readonly Course[]): number {
  return courses.reduce((total, course) => total + (course.creditHours ?? 0), 0);
}

export function coursesForAcademicYear(
  courses: readonly Course[],
  quarters: readonly CourseHistoryQuarter[]
): Course[] {
  const quarterSet = new Set<string>(quarters);
  return courses.filter((course) => course.quarterTaken && quarterSet.has(course.quarterTaken));
}

export function courseGradeLabel(course: Course): string {
  if (course.grade) return course.grade;
  if (course.status === "in_progress") return "In progress";
  return "—";
}
