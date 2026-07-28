import type {
  Assignment,
  AssignmentUpdate,
  Competency,
  CompetencyFocus,
  CompetencyFocusUpdate,
  CompetencyOverview,
  CompetencyUpdate,
  Contact,
  ContactEvidenceUpdate,
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
  contactClientFitToAirtable,
  contactEvidenceToAirtable,
  contactIntakeToAirtable,
  contactIntakeUpdateToAirtable,
  type ContactClientFitPersistence,
  habitCheckInToAirtable,
  habitToAirtable,
  habitUpdateToAirtable,
  inboxItemToAirtable,
  mapAssignment,
  mapCompetency,
  mapCompetencyFocus,
  mapContact,
  mapCourse,
  mapGeneralEducationRequirement,
  mapGradeCategory,
  mapHabit,
  mapHabitCheckIn,
  mapInboxItem
} from "./mappers.js";
import { fields, tableRef } from "./schema.js";
import type { ParsedContactInput } from "../contacts/intake.js";

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

export interface ContactClientFitUpdate extends ContactClientFitPersistence {
  id: string;
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

  async listContacts(options: ReadOptions = {}): Promise<Contact[]> {
    return this.readCached("contacts", options, async () => {
      const query = new URLSearchParams();
      for (const field of CONTACT_LIST_FIELDS) {
        query.append("fields[]", field);
      }
      const records = await this.client.list<Record<string, unknown>>(
        tableRef("contacts"),
        query
      );
      return records.map(mapContact).sort(compareContactsForDefaultView);
    });
  }

  async updateContactClientFits(updates: ContactClientFitUpdate[]): Promise<void> {
    for (const chunk of chunks(updates, 10)) {
      await this.client.updateMany<Record<string, unknown>>(
        tableRef("contacts"),
        chunk.map((update) => ({
          id: update.id,
          fields: contactClientFitToAirtable(update)
        }))
      );
    }
    this.invalidateContacts();
  }

  async updateContactEvidence(recordId: string, update: ContactEvidenceUpdate): Promise<Contact> {
    const record = await this.client.update<Record<string, unknown>>(
      tableRef("contacts"),
      recordId,
      contactEvidenceToAirtable({
        ...update,
        lastReviewedAt: new Date().toISOString()
      })
    );
    this.invalidateContacts();
    return mapContact(record);
  }

  async createContactsFromIntake(contacts: ParsedContactInput[]): Promise<Contact[]> {
    const created: Contact[] = [];
    for (const chunk of chunks(contacts, 10)) {
      const records = await this.client.createMany<Record<string, unknown>>(
        tableRef("contacts"),
        chunk.map((contact) => ({ fields: contactIntakeToAirtable(contact) })),
        { typecast: true }
      );
      created.push(...records.map(mapContact));
    }
    this.invalidateContacts();
    return created;
  }

  async updateContactsFromIntake(contacts: ParsedContactInput[]): Promise<Contact[]> {
    const existingContacts = await this.listContacts({ refresh: true });
    const existingByName = new Map<string, Contact[]>();
    for (const contact of existingContacts) {
      const key = normalizeContactName(contact.name);
      existingByName.set(key, [...(existingByName.get(key) ?? []), contact]);
    }

    const updates = contacts.flatMap((parsed) => {
      const existing = findExistingContactForIntake(parsed, existingByName);
      if (!existing) return [];
      const fieldsToUpdate = contactIntakeUpdateToAirtable(parsed, existing);
      if (!Object.keys(fieldsToUpdate).length) return [];
      return [{ id: existing.id, fields: fieldsToUpdate }];
    });

    const updated: Contact[] = [];
    for (const chunk of chunks(updates, 10)) {
      const records = await this.client.updateMany<Record<string, unknown>>(
        tableRef("contacts"),
        chunk
      );
      updated.push(...records.map(mapContact));
    }
    this.invalidateContacts();
    return updated;
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

  invalidateContacts(): void {
    this.cache.delete("contacts");
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

const CONTACT_LIST_FIELDS = [
  fields.contacts.name,
  fields.contacts.course,
  fields.contacts.role,
  fields.contacts.email,
  fields.contacts.officeHours,
  fields.contacts.location,
  fields.contacts.notes,
  fields.contacts.sourceEvent,
  fields.contacts.sourceKey,
  fields.contacts.codeLabPriority,
  fields.contacts.codeLabFitReason,
  fields.contacts.potentialProjectAngles,
  fields.contacts.generatedReachOutReason,
  fields.contacts.generatedProjectIdeas,
  fields.contacts.generatedDiscoveryPrompts,
  fields.contacts.generatedCodeLabScore,
  fields.contacts.generatedTechRelevanceScore,
  fields.contacts.generatedAuthorityScore,
  fields.contacts.generatedProjectSourceScore,
  fields.contacts.generatedWarmPathScore,
  fields.contacts.generatedScoreReason,
  fields.contacts.generatedClientFitUpdatedAt,
  fields.contacts.generatedClientFitVersion,
  fields.contacts.outreachStatus,
  fields.contacts.linkedInUrl,
  fields.contacts.linkedInConnectedOn,
  fields.contacts.identityStatus,
  fields.contacts.organizationMatchStatus,
  fields.contacts.evidenceNotes,
  fields.contacts.lastReviewedAt,
  fields.contacts.prospectType,
  fields.contacts.seniority,
  fields.contacts.function,
  fields.contacts.company,
  fields.contacts.headline,
  fields.contacts.linkedInHeadline,
  fields.contacts.source,
  fields.contacts.searchTerm,
  fields.contacts.contactSegment,
  fields.contacts.connectionDegree,
  fields.contacts.studentStatus,
  fields.contacts.projectPotential,
  fields.contacts.reviewStatus,
  fields.contacts.duplicateKey,
  fields.contacts.duplicateGroup,
  fields.contacts.autoPriority,
  fields.contacts.autoStudentStatus,
  fields.contacts.autoSeniority,
  fields.contacts.autoSource,
  fields.contacts.autoSearchTerm,
  fields.contacts.autoFunctionTags,
  fields.contacts.autoProspectType,
  fields.contacts.autoProjectPotential,
  fields.contacts.autoHeadline,
  fields.contacts.autoCompany,
  fields.contacts.autoDuplicateGroup,
  fields.contacts.autoDuplicateKey,
  fields.contacts.autoReviewStatus,
  fields.contacts.workflows,
  fields.contacts.relationshipType,
  fields.contacts.personalPriority,
  fields.contacts.relationshipRisk,
  fields.contacts.outreachReadiness,
  fields.contacts.relationshipContext,
  fields.contacts.researchStatus,
  fields.contacts.researchDossier,
  fields.contacts.researchSourceUrls,
  fields.contacts.lastResearchedAt,
  fields.contacts.birthday,
  fields.contacts.lastContacted,
  fields.contacts.nextFollowUp,
  fields.contacts.organizations,
  fields.contacts.interactions,
  fields.contacts.outreachOpportunities,
  fields.contacts.importantDates,
  fields.contacts.autoWorkflowTags
];

function compareContactsForDefaultView(a: Contact, b: Contact): number {
  return contactRank(b) - contactRank(a) || a.name.localeCompare(b.name);
}

function contactRank(contact: Contact): number {
  if (typeof contact.generatedCodeLabScore === "number") {
    return contact.generatedCodeLabScore * 1000;
  }

  let score = 0;
  if (contact.priority === "High") score += 100;
  if (contact.priority === "Medium") score += 60;
  if (contact.studentStatus === "Not Student") score += 24;
  if (contact.prospectType === "Decision Maker") score += 18;
  if (contact.prospectType === "Technical Leader") score += 16;
  if (contact.prospectType === "Product") score += 14;
  if (contact.prospectType === "Operator") score += 8;
  if (contact.reviewStatus === "Needs Review") score -= 8;
  if (contact.prospectType === "Skip" || contact.priority === "Skip") score -= 200;
  return score;
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function findExistingContactForIntake(
  contact: ParsedContactInput,
  existingByName: Map<string, Contact[]>
): Contact | undefined {
  const matches = existingByName.get(normalizeContactName(contact.name)) ?? [];
  if (!matches.length) return undefined;
  const normalizedCompany = normalizeContactCompany(contact.company);
  return matches.find((match) => normalizeContactCompany(match.company) === normalizedCompany) ?? matches[0];
}

function normalizeContactName(value: string): string {
  return normalizeContactText(value)
    .replace(/,#open_to_work/gi, "")
    .replace(/#open_to_work/gi, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeContactCompany(value?: string): string {
  return normalizeContactText(value ?? "")
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b\.?/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeContactText(value: string): string {
  return value
    .replace(/[\u200e\u200f\u200b-\u200d\ufeff]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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
