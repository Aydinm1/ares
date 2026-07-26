import { fields } from "../airtable/schema.js";
import type { ContactWorkflow } from "../domain/types.js";

export type ContactDedupeFields = Record<string, unknown>;

export interface ContactDedupeRecord {
  id: string;
  createdTime?: string;
  fields: ContactDedupeFields;
}

export interface ContactDedupeAction {
  id: string;
  fields: ContactDedupeFields;
  reason: string;
}

export interface ContactDeleteAction {
  id: string;
  name: string;
  canonicalId: string;
  reason: string;
}

export interface ContactDedupePlan {
  parsedNameCount: number;
  personalNetworkingCount: number;
  plannedUpdates: ContactDedupeAction[];
  plannedDeletes: ContactDeleteAction[];
  skippedDuplicateGroups: Array<{ name: string; reason: string; recordIds: string[] }>;
}

export interface GeneralContactCleanupPlan {
  duplicateGroupCount: number;
  duplicateRowCount: number;
  extraDuplicateRows: number;
  bucketCounts: Record<string, number>;
  plannedUpdates: ContactDedupeAction[];
  plannedDeletes: ContactDeleteAction[];
  skippedDuplicateGroups: Array<{ name: string; reason: string; recordIds: string[]; bucket: string }>;
}

const contactFields = fields.contacts;
const PERSONAL_NETWORKING = "Personal Networking";
const CODELAB_OUTREACH = "CodeLab Outreach";
const NEEDS_CLEANUP = "Needs Cleanup";

const LINKED_FIELDS = [
  contactFields.organizations,
  contactFields.interactions,
  contactFields.outreachOpportunities,
  contactFields.importantDates
];

const SCORE_BUNDLE_FIELDS = [
  contactFields.generatedReachOutReason,
  contactFields.generatedProjectIdeas,
  contactFields.generatedDiscoveryPrompts,
  contactFields.generatedCodeLabScore,
  contactFields.generatedTechRelevanceScore,
  contactFields.generatedAuthorityScore,
  contactFields.generatedProjectSourceScore,
  contactFields.generatedWarmPathScore,
  contactFields.generatedScoreReason,
  contactFields.generatedClientFitUpdatedAt,
  contactFields.generatedClientFitVersion
];

const SCALAR_FILL_FIELDS = [
  contactFields.headline,
  contactFields.company,
  contactFields.email,
  contactFields.role,
  contactFields.linkedInUrl,
  contactFields.linkedInConnectedOn,
  contactFields.source,
  contactFields.sourceEvent,
  contactFields.sourceKey,
  contactFields.searchTerm,
  contactFields.contactSegment,
  contactFields.connectionDegree,
  contactFields.relationshipType,
  contactFields.personalPriority,
  contactFields.birthday,
  contactFields.lastContacted,
  contactFields.nextFollowUp,
  contactFields.prospectType,
  contactFields.studentStatus,
  contactFields.projectPotential,
  contactFields.seniority,
  contactFields.codeLabPriority,
  contactFields.reviewStatus,
  contactFields.identityStatus,
  contactFields.organizationMatchStatus,
  contactFields.duplicateKey,
  contactFields.duplicateGroup
];

const MULTI_VALUE_FIELDS = [
  contactFields.workflows,
  contactFields.function,
  ...LINKED_FIELDS
];

const NOTES_FIELDS = [
  contactFields.notes,
  contactFields.evidenceNotes,
  contactFields.codeLabFitReason,
  contactFields.potentialProjectAngles
];

const CODELAB_EVIDENCE_FIELDS = [
  contactFields.codeLabFitReason,
  contactFields.potentialProjectAngles,
  contactFields.outreachStatus,
  contactFields.sourceEvent,
  contactFields.sourceKey
];

export function normalizeDedupeName(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function buildPersonalNetworkCleanupPlan(
  records: ContactDedupeRecord[],
  parsedNames: Iterable<string>
): ContactDedupePlan {
  const parsedNameSet = new Set([...parsedNames].map(normalizeDedupeName).filter(Boolean));
  const personalRecords = records.filter((record) => workflows(record).includes(PERSONAL_NETWORKING));
  const plannedUpdates = new Map<string, ContactDedupeAction>();
  const plannedDeletes: ContactDeleteAction[] = [];
  const skippedDuplicateGroups: ContactDedupePlan["skippedDuplicateGroups"] = [];

  for (const record of personalRecords) {
    const nameKey = normalizeDedupeName(record.fields[contactFields.name]);
    if (!nameKey || parsedNameSet.has(nameKey)) continue;
    const nextWorkflows = workflows(record).filter((workflow) => workflow !== PERSONAL_NETWORKING);
    plannedUpdates.set(record.id, {
      id: record.id,
      fields: { [contactFields.workflows]: nextWorkflows },
      reason: "Remove accidental Personal Networking workflow; name is not in current LinkedIn paste."
    });
  }

  const duplicateCandidates = personalRecords.filter((record) => {
    const nameKey = normalizeDedupeName(record.fields[contactFields.name]);
    return nameKey && parsedNameSet.has(nameKey);
  });
  const groups = groupByName(duplicateCandidates);

  for (const [nameKey, group] of groups) {
    if (group.length < 2) continue;
    const canonical = chooseCanonicalContact(group);
    const losers = group.filter((record) => record.id !== canonical.id);
    const unsafeLosers = losers.filter(hasLinkedRecords);
    if (unsafeLosers.length) {
      skippedDuplicateGroups.push({
        name: displayName(group[0] ?? canonical, nameKey),
        reason: "One or more duplicate loser rows have linked records.",
        recordIds: group.map((record) => record.id)
      });
      for (const loser of unsafeLosers) {
        mergeUpdate(plannedUpdates, {
          id: loser.id,
          fields: {
            [contactFields.workflows]: mergeStringLists(workflows(loser), [NEEDS_CLEANUP]),
            [contactFields.reviewStatus]: "Needs Review",
            [contactFields.duplicateGroup]: nameKey
          },
          reason: "Mark duplicate for manual review because it has linked records."
        });
      }
      continue;
    }

    const mergedFields = buildCanonicalMergeFields(canonical, group, {
      forcePersonalNetworking: true,
      dropCodeLabWithoutEvidence: true
    });
    mergeUpdate(plannedUpdates, {
      id: canonical.id,
      fields: mergedFields,
      reason: `Merge ${losers.length} duplicate contact row(s) into canonical row.`
    });

    for (const loser of losers) {
      plannedUpdates.delete(loser.id);
      plannedDeletes.push({
        id: loser.id,
        name: displayName(loser, nameKey),
        canonicalId: canonical.id,
        reason: "Delete duplicate loser row after merge; row has no linked records."
      });
    }
  }

  return {
    parsedNameCount: parsedNameSet.size,
    personalNetworkingCount: personalRecords.length,
    plannedUpdates: [...plannedUpdates.values()].filter((action) => Object.keys(action.fields).length > 0),
    plannedDeletes,
    skippedDuplicateGroups
  };
}

export function buildGeneralContactCleanupPlan(records: ContactDedupeRecord[]): GeneralContactCleanupPlan {
  const groups = [...groupByName(records).entries()].filter(([, group]) => group.length > 1);
  const plannedUpdates = new Map<string, ContactDedupeAction>();
  const plannedDeletes: ContactDeleteAction[] = [];
  const skippedDuplicateGroups: GeneralContactCleanupPlan["skippedDuplicateGroups"] = [];
  const bucketCounts: Record<string, number> = {};

  for (const [nameKey, group] of groups) {
    const bucket = classifyDuplicateGroup(group);
    bucketCounts[bucket] = (bucketCounts[bucket] ?? 0) + 1;

    const canonical = chooseCanonicalContact(group);
    const losers = group.filter((record) => record.id !== canonical.id);
    const unsafeLosers = losers.filter(hasLinkedRecords);
    if (unsafeLosers.length) {
      skippedDuplicateGroups.push({
        name: displayName(group[0] ?? canonical, nameKey),
        reason: "One or more duplicate loser rows have linked records.",
        recordIds: group.map((record) => record.id),
        bucket
      });
      for (const loser of unsafeLosers) {
        mergeUpdate(plannedUpdates, {
          id: loser.id,
          fields: {
            [contactFields.workflows]: mergeStringLists(workflows(loser), [NEEDS_CLEANUP]),
            [contactFields.reviewStatus]: "Needs Review",
            [contactFields.duplicateGroup]: nameKey
          },
          reason: `Mark ${bucket} duplicate for manual review because it has linked records.`
        });
      }
      continue;
    }

    const mergedFields = buildCanonicalMergeFields(canonical, group, {
      forcePersonalNetworking: false,
      dropCodeLabWithoutEvidence: false,
      preserveSourceSummary: true
    });
    mergeUpdate(plannedUpdates, {
      id: canonical.id,
      fields: mergedFields,
      reason: `Merge ${losers.length} ${bucket} duplicate contact row(s) into canonical row.`
    });

    for (const loser of losers) {
      plannedUpdates.delete(loser.id);
      plannedDeletes.push({
        id: loser.id,
        name: displayName(loser, nameKey),
        canonicalId: canonical.id,
        reason: `Delete ${bucket} duplicate loser row after merge; row has no linked records.`
      });
    }
  }

  return {
    duplicateGroupCount: groups.length,
    duplicateRowCount: groups.reduce((total, [, group]) => total + group.length, 0),
    extraDuplicateRows: groups.reduce((total, [, group]) => total + group.length - 1, 0),
    bucketCounts,
    plannedUpdates: [...plannedUpdates.values()].filter((action) => Object.keys(action.fields).length > 0),
    plannedDeletes,
    skippedDuplicateGroups
  };
}

export function classifyDuplicateGroup(group: ContactDedupeRecord[]): string {
  const groupWorkflows = group.map(workflows);
  const sources = new Set(group.map(sourceLabel));
  const hasPersonal = groupWorkflows.some((items) => items.includes(PERSONAL_NETWORKING));
  const hasCodeLab = groupWorkflows.some((items) => items.includes(CODELAB_OUTREACH));
  const hasLinkedIn = [...sources].some((source) => /LinkedIn Connections Export/.test(source));
  const hasEvent = [...sources].some((source) => /IPN|Din & Dunya/.test(source));
  const blankishRows = group.filter((record) =>
    workflows(record).length === 0 &&
    sourceLabel(record) === "(blank)" &&
    usefulScore(record) <= 1
  ).length;
  const usefulRows = group.filter((record) => usefulScore(record) > 1).length;

  if (hasPersonal && hasCodeLab) return "personal_plus_codelab_duplicate";
  if (hasLinkedIn && hasCodeLab) return "linkedin_plus_codelab_duplicate";
  if (hasEvent && hasLinkedIn) return "event_plus_linkedin_duplicate";
  if (hasEvent) return "event_duplicate";
  if (blankishRows >= group.length - 1) return "mostly_blank_duplicate";
  if (usefulRows > 1) return "multiple_useful_rows";
  return "simple_duplicate";
}

export function inferredNetworkWorkflows(record: ContactDedupeRecord): ContactWorkflow[] {
  const haystack = recordHaystack(record);
  const inferred: ContactWorkflow[] = [];
  if (/teacher|professor|instructor|faculty|libertyville high school|community high school district|school district|uc davis graduate school of management/.test(haystack)) {
    inferred.push("School");
  }
  if (/\bismaili\b|\bjamat\b|\bipn\b|aga khan|\bakf\b|\bican\b|i-can|din & dunya|innovators retreat/.test(haystack)) {
    inferred.push("Community");
  }
  return inferred;
}

export function buildRelationshipTierPlan(records: ContactDedupeRecord[]): ContactDedupeAction[] {
  return records.flatMap((record) => {
    const inferred = inferredNetworkWorkflows(record);
    if (!inferred.length) return [];
    const current = workflows(record);
    const merged = mergeStringLists(current, inferred);
    if (sameStringSet(current, merged)) return [];
    return [{
      id: record.id,
      fields: { [contactFields.workflows]: merged },
      reason: `Add conservative network workflow tag(s): ${inferred.filter((item) => !current.includes(item)).join(", ")}.`
    }];
  });
}

export function chooseCanonicalContact(group: ContactDedupeRecord[]): ContactDedupeRecord {
  const selected = [...group].sort(compareCanonicalCandidates)[0];
  if (!selected) throw new Error("Cannot choose a canonical contact from an empty group.");
  return selected;
}

function compareCanonicalCandidates(a: ContactDedupeRecord, b: ContactDedupeRecord): number {
  return (
    Number(hasLinkedRecords(b)) - Number(hasLinkedRecords(a)) ||
    Number(isPersonalOnly(b)) - Number(isPersonalOnly(a)) ||
    usefulScore(b) - usefulScore(a) ||
    createdTime(a).localeCompare(createdTime(b)) ||
    a.id.localeCompare(b.id)
  );
}

function buildCanonicalMergeFields(
  canonical: ContactDedupeRecord,
  group: ContactDedupeRecord[],
  options: {
    forcePersonalNetworking: boolean;
    dropCodeLabWithoutEvidence: boolean;
    preserveSourceSummary?: boolean;
  }
): ContactDedupeFields {
  const output: ContactDedupeFields = {};

  for (const field of SCALAR_FILL_FIELDS) {
    const value = firstPresent(group.map((record) => record.fields[field]));
    if (isBlank(canonical.fields[field]) && !isBlank(value)) output[field] = value;
  }

  for (const field of NOTES_FIELDS) {
    const combined = combineTextValues(group.map((record) => record.fields[field]));
    if (combined && combined !== stringValue(canonical.fields[field])) output[field] = combined;
  }
  if (options.preserveSourceSummary) {
    const sourceSummary = mergedSourceSummary(group);
    if (sourceSummary) {
      const combinedNotes = combineTextValues([output[contactFields.notes] ?? canonical.fields[contactFields.notes], sourceSummary]);
      if (combinedNotes && combinedNotes !== stringValue(canonical.fields[contactFields.notes])) {
        output[contactFields.notes] = combinedNotes;
      }
    }
  }

  for (const field of MULTI_VALUE_FIELDS) {
    const merged = mergeStringLists(...group.map((record) => stringList(record.fields[field])));
    if (!sameStringSet(merged, stringList(canonical.fields[field]))) output[field] = merged;
  }

  const bestScoreRecord = [...group]
    .filter((record) => typeof record.fields[contactFields.generatedCodeLabScore] === "number")
    .sort((a, b) => Number(b.fields[contactFields.generatedCodeLabScore]) - Number(a.fields[contactFields.generatedCodeLabScore]))[0];
  if (bestScoreRecord) {
    for (const field of SCORE_BUNDLE_FIELDS) {
      if (!isBlank(bestScoreRecord.fields[field]) && bestScoreRecord.fields[field] !== canonical.fields[field]) {
        output[field] = bestScoreRecord.fields[field];
      }
    }
  }

  const nonCodeLabWorkflows = group.flatMap((record) =>
    workflows(record).filter((workflow) => workflow !== CODELAB_OUTREACH && workflow !== NEEDS_CLEANUP)
  );
  const mergedWorkflows = options.forcePersonalNetworking || options.dropCodeLabWithoutEvidence
    ? mergeStringLists(
      options.forcePersonalNetworking ? [PERSONAL_NETWORKING] : [],
      nonCodeLabWorkflows,
      !options.dropCodeLabWithoutEvidence || group.some(hasCodeLabEvidence) ? [CODELAB_OUTREACH] : []
    )
    : mergeStringLists(...group.map(workflows));
  if (!sameStringSet(mergedWorkflows, stringList(output[contactFields.workflows] ?? canonical.fields[contactFields.workflows]))) {
    output[contactFields.workflows] = mergedWorkflows;
  } else if (contactFields.workflows in output) {
    output[contactFields.workflows] = mergedWorkflows;
  }

  output[contactFields.duplicateGroup] = normalizeDedupeName(canonical.fields[contactFields.name]);
  return output;
}

function mergeUpdate(actions: Map<string, ContactDedupeAction>, next: ContactDedupeAction): void {
  const existing = actions.get(next.id);
  actions.set(next.id, {
    id: next.id,
    reason: existing ? `${existing.reason} ${next.reason}` : next.reason,
    fields: { ...(existing?.fields ?? {}), ...next.fields }
  });
}

function groupByName(records: ContactDedupeRecord[]): Map<string, ContactDedupeRecord[]> {
  const groups = new Map<string, ContactDedupeRecord[]>();
  for (const record of records) {
    const key = normalizeDedupeName(record.fields[contactFields.name]);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return groups;
}

function hasLinkedRecords(record: ContactDedupeRecord): boolean {
  return LINKED_FIELDS.some((field) => stringList(record.fields[field]).length > 0);
}

function hasCodeLabEvidence(record: ContactDedupeRecord): boolean {
  return CODELAB_EVIDENCE_FIELDS.some((field) => !isBlank(record.fields[field]));
}

function sourceLabel(record: ContactDedupeRecord): string {
  return stringValue(record.fields[contactFields.source]) ??
    stringValue(record.fields[contactFields.sourceEvent]) ??
    "(blank)";
}

function recordHaystack(record: ContactDedupeRecord): string {
  return [
    contactFields.name,
    contactFields.headline,
    contactFields.linkedInHeadline,
    contactFields.company,
    contactFields.source,
    contactFields.sourceEvent,
    contactFields.relationshipType,
    contactFields.notes,
    contactFields.evidenceNotes,
    contactFields.codeLabFitReason,
    contactFields.contactSegment
  ].map((field) => record.fields[field] ?? "").join(" ").toLowerCase();
}

function mergedSourceSummary(group: ContactDedupeRecord[]): string | undefined {
  const sources = group
    .map((record) => sourceLabel(record))
    .filter((source) => source !== "(blank)");
  const uniqueSources = mergeStringLists(sources);
  if (uniqueSources.length <= 1) return undefined;
  return `Merged duplicate source context: ${uniqueSources.join("; ")}.`;
}

function isPersonalOnly(record: ContactDedupeRecord): boolean {
  const current = workflows(record);
  return current.length === 1 && current[0] === PERSONAL_NETWORKING;
}

function usefulScore(record: ContactDedupeRecord): number {
  let score = 0;
  for (const field of [...SCALAR_FILL_FIELDS, ...NOTES_FIELDS]) {
    if (!isBlank(record.fields[field])) score += 1;
  }
  for (const field of MULTI_VALUE_FIELDS) {
    score += stringList(record.fields[field]).length;
  }
  if (typeof record.fields[contactFields.generatedCodeLabScore] === "number") {
    score += 10 + Number(record.fields[contactFields.generatedCodeLabScore]);
  }
  return score;
}

function workflows(record: ContactDedupeRecord): ContactWorkflow[] {
  return stringList(record.fields[contactFields.workflows]) as ContactWorkflow[];
}

function displayName(record: ContactDedupeRecord, fallback: string): string {
  return stringValue(record.fields[contactFields.name]) || fallback;
}

function createdTime(record: ContactDedupeRecord): string {
  return record.createdTime ?? "";
}

function firstPresent(values: unknown[]): unknown {
  return values.find((value) => !isBlank(value));
}

function combineTextValues(values: unknown[]): string | undefined {
  const parts = values.map(stringValue).filter((value): value is string => Boolean(value));
  return mergeStringLists(...parts.map((part) => splitTextParts(part))).join("\n\n") || undefined;
}

function splitTextParts(value: string): string[] {
  return value.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return item.trim() ? [item.trim()] : [];
    if (item && typeof item === "object" && "name" in item) {
      const name = (item as { name?: unknown }).name;
      return typeof name === "string" && name.trim() ? [name.trim()] : [];
    }
    return [];
  });
}

function mergeStringLists(...lists: string[][]): string[] {
  const output: string[] = [];
  for (const item of lists.flat()) {
    if (!output.includes(item)) output.push(item);
  }
  return output;
}

function sameStringSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item) => b.includes(item));
}

function isBlank(value: unknown): boolean {
  return (
    value == null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}
