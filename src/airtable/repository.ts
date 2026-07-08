import type {
  Assignment,
  AssignmentUpdate,
  Course,
  Habit,
  HabitCheckIn,
  HabitUpdate,
  HabitWeek,
  InboxItem
} from "../domain/types.js";
import { AirtableClient } from "./client.js";
import {
  assignmentUpdateToAirtable,
  habitCheckInToAirtable,
  habitToAirtable,
  habitUpdateToAirtable,
  inboxItemToAirtable,
  mapAssignment,
  mapCourse,
  mapGeneralEducationRequirement,
  mapGradeCategory,
  mapHabit,
  mapHabitCheckIn,
  mapInboxItem
} from "./mappers.js";
import { fields, tableRef } from "./schema.js";

const READ_CACHE_TTL_MS = 30_000;

interface CacheEntry<T> {
  expiresAt: number;
  value: Promise<T>;
}

export interface ReadOptions {
  refresh?: boolean;
}

export class SchoolRepository {
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly client = new AirtableClient()) {}

  async listCourses(options: ReadOptions = {}): Promise<Course[]> {
    return this.readCached("courses", options, async () => {
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
    });
  }

  async listAssignments(options: ReadOptions = {}): Promise<Assignment[]> {
    return this.readCached("assignments", options, async () => {
      const records = await this.client.list<Record<string, unknown>>(tableRef("assignments"));
      return records.map(mapAssignment);
    });
  }

  async updateAssignment(recordId: string, update: AssignmentUpdate): Promise<Assignment> {
    const record = await this.client.update<Record<string, unknown>>(
      tableRef("assignments"),
      recordId,
      assignmentUpdateToAirtable(update)
    );
    this.invalidateAssignments();
    return mapAssignment(record);
  }

  invalidateAssignments(): void {
    this.cache.delete("assignments");
  }

  clearReadCache(): void {
    this.cache.clear();
  }

  async listInboxItems(): Promise<InboxItem[]> {
    const query = new URLSearchParams();
    query.set("filterByFormula", "NOT({Processed})");
    query.set("sort[0][field]", fields.inboxItems.createdAt);
    query.set("sort[0][direction]", "desc");
    const records = await this.client.list<Record<string, unknown>>(
      tableRef("inboxItems"),
      query
    );
    return records.map(mapInboxItem);
  }

  async createInboxItem(text: string): Promise<InboxItem> {
    const createdAt = new Date().toISOString();
    const record = await this.client.create<Record<string, unknown>>(
      tableRef("inboxItems"),
      inboxItemToAirtable(text, createdAt)
    );
    return mapInboxItem(record);
  }

  async deleteInboxItem(recordId: string): Promise<void> {
    await this.client.delete(tableRef("inboxItems"), recordId);
  }

  async listHabitWeek(weekStart: string, weekEnd: string): Promise<HabitWeek> {
    const habitQuery = new URLSearchParams();
    habitQuery.set("filterByFormula", `{${fields.habits.status}}="Active"`);
    habitQuery.set("sort[0][field]", fields.habits.createdAt);
    habitQuery.set("sort[0][direction]", "asc");
    const checkInQuery = new URLSearchParams();
    checkInQuery.set(
      "filterByFormula",
      `AND({${fields.habitCheckIns.date}}>="${weekStart}",{${fields.habitCheckIns.date}}<="${weekEnd}")`
    );
    const [habitRecords, checkInRecords] = await Promise.all([
      this.client.list<Record<string, unknown>>(tableRef("habits"), habitQuery),
      this.client.list<Record<string, unknown>>(tableRef("habitCheckIns"), checkInQuery)
    ]);
    const habits = habitRecords
      .map(mapHabit)
      .filter((habit) => habit.createdAt.slice(0, 10) <= weekEnd);
    const habitIds = new Set(habits.map((habit) => habit.id));
    return {
      habits,
      checkIns: checkInRecords.map(mapHabitCheckIn).filter((item) => habitIds.has(item.habitId)),
      weekStart,
      weekEnd
    };
  }

  async createHabit(name: string, targetDaysPerWeek: number): Promise<Habit> {
    const createdAt = new Date().toISOString();
    const record = await this.client.create<Record<string, unknown>>(
      tableRef("habits"),
      habitToAirtable(name, targetDaysPerWeek, createdAt)
    );
    return mapHabit(record);
  }

  async updateHabit(recordId: string, update: HabitUpdate): Promise<Habit> {
    const record = await this.client.update<Record<string, unknown>>(
      tableRef("habits"),
      recordId,
      habitUpdateToAirtable(update)
    );
    return mapHabit(record);
  }

  async setHabitCheckIn(habitId: string, date: string): Promise<HabitCheckIn> {
    const existing = await this.findHabitCheckIns(habitId, date);
    if (existing[0]) return mapHabitCheckIn(existing[0]);
    const createdAt = new Date().toISOString();
    const record = await this.client.create<Record<string, unknown>>(
      tableRef("habitCheckIns"),
      habitCheckInToAirtable(habitId, date, createdAt)
    );
    return mapHabitCheckIn(record);
  }

  async removeHabitCheckIn(habitId: string, date: string): Promise<void> {
    const records = await this.findHabitCheckIns(habitId, date);
    await Promise.all(
      records.map((record) => this.client.delete(tableRef("habitCheckIns"), record.id))
    );
  }

  private findHabitCheckIns(habitId: string, date: string) {
    const query = new URLSearchParams();
    query.set(
      "filterByFormula",
      `{${fields.habitCheckIns.key}}="${habitId}:${date}"`
    );
    return this.client.list<Record<string, unknown>>(tableRef("habitCheckIns"), query);
  }

  private readCached<T>(
    key: string,
    options: ReadOptions,
    load: () => Promise<T>
  ): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!options.refresh && cached && cached.expiresAt > now) {
      return cached.value;
    }

    const value = load().catch((error) => {
      if (this.cache.get(key)?.value === value) this.cache.delete(key);
      throw error;
    });
    this.cache.set(key, { expiresAt: now + READ_CACHE_TTL_MS, value });
    return value;
  }
}
