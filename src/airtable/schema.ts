export const AIRTABLE_BASE_ID = "appVy9thv2l5e9JKv";

export const tables = {
  courses: { id: "tbl3nkjD0LefcY3t9", name: "Courses" },
  generalEducation: { id: "tbl3Beqraxljn1aDm", name: "General Education Requirements" },
  assignments: { id: "tbllXlXa7oKsoFMae", name: "Assignments" },
  gradeCategories: { id: "tblXC0Vug7xyPFZqW", name: "Category Weights" }
} as const;

export const fields = {
  courses: {
    name: "Course Name",
    status: "Status",
    quarterTaken: "Quarter Taken",
    grade: "Grade",
    majorRequirements: "Major Requirements",
    geRequirementsUsed: "GE Requirements Used",
    creditHours: "Credit Hours"
  },
  generalEducation: {
    category: "Category"
  },
  assignments: {
    title: "Assignment Name",
    course: "Courses",
    dueAt: "Due Date",
    pointsEarned: "Points Earned",
    pointsPossible: "Points Possible",
    completed: "Completed",
    gradeCategory: "Category Weights",
    typeLabel: "General Assignment Type",
    weekLabel: "Week"
  },
  gradeCategories: {
    name: "Category Weight Name",
    course: "Subject",
    weightPercent: "Weight (%)"
  }
} as const;

export function tableRef(key: keyof typeof tables): string {
  return tables[key].id;
}
