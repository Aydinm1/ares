import type {
  Assignment,
  AssignmentUpdate,
  AssignmentCategory,
  AssignmentStatus,
  Competency,
  CompetencyFocus,
  CompetencyFocusUpdate,
  CompetencyStatus,
  CompetencyUpdate,
  Contact,
  ContactEvidenceUpdate,
  ContactOutreachReadiness,
  ContactPriority,
  ContactProspectType,
  ContactRelationshipRisk,
  ContactResearchStatus,
  ContactReviewStatus,
  ContactStudentStatus,
  ContactVerificationStatus,
  ContactWorkflow,
  Course,
  CourseStatus,
  GeneralEducationRequirement,
  GradeCategory,
  GradeCategoryUpdate,
  Habit,
  HabitCheckIn,
  HabitUpdate,
  InboxItem
} from "../domain/types.js";
import type { AirtableRecord } from "./client.js";
import { fields } from "./schema.js";
import type { ParsedContactInput } from "../contacts/intake.js";

type AnyFields = Record<string, unknown>;

const firstLinkedId = (value: unknown): string | undefined =>
  Array.isArray(value) && typeof value[0] === "string" ? value[0] : undefined;

const linkedIds = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const stringValues = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const numberValue = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const trimmedString = (value: unknown): string | undefined => {
  const text = stringValue(value)?.trim();
  return text ? text : undefined;
};

function listFromCsv(value: unknown): string[] {
  return (stringValue(value) ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function contactWorkflowsFromAirtable(value: unknown): ContactWorkflow[] {
  return (stringValues(value) ?? []).filter(isContactWorkflow);
}

function contactWorkflowsFromFormula(value: unknown): ContactWorkflow[] {
  return listFromCsv(value).filter(isContactWorkflow);
}

function isContactWorkflow(value: string): value is ContactWorkflow {
  return [
    "School",
    "CodeLab Outreach",
    "180DC Outreach",
    "Personal Networking",
    "Friends/Family",
    "Birthdays",
    "Community",
    "Recruiting/Talent",
    "Needs Cleanup"
  ].includes(value);
}

function contactPriority(value: unknown): ContactPriority | undefined {
  const text = stringValue(value);
  return text === "High" ||
    text === "Medium" ||
    text === "Low" ||
    text === "Skip" ||
    text === "Needs Review"
    ? text
    : undefined;
}

function contactProspectType(value: unknown): ContactProspectType | undefined {
  const text = stringValue(value);
  return text === "Decision Maker" ||
    text === "Technical Leader" ||
    text === "Product" ||
    text === "Operator" ||
    text === "Student/Talent" ||
    text === "Community/Connector" ||
    text === "Low Signal" ||
    text === "Skip"
    ? text
    : undefined;
}

function contactStudentStatus(value: unknown): ContactStudentStatus | undefined {
  const text = stringValue(value);
  return text === "Student" || text === "Recent Grad" || text === "Not Student" || text === "Unknown"
    ? text
    : undefined;
}

function contactReviewStatus(value: unknown): ContactReviewStatus | undefined {
  const text = stringValue(value);
  return text === "Auto Parsed" ||
    text === "Needs Review" ||
    text === "Reviewed" ||
    text === "Do Not Contact"
    ? text
    : undefined;
}

function contactVerificationStatus(value: unknown): ContactVerificationStatus | undefined {
  const text = stringValue(value);
  return text === "Unverified" ||
    text === "Needs Review" ||
    text === "Verified" ||
    text === "Rejected"
    ? text
    : undefined;
}

function contactRelationshipRisk(value: unknown): ContactRelationshipRisk | undefined {
  const text = stringValue(value);
  return text === "Cold Practice" ||
    text === "Warm Light" ||
    text === "Warm Sensitive" ||
    text === "Big Ask Later" ||
    text === "Avoid / Need Context"
    ? text
    : undefined;
}

function contactOutreachReadiness(value: unknown): ContactOutreachReadiness | undefined {
  const text = stringValue(value);
  return text === "Practice Candidate" ||
    text === "Research First" ||
    text === "Ready to DM" ||
    text === "Ask Family Context" ||
    text === "Hold"
    ? text
    : undefined;
}

function contactResearchStatus(value: unknown): ContactResearchStatus | undefined {
  const text = stringValue(value);
  return text === "Not Started" ||
    text === "Queued" ||
    text === "Researched" ||
    text === "Needs More Sources"
    ? text
    : undefined;
}

function courseStatusFromAirtable(value: unknown): CourseStatus | undefined {
  if (value === "In Progress") return "in_progress";
  if (value === "Not Started") return "not_started";
  if (value === "Completed") return "completed";
  return undefined;
}

export function assignmentStatusFromAirtable(recordFields: AnyFields): AssignmentStatus {
  return recordFields[fields.assignments.completed] === true ? "submitted" : "not_started";
}

export function assignmentCategoryFromLabel(label: unknown): AssignmentCategory {
  const normalized = typeof label === "string" ? label.toLowerCase() : "";
  if (normalized.includes("read")) return "reading";
  if (normalized.includes("problem")) return "problem_set";
  if (normalized.includes("paper") || normalized.includes("essay")) return "paper";
  if (normalized.includes("quiz")) return "quiz";
  if (normalized.includes("exam") || normalized.includes("midterm") || normalized.includes("final")) return "exam";
  if (normalized.includes("project")) return "project";
  if (normalized.includes("discussion")) return "discussion";
  return "other";
}

export function mapCourse(record: AirtableRecord<AnyFields>): Course {
  const value = record.fields;
  return {
    id: record.id,
    name: stringValue(value[fields.courses.name])?.trim() || "Untitled course",
    status: courseStatusFromAirtable(value[fields.courses.status]),
    quarterTaken: stringValue(value[fields.courses.quarterTaken]),
    grade: stringValue(value[fields.courses.grade]),
    majorRequirements: stringValues(value[fields.courses.majorRequirements]),
    geRequirementUsedIds: stringValues(value[fields.courses.geRequirementsUsed]),
    creditHours: numberValue(value[fields.courses.creditHours])
  };
}

export function mapGeneralEducationRequirement(
  record: AirtableRecord<AnyFields>
): GeneralEducationRequirement {
  return {
    id: record.id,
    category: stringValue(record.fields[fields.generalEducation.category]) ?? "Unnamed requirement"
  };
}

export function mapAssignment(record: AirtableRecord<AnyFields>): Assignment {
  const value = record.fields;
  const typeLabel = stringValue(value[fields.assignments.typeLabel]);
  return {
    id: record.id,
    title: stringValue(value[fields.assignments.title]) ?? "Untitled assignment",
    courseId: firstLinkedId(value[fields.assignments.course]),
    dueAt: stringValue(value[fields.assignments.dueAt]),
    status: assignmentStatusFromAirtable(value),
    category: assignmentCategoryFromLabel(typeLabel),
    categoryId: firstLinkedId(value[fields.assignments.gradeCategory]),
    pointsEarned: numberValue(value[fields.assignments.pointsEarned]),
    pointsPossible: numberValue(value[fields.assignments.pointsPossible]),
    typeLabel,
    weekLabel: stringValue(value[fields.assignments.weekLabel]),
    hiddenFromList: value[fields.assignments.hiddenFromList] === true,
    createdAt: record.createdTime
  };
}

export function mapInboxItem(record: AirtableRecord<AnyFields>): InboxItem {
  return {
    id: record.id,
    text: stringValue(record.fields[fields.inboxItems.text])?.trim() || "Untitled capture",
    createdAt:
      stringValue(record.fields[fields.inboxItems.createdAt]) ??
      record.createdTime ??
      new Date(0).toISOString(),
    processed: record.fields[fields.inboxItems.processed] === true
  };
}

export function mapContact(record: AirtableRecord<AnyFields>): Contact {
  const value = record.fields;
  const headline =
    trimmedString(value[fields.contacts.headline]) ??
    trimmedString(value[fields.contacts.autoHeadline]) ??
    trimmedString(value[fields.contacts.linkedInHeadline]);
  const company =
    trimmedString(value[fields.contacts.company]) ??
    trimmedString(value[fields.contacts.autoCompany]);
  const source =
    trimmedString(value[fields.contacts.source]) ??
    trimmedString(value[fields.contacts.autoSource]) ??
    trimmedString(value[fields.contacts.sourceEvent]);
  const searchTerm =
    trimmedString(value[fields.contacts.searchTerm]) ??
    trimmedString(value[fields.contacts.autoSearchTerm]);

  return {
    id: record.id,
    name: trimmedString(value[fields.contacts.name]) ?? "Untitled contact",
    email: trimmedString(value[fields.contacts.email]),
    role: trimmedString(value[fields.contacts.role]),
    headline,
    company: company === "Unknown" ? undefined : company,
    notes: trimmedString(value[fields.contacts.notes]),
    linkedInUrl: trimmedString(value[fields.contacts.linkedInUrl]),
    linkedInConnectedOn: trimmedString(value[fields.contacts.linkedInConnectedOn]),
    identityStatus: contactVerificationStatus(value[fields.contacts.identityStatus]),
    organizationMatchStatus: contactVerificationStatus(value[fields.contacts.organizationMatchStatus]),
    evidenceNotes: trimmedString(value[fields.contacts.evidenceNotes]),
    lastReviewedAt: trimmedString(value[fields.contacts.lastReviewedAt]),
    source,
    sourceEvent: trimmedString(value[fields.contacts.sourceEvent]),
    searchTerm,
    contactSegment: trimmedString(value[fields.contacts.contactSegment]),
    connectionDegree: trimmedString(value[fields.contacts.connectionDegree]),
    priority:
      contactPriority(value[fields.contacts.autoPriority]) ??
      contactPriority(value[fields.contacts.codeLabPriority]),
    prospectType:
      contactProspectType(value[fields.contacts.prospectType]) ??
      contactProspectType(value[fields.contacts.autoProspectType]),
    seniority:
      trimmedString(value[fields.contacts.seniority]) ??
      trimmedString(value[fields.contacts.autoSeniority]),
    studentStatus:
      contactStudentStatus(value[fields.contacts.studentStatus]) ??
      contactStudentStatus(value[fields.contacts.autoStudentStatus]),
    projectPotential:
      trimmedString(value[fields.contacts.projectPotential]) ??
      trimmedString(value[fields.contacts.autoProjectPotential]),
    reviewStatus:
      contactReviewStatus(value[fields.contacts.reviewStatus]) ??
      contactReviewStatus(value[fields.contacts.autoReviewStatus]),
    functionTags: [
      ...(stringValues(value[fields.contacts.function]) ?? []),
      ...listFromCsv(value[fields.contacts.autoFunctionTags])
    ].filter((item, index, items) => items.indexOf(item) === index),
    workflows: contactWorkflowsFromAirtable(value[fields.contacts.workflows]),
    autoWorkflowTags: contactWorkflowsFromFormula(value[fields.contacts.autoWorkflowTags]),
    relationshipType: trimmedString(value[fields.contacts.relationshipType]),
    personalPriority: trimmedString(value[fields.contacts.personalPriority]),
    relationshipRisk: contactRelationshipRisk(value[fields.contacts.relationshipRisk]),
    outreachReadiness: contactOutreachReadiness(value[fields.contacts.outreachReadiness]),
    relationshipContext: trimmedString(value[fields.contacts.relationshipContext]),
    researchStatus: contactResearchStatus(value[fields.contacts.researchStatus]),
    researchDossier: trimmedString(value[fields.contacts.researchDossier]),
    researchSourceUrls: trimmedString(value[fields.contacts.researchSourceUrls]),
    lastResearchedAt: trimmedString(value[fields.contacts.lastResearchedAt]),
    birthday: trimmedString(value[fields.contacts.birthday]),
    lastContacted: trimmedString(value[fields.contacts.lastContacted]),
    nextFollowUp: trimmedString(value[fields.contacts.nextFollowUp]),
    courseIds: linkedIds(value[fields.contacts.course]),
    organizationIds: linkedIds(value[fields.contacts.organizations]),
    interactionIds: linkedIds(value[fields.contacts.interactions]),
    outreachOpportunityIds: linkedIds(value[fields.contacts.outreachOpportunities]),
    importantDateIds: linkedIds(value[fields.contacts.importantDates]),
    duplicateGroup:
      trimmedString(value[fields.contacts.duplicateGroup]) ??
      trimmedString(value[fields.contacts.autoDuplicateGroup]),
    duplicateKey:
      trimmedString(value[fields.contacts.duplicateKey]) ??
      trimmedString(value[fields.contacts.autoDuplicateKey]),
    codeLabFitReason: trimmedString(value[fields.contacts.codeLabFitReason]),
    potentialProjectAngles: trimmedString(value[fields.contacts.potentialProjectAngles]),
    generatedReachOutReason: trimmedString(value[fields.contacts.generatedReachOutReason]),
    generatedProjectIdeas: trimmedString(value[fields.contacts.generatedProjectIdeas]),
    generatedDiscoveryPrompts: trimmedString(value[fields.contacts.generatedDiscoveryPrompts]),
    generatedCodeLabScore: numberValue(value[fields.contacts.generatedCodeLabScore]),
    generatedTechRelevanceScore: numberValue(value[fields.contacts.generatedTechRelevanceScore]),
    generatedAuthorityScore: numberValue(value[fields.contacts.generatedAuthorityScore]),
    generatedProjectSourceScore: numberValue(value[fields.contacts.generatedProjectSourceScore]),
    generatedWarmPathScore: numberValue(value[fields.contacts.generatedWarmPathScore]),
    generatedScoreReason: trimmedString(value[fields.contacts.generatedScoreReason]),
    generatedClientFitUpdatedAt: trimmedString(value[fields.contacts.generatedClientFitUpdatedAt]),
    generatedClientFitVersion: trimmedString(value[fields.contacts.generatedClientFitVersion]),
    outreachStatus: trimmedString(value[fields.contacts.outreachStatus]),
    createdAt: record.createdTime
  };
}

export interface ContactClientFitPersistence {
  reachOutReason: string;
  projectIdeas: string;
  discoveryPrompts: string;
  codeLabScore: number;
  techRelevanceScore: number;
  authorityScore: number;
  projectSourceScore: number;
  warmPathScore: number;
  scoreReason: string;
  updatedAt: string;
  version: string;
}

export function contactClientFitToAirtable(input: ContactClientFitPersistence): AnyFields {
  return {
    [fields.contacts.generatedReachOutReason]: input.reachOutReason,
    [fields.contacts.generatedProjectIdeas]: input.projectIdeas,
    [fields.contacts.generatedDiscoveryPrompts]: input.discoveryPrompts,
    [fields.contacts.generatedCodeLabScore]: input.codeLabScore,
    [fields.contacts.generatedTechRelevanceScore]: input.techRelevanceScore,
    [fields.contacts.generatedAuthorityScore]: input.authorityScore,
    [fields.contacts.generatedProjectSourceScore]: input.projectSourceScore,
    [fields.contacts.generatedWarmPathScore]: input.warmPathScore,
    [fields.contacts.generatedScoreReason]: input.scoreReason,
    [fields.contacts.generatedClientFitUpdatedAt]: input.updatedAt,
    [fields.contacts.generatedClientFitVersion]: input.version
  };
}

export function contactEvidenceToAirtable(input: ContactEvidenceUpdate & { lastReviewedAt: string }): AnyFields {
  const output: AnyFields = {
    [fields.contacts.lastReviewedAt]: input.lastReviewedAt
  };
  if ("linkedInUrl" in input) output[fields.contacts.linkedInUrl] = input.linkedInUrl ?? null;
  if ("identityStatus" in input) output[fields.contacts.identityStatus] = input.identityStatus;
  if ("organizationMatchStatus" in input) {
    output[fields.contacts.organizationMatchStatus] = input.organizationMatchStatus;
  }
  if ("evidenceNotes" in input) output[fields.contacts.evidenceNotes] = input.evidenceNotes ?? null;
  if ("notes" in input) output[fields.contacts.notes] = input.notes ?? null;
  if ("outreachStatus" in input) output[fields.contacts.outreachStatus] = input.outreachStatus ?? null;
  if ("lastContacted" in input) output[fields.contacts.lastContacted] = input.lastContacted ?? null;
  if ("nextFollowUp" in input) output[fields.contacts.nextFollowUp] = input.nextFollowUp ?? null;
  if ("relationshipRisk" in input) output[fields.contacts.relationshipRisk] = input.relationshipRisk ?? null;
  if ("outreachReadiness" in input) output[fields.contacts.outreachReadiness] = input.outreachReadiness ?? null;
  if ("relationshipContext" in input) output[fields.contacts.relationshipContext] = input.relationshipContext ?? null;
  if ("researchStatus" in input) output[fields.contacts.researchStatus] = input.researchStatus ?? null;
  if ("researchDossier" in input) output[fields.contacts.researchDossier] = input.researchDossier ?? null;
  if ("researchSourceUrls" in input) output[fields.contacts.researchSourceUrls] = input.researchSourceUrls ?? null;
  if ("lastResearchedAt" in input) output[fields.contacts.lastResearchedAt] = input.lastResearchedAt ?? null;
  return output;
}

export function contactIntakeToAirtable(contact: ParsedContactInput): AnyFields {
  return {
    [fields.contacts.name]: contact.name,
    [fields.contacts.headline]: contact.headline,
    [fields.contacts.company]: contact.company,
    [fields.contacts.linkedInConnectedOn]: contact.linkedInConnectedOn,
    [fields.contacts.source]: contact.source,
    [fields.contacts.searchTerm]: contact.searchTerm,
    [fields.contacts.connectionDegree]: contact.connectionDegree,
    [fields.contacts.codeLabPriority]: contact.priority === "Skip" ? "Low" : contact.priority,
    [fields.contacts.prospectType]: contact.prospectType,
    [fields.contacts.studentStatus]: contact.studentStatus,
    [fields.contacts.projectPotential]: contact.projectPotential,
    [fields.contacts.reviewStatus]: "Auto Parsed",
    [fields.contacts.function]: contact.functionTags,
    [fields.contacts.workflows]: contact.workflows,
    [fields.contacts.identityStatus]: "Unverified",
    [fields.contacts.organizationMatchStatus]: "Unverified",
    [fields.contacts.duplicateKey]: contact.duplicateKey
  };
}

export function contactIntakeUpdateToAirtable(contact: ParsedContactInput, existing: Contact): AnyFields {
  const output: AnyFields = {};

  setIfMissing(output, fields.contacts.headline, existing.headline, contact.headline, { clearJunk: true });
  setIfMissing(output, fields.contacts.company, existing.company, contact.company, { clearJunk: true });
  setIfMissing(output, fields.contacts.linkedInConnectedOn, existing.linkedInConnectedOn, contact.linkedInConnectedOn);
  setIfMissing(output, fields.contacts.source, existing.source, contact.source);
  setIfMissing(output, fields.contacts.searchTerm, existing.searchTerm, contact.searchTerm);
  setIfMissing(output, fields.contacts.connectionDegree, existing.connectionDegree, contact.connectionDegree);
  setIfMissing(output, fields.contacts.codeLabPriority, existing.priority, contact.priority === "Skip" ? "Low" : contact.priority);
  setIfMissing(output, fields.contacts.prospectType, existing.prospectType, contact.prospectType);
  setIfMissing(output, fields.contacts.studentStatus, existing.studentStatus, contact.studentStatus);
  setIfMissing(output, fields.contacts.projectPotential, existing.projectPotential, contact.projectPotential);
  setIfMissing(output, fields.contacts.reviewStatus, existing.reviewStatus, "Auto Parsed");
  setIfMissing(output, fields.contacts.identityStatus, existing.identityStatus, "Unverified");
  setIfMissing(output, fields.contacts.organizationMatchStatus, existing.organizationMatchStatus, "Unverified");
  setIfMissing(output, fields.contacts.duplicateKey, existing.duplicateKey, contact.duplicateKey);

  if (!existing.functionTags.length && contact.functionTags.length) {
    output[fields.contacts.function] = contact.functionTags;
  }
  const mergedWorkflows = mergeUnique(existing.workflows, contact.workflows);
  if (mergedWorkflows.length !== existing.workflows.length) {
    output[fields.contacts.workflows] = mergedWorkflows;
  }

  return output;
}

function mergeUnique<T>(existing: T[], next: T[]): T[] {
  return [...existing, ...next.filter((item) => !existing.includes(item))];
}

function setIfMissing(
  output: AnyFields,
  field: string,
  existing: unknown,
  next: unknown,
  options: { clearJunk?: boolean } = {}
): void {
  if (!isMissingOrJunk(existing)) return;
  if (next === undefined || next === null || next === "") {
    if (options.clearJunk && typeof existing === "string" && isJunkString(existing)) output[field] = null;
    return;
  }
  output[field] = next;
}

function isMissingOrJunk(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value !== "string") return false;
  return isJunkString(value);
}

function isJunkString(value: string): boolean {
  const normalized = value
    .replace(/[\u200e\u200f\u200b-\u200d\ufeff]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return !normalized ||
    /^[-–—]+$/.test(normalized) ||
    normalized === "unknown" ||
    normalized.includes("profile picture") ||
    normalized.startsWith("connected on ");
}

export function inboxItemToAirtable(text: string, createdAt: string): AnyFields {
  return {
    [fields.inboxItems.text]: text,
    [fields.inboxItems.createdAt]: createdAt,
    [fields.inboxItems.processed]: false
  };
}

export function mapHabit(record: AirtableRecord<AnyFields>): Habit {
  return {
    id: record.id,
    name: stringValue(record.fields[fields.habits.name])?.trim() || "Untitled habit",
    targetDaysPerWeek: numberValue(record.fields[fields.habits.targetDaysPerWeek]) ?? 4,
    status: record.fields[fields.habits.status] === "Archived" ? "archived" : "active",
    createdAt:
      stringValue(record.fields[fields.habits.createdAt]) ??
      record.createdTime ??
      new Date(0).toISOString(),
    sortOrder: numberValue(record.fields[fields.habits.sortOrder])
  };
}

export function habitToAirtable(
  name: string,
  targetDaysPerWeek: number,
  createdAt: string,
  sortOrder: number
): AnyFields {
  return {
    [fields.habits.name]: name,
    [fields.habits.targetDaysPerWeek]: targetDaysPerWeek,
    [fields.habits.status]: "Active",
    [fields.habits.createdAt]: createdAt,
    [fields.habits.sortOrder]: sortOrder
  };
}

export function habitUpdateToAirtable(update: HabitUpdate): AnyFields {
  const result: AnyFields = {};
  if (update.name !== undefined) result[fields.habits.name] = update.name;
  if (update.targetDaysPerWeek !== undefined) {
    result[fields.habits.targetDaysPerWeek] = update.targetDaysPerWeek;
  }
  if (update.status !== undefined) {
    result[fields.habits.status] = update.status === "archived" ? "Archived" : "Active";
  }
  if (update.sortOrder !== undefined) result[fields.habits.sortOrder] = update.sortOrder;
  return result;
}

export function mapHabitCheckIn(record: AirtableRecord<AnyFields>): HabitCheckIn {
  return {
    id: record.id,
    habitId: firstLinkedId(record.fields[fields.habitCheckIns.habit]) ?? "",
    date: stringValue(record.fields[fields.habitCheckIns.date]) ?? "",
    createdAt:
      stringValue(record.fields[fields.habitCheckIns.createdAt]) ??
      record.createdTime ??
      new Date(0).toISOString()
  };
}

export function habitCheckInToAirtable(
  habitId: string,
  date: string,
  createdAt: string
): AnyFields {
  return {
    [fields.habitCheckIns.key]: `${habitId}:${date}`,
    [fields.habitCheckIns.habit]: [habitId],
    [fields.habitCheckIns.date]: date,
    [fields.habitCheckIns.createdAt]: createdAt
  };
}

function competencyStatusFromAirtable(value: unknown): CompetencyStatus {
  if (value === "Dormant") return "dormant";
  if (value === "Someday") return "someday";
  if (value === "Archived") return "archived";
  return "current";
}

function competencyStatusToAirtable(status: CompetencyStatus): string {
  if (status === "dormant") return "Dormant";
  if (status === "someday") return "Someday";
  if (status === "archived") return "Archived";
  return "Current";
}

export function mapCompetency(record: AirtableRecord<AnyFields>): Competency {
  return {
    id: record.id,
    name: stringValue(record.fields[fields.competencies.name])?.trim() || "Untitled competency",
    category: stringValue(record.fields[fields.competencies.category]),
    status: competencyStatusFromAirtable(record.fields[fields.competencies.status]),
    vision: stringValue(record.fields[fields.competencies.vision]),
    description: stringValue(record.fields[fields.competencies.description]),
    sortOrder: numberValue(record.fields[fields.competencies.sortOrder]),
    createdAt:
      stringValue(record.fields[fields.competencies.createdAt]) ??
      record.createdTime ??
      new Date(0).toISOString()
  };
}

export function competencyToAirtable(
  name: string,
  category: string | undefined,
  vision: string | undefined,
  description: string | undefined,
  createdAt: string,
  sortOrder: number
): AnyFields {
  return {
    [fields.competencies.name]: name,
    [fields.competencies.category]: category ?? null,
    [fields.competencies.status]: "Current",
    [fields.competencies.vision]: vision ?? null,
    [fields.competencies.description]: description ?? null,
    [fields.competencies.sortOrder]: sortOrder,
    [fields.competencies.createdAt]: createdAt
  };
}

export function competencyUpdateToAirtable(update: CompetencyUpdate): AnyFields {
  const result: AnyFields = {};
  if (update.name !== undefined) result[fields.competencies.name] = update.name;
  if (update.category !== undefined) result[fields.competencies.category] = update.category;
  if (update.status !== undefined) result[fields.competencies.status] = competencyStatusToAirtable(update.status);
  if (update.vision !== undefined) result[fields.competencies.vision] = update.vision;
  if (update.description !== undefined) result[fields.competencies.description] = update.description;
  if (update.sortOrder !== undefined) result[fields.competencies.sortOrder] = update.sortOrder;
  return result;
}

export function mapCompetencyFocus(record: AirtableRecord<AnyFields>): CompetencyFocus {
  return {
    id: record.id,
    competencyId: firstLinkedId(record.fields[fields.competencyFocuses.competency]) ?? "",
    title: stringValue(record.fields[fields.competencyFocuses.title])?.trim() || "Untitled focus",
    startedAt: stringValue(record.fields[fields.competencyFocuses.startedAt]) ?? "",
    endedAt: stringValue(record.fields[fields.competencyFocuses.endedAt]),
    notes: stringValue(record.fields[fields.competencyFocuses.notes]),
    endReason: stringValue(record.fields[fields.competencyFocuses.endReason]),
    createdAt:
      stringValue(record.fields[fields.competencyFocuses.createdAt]) ??
      record.createdTime ??
      new Date(0).toISOString()
  };
}

export function competencyFocusToAirtable(
  competencyId: string,
  title: string,
  startedAt: string,
  notes: string | undefined,
  createdAt: string
): AnyFields {
  return {
    [fields.competencyFocuses.competency]: [competencyId],
    [fields.competencyFocuses.title]: title,
    [fields.competencyFocuses.startedAt]: startedAt,
    [fields.competencyFocuses.notes]: notes ?? null,
    [fields.competencyFocuses.createdAt]: createdAt
  };
}

export function competencyFocusUpdateToAirtable(update: CompetencyFocusUpdate): AnyFields {
  const result: AnyFields = {};
  if (update.title !== undefined) result[fields.competencyFocuses.title] = update.title;
  if (update.startedAt !== undefined) result[fields.competencyFocuses.startedAt] = update.startedAt;
  if (update.endedAt !== undefined) result[fields.competencyFocuses.endedAt] = update.endedAt;
  if (update.notes !== undefined) result[fields.competencyFocuses.notes] = update.notes;
  if (update.endReason !== undefined) result[fields.competencyFocuses.endReason] = update.endReason;
  return result;
}

export function assignmentCompletionToAirtable(
  status: "submitted" | "not_started"
): AnyFields {
  return { [fields.assignments.completed]: status === "submitted" };
}

export function assignmentUpdateToAirtable(update: AssignmentUpdate): AnyFields {
  const fieldsToUpdate: AnyFields = {};
  if (update.title !== undefined) fieldsToUpdate[fields.assignments.title] = update.title;
  if (update.courseId !== undefined) {
    fieldsToUpdate[fields.assignments.course] = update.courseId ? [update.courseId] : [];
  }
  if (update.dueAt !== undefined) fieldsToUpdate[fields.assignments.dueAt] = update.dueAt;
  if (update.status !== undefined) {
    fieldsToUpdate[fields.assignments.completed] = update.status === "submitted";
  }
  if (update.categoryId !== undefined) {
    fieldsToUpdate[fields.assignments.gradeCategory] = update.categoryId ? [update.categoryId] : [];
  }
  if (update.pointsEarned !== undefined) {
    fieldsToUpdate[fields.assignments.pointsEarned] = update.pointsEarned;
  }
  if (update.pointsPossible !== undefined) {
    fieldsToUpdate[fields.assignments.pointsPossible] = update.pointsPossible;
  }
  if (update.weekLabel !== undefined) {
    fieldsToUpdate[fields.assignments.weekLabel] = update.weekLabel;
  }
  if (update.hiddenFromList !== undefined) {
    fieldsToUpdate[fields.assignments.hiddenFromList] = update.hiddenFromList;
  }
  return fieldsToUpdate;
}

function gradeCalculationType(value: unknown): GradeCategory["calculationType"] | undefined {
  const text = stringValue(value);
  if (text === "Required") return "required";
  if (text === "Extra Credit") return "extra_credit";
  return undefined;
}

function gradeCalculationTypeToAirtable(
  value: GradeCategoryUpdate["calculationType"]
): string | undefined {
  if (value === "required") return "Required";
  if (value === "extra_credit") return "Extra Credit";
  return undefined;
}

export function mapGradeCategory(record: AirtableRecord<AnyFields>): GradeCategory {
  const value = record.fields;
  return {
    id: record.id,
    courseId: firstLinkedId(value[fields.gradeCategories.course]) ?? "",
    name: stringValue(value[fields.gradeCategories.name]) ?? "Uncategorized",
    weightPercent: numberValue(value[fields.gradeCategories.weightPercent]) ?? 0,
    calculationType: gradeCalculationType(value[fields.gradeCategories.calculationType]),
    maxExtraCreditPercent: numberValue(value[fields.gradeCategories.maxExtraCreditPercent])
  };
}

export function gradeCategoryUpdateToAirtable(update: GradeCategoryUpdate): AnyFields {
  const fieldsToUpdate: AnyFields = {};
  if (update.name !== undefined) fieldsToUpdate[fields.gradeCategories.name] = update.name;
  if (update.courseId !== undefined) {
    fieldsToUpdate[fields.gradeCategories.course] = update.courseId ? [update.courseId] : [];
  }
  if (update.weightPercent !== undefined) {
    fieldsToUpdate[fields.gradeCategories.weightPercent] = update.weightPercent;
  }
  if (update.calculationType !== undefined) {
    fieldsToUpdate[fields.gradeCategories.calculationType] =
      gradeCalculationTypeToAirtable(update.calculationType);
  }
  if (update.maxExtraCreditPercent !== undefined) {
    fieldsToUpdate[fields.gradeCategories.maxExtraCreditPercent] = update.maxExtraCreditPercent;
  }
  return fieldsToUpdate;
}
