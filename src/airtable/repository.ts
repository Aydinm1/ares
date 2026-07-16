import type {
  Assignment,
  AssignmentUpdate,
  Competency,
  CompetencyFocus,
  CompetencyFocusUpdate,
  CompetencyOverview,
  CompetencyUpdate,
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
  competencyFocusToAirtable,
  competencyFocusUpdateToAirtable,
  competencyToAirtable,
  competencyUpdateToAirtable,
  habitCheckInToAirtable,
  habitToAirtable,
  habitUpdateToAirtable,
  inboxItemToAirtable,
  mapAssignment,
  mapCompetency,
  mapCompetencyFocus,
  mapCourse,
  mapGeneralEducationRequirement,
  mapGradeCategory,
  mapHabit,
  mapHabitCheckIn,
  mapInboxItem
} from "./mappers.js";
import { fields, tableRef } from "./schema.js";

const READ_CACHE_TTL_MS = 30_000;
const HABIT_ORDER_STEP = 1000;
const COMPETENCY_ORDER_STEP = 1000;

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

  async deleteAssignment(recordId: string): Promise<void> {
    await this.client.delete(tableRef("assignments"), recordId);
    this.invalidateAssignments();
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

  async listCompetencyOverview(): Promise<CompetencyOverview[]> {
    const competencyQuery = new URLSearchParams();
    competencyQuery.set("filterByFormula", `{${fields.competencies.status}}!="Archived"`);
    const [competencyRecords, focusRecords] = await Promise.all([
      this.client.list<Record<string, unknown>>(tableRef("competencies"), competencyQuery),
      this.client.list<Record<string, unknown>>(tableRef("competencyFocuses"))
    ]);
    const competencies = competencyRecords.map(mapCompetency).sort(compareCompetencies);
    const competencyIds = new Set(competencies.map((competency) => competency.id));
    const focuses = focusRecords
      .map(mapCompetencyFocus)
      .filter((focus) => competencyIds.has(focus.competencyId));
    const focusesByCompetency = new Map<string, CompetencyFocus[]>();
    for (const focus of focuses) {
      const current = focusesByCompetency.get(focus.competencyId) ?? [];
      current.push(focus);
      focusesByCompetency.set(focus.competencyId, current);
    }

    return competencies.map((competency) => {
      const competencyFocuses = focusesByCompetency.get(competency.id) ?? [];
      const currentFocus = competencyFocuses
        .filter((focus) => !focus.endedAt)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
      const historicalFocuses = competencyFocuses
        .filter((focus) => focus.endedAt)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      return { competency, currentFocus, historicalFocuses };
    });
  }

  async createCompetency(
    name: string,
    category?: string,
    vision?: string,
    description?: string
  ): Promise<Competency> {
    const createdAt = new Date().toISOString();
    const record = await this.client.create<Record<string, unknown>>(
      tableRef("competencies"),
      competencyToAirtable(name, category, vision, description, createdAt, Date.parse(createdAt))
    );
    return mapCompetency(record);
  }

  async updateCompetency(recordId: string, update: CompetencyUpdate): Promise<Competency> {
    const record = await this.client.update<Record<string, unknown>>(
      tableRef("competencies"),
      recordId,
      competencyUpdateToAirtable(update)
    );
    return mapCompetency(record);
  }

  async reorderCompetencies(competencyIds: string[]): Promise<void> {
    await Promise.all(
      competencyIds.map((competencyId, index) =>
        this.client.update<Record<string, unknown>>(tableRef("competencies"), competencyId, {
          [fields.competencies.sortOrder]: (index + 1) * COMPETENCY_ORDER_STEP
        })
      )
    );
  }

  async createCompetencyFocus(
    competencyId: string,
    title: string,
    startedAt: string,
    notes?: string
  ): Promise<CompetencyFocus> {
    const focusRecords = await this.client.list<Record<string, unknown>>(
      tableRef("competencyFocuses")
    );
    const openFocuses = focusRecords
      .map(mapCompetencyFocus)
      .filter((focus) => focus.competencyId === competencyId && !focus.endedAt);
    await Promise.all(
      openFocuses.map((focus) =>
        this.client.update<Record<string, unknown>>(tableRef("competencyFocuses"), focus.id, {
          [fields.competencyFocuses.endedAt]: startedAt
        })
      )
    );

    const createdAt = new Date().toISOString();
    const record = await this.client.create<Record<string, unknown>>(
      tableRef("competencyFocuses"),
      competencyFocusToAirtable(competencyId, title, startedAt, notes, createdAt)
    );
    return mapCompetencyFocus(record);
  }

  async updateCompetencyFocus(
    recordId: string,
    update: CompetencyFocusUpdate
  ): Promise<CompetencyFocus> {
    const record = await this.client.update<Record<string, unknown>>(
      tableRef("competencyFocuses"),
      recordId,
      competencyFocusUpdateToAirtable(update)
    );
    return mapCompetencyFocus(record);
  }

  async listHabitWeek(weekStart: string, weekEnd: string): Promise<HabitWeek> {
    const habitQuery = new URLSearchParams();
    habitQuery.set("filterByFormula", `{${fields.habits.status}}="Active"`);
    habitQuery.set("sort[0][field]", fields.habits.createdAt);
    habitQuery.set("sort[0][direction]", "asc");
    const [habitRecords, allCheckInRecords] = await Promise.all([
      this.client.list<Record<string, unknown>>(tableRef("habits"), habitQuery),
      this.client.list<Record<string, unknown>>(tableRef("habitCheckIns"))
    ]);
    const habits = habitRecords
      .map(mapHabit)
      .filter((habit) => habit.createdAt.slice(0, 10) <= weekEnd)
      .sort(compareHabitsByOrder);
    const habitIds = new Set(habits.map((habit) => habit.id));
    const allCheckIns = allCheckInRecords
      .map(mapHabitCheckIn)
      .filter((item) => habitIds.has(item.habitId));
    const totalKeys = new Set<string>();
    const totalCounts = new Map<string, number>();
    for (const checkIn of allCheckIns) {
      const key = `${checkIn.habitId}:${checkIn.date}`;
      if (totalKeys.has(key)) continue;
      totalKeys.add(key);
      totalCounts.set(checkIn.habitId, (totalCounts.get(checkIn.habitId) ?? 0) + 1);
    }
    const totals = habits.map((habit) => ({
      habitId: habit.id,
      completedSessions: totalCounts.get(habit.id) ?? 0
    }));
    return {
      habits,
      checkIns: allCheckIns.filter((item) => item.date >= weekStart && item.date <= weekEnd),
      totals,
      weekStart,
      weekEnd
    };
  }

  async createHabit(name: string, targetDaysPerWeek: number): Promise<Habit> {
    const createdAt = new Date().toISOString();
    const record = await this.client.create<Record<string, unknown>>(
      tableRef("habits"),
      habitToAirtable(name, targetDaysPerWeek, createdAt, Date.parse(createdAt))
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

  async reorderHabits(habitIds: string[]): Promise<void> {
    await Promise.all(
      habitIds.map((habitId, index) =>
        this.client.update<Record<string, unknown>>(tableRef("habits"), habitId, {
          [fields.habits.sortOrder]: (index + 1) * HABIT_ORDER_STEP
        })
      )
    );
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

function compareHabitsByOrder(a: Habit, b: Habit): number {
  const orderDiff = habitOrderValue(a) - habitOrderValue(b);
  if (orderDiff !== 0) return orderDiff;
  return a.createdAt.localeCompare(b.createdAt);
}

function compareCompetencies(a: Competency, b: Competency): number {
  const statusDiff = competencyStatusRank(a.status) - competencyStatusRank(b.status);
  if (statusDiff !== 0) return statusDiff;
  const orderDiff = competencyOrderValue(a) - competencyOrderValue(b);
  if (orderDiff !== 0) return orderDiff;
  return a.name.localeCompare(b.name);
}

function competencyStatusRank(status: Competency["status"]): number {
  if (status === "current") return 0;
  if (status === "dormant") return 1;
  if (status === "someday") return 2;
  return 3;
}

function competencyOrderValue(competency: Competency): number {
  if (competency.sortOrder !== undefined) return competency.sortOrder;
  const createdTime = Date.parse(competency.createdAt);
  return Number.isFinite(createdTime) ? createdTime : Number.MAX_SAFE_INTEGER;
}

function habitOrderValue(habit: Habit): number {
  if (habit.sortOrder !== undefined) return habit.sortOrder;
  const createdTime = Date.parse(habit.createdAt);
  return Number.isFinite(createdTime) ? createdTime : Number.MAX_SAFE_INTEGER;
}
