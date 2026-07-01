import type { Assignment, AssignmentUpdate, Course } from "../domain/types.js";
import { AirtableClient } from "./client.js";
import {
  assignmentUpdateToAirtable,
  mapAssignment,
  mapCourse,
  mapGeneralEducationRequirement,
  mapGradeCategory
} from "./mappers.js";
import { tableRef } from "./schema.js";

export class SchoolRepository {
  constructor(private readonly client = new AirtableClient()) {}

  async listCourses(): Promise<Course[]> {
    const [courseRecords, categoryRecords, generalEducationRecords] = await Promise.all([
      this.client.list<Record<string, unknown>>(tableRef("courses")),
      this.client.list<Record<string, unknown>>(tableRef("gradeCategories")),
      this.client.list<Record<string, unknown>>(tableRef("generalEducation"))
    ]);
    const categories = categoryRecords.map(mapGradeCategory);
    const generalEducationById = new Map(
      generalEducationRecords
        .map(mapGeneralEducationRequirement)
        .map((requirement) => [requirement.id, requirement])
    );

    return courseRecords.map((record) => {
      const course = mapCourse(record);
      const courseCategories = categories.filter((category) => category.courseId === course.id);
      return {
        ...course,
        geRequirementsUsed: course.geRequirementUsedIds?.flatMap((id) => {
          const requirement = generalEducationById.get(id);
          return requirement ? [requirement] : [];
        }),
        gradePolicy: {
          courseId: course.id,
          categories: courseCategories,
          usesWeightedCategories: courseCategories.length > 0
        }
      };
    });
  }

  async listAssignments(): Promise<Assignment[]> {
    const records = await this.client.list<Record<string, unknown>>(tableRef("assignments"));
    return records.map(mapAssignment);
  }

  async updateAssignment(recordId: string, update: AssignmentUpdate): Promise<Assignment> {
    const record = await this.client.update<Record<string, unknown>>(
      tableRef("assignments"),
      recordId,
      assignmentUpdateToAirtable(update)
    );
    return mapAssignment(record);
  }
}
