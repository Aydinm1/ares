import { writeFile } from "node:fs/promises";
import { AirtableClient, type AirtableRecord } from "../src/airtable/client.js";
import { fields, tableRef } from "../src/airtable/schema.js";
import {
  buildGeneralContactCleanupPlan,
  buildRelationshipTierPlan,
  normalizeDedupeName
} from "../src/contacts/dedupe.js";

type ContactFields = Record<string, unknown>;

const EXECUTE = process.argv.includes("--execute");
const BACKUP_PATH = "/private/tmp/ares-general-contact-cleanup-plan.json";
const contactFields = fields.contacts;

const CONTACT_CLEANUP_FIELDS = [
  contactFields.name,
  contactFields.email,
  contactFields.role,
  contactFields.notes,
  contactFields.sourceEvent,
  contactFields.sourceKey,
  contactFields.codeLabPriority,
  contactFields.codeLabFitReason,
  contactFields.potentialProjectAngles,
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
  contactFields.generatedClientFitVersion,
  contactFields.outreachStatus,
  contactFields.linkedInUrl,
  contactFields.linkedInConnectedOn,
  contactFields.identityStatus,
  contactFields.organizationMatchStatus,
  contactFields.evidenceNotes,
  contactFields.prospectType,
  contactFields.seniority,
  contactFields.function,
  contactFields.company,
  contactFields.headline,
  contactFields.linkedInHeadline,
  contactFields.source,
  contactFields.searchTerm,
  contactFields.contactSegment,
  contactFields.connectionDegree,
  contactFields.studentStatus,
  contactFields.projectPotential,
  contactFields.reviewStatus,
  contactFields.duplicateKey,
  contactFields.duplicateGroup,
  contactFields.workflows,
  contactFields.relationshipType,
  contactFields.personalPriority,
  contactFields.birthday,
  contactFields.lastContacted,
  contactFields.nextFollowUp,
  contactFields.organizations,
  contactFields.interactions,
  contactFields.outreachOpportunities,
  contactFields.importantDates
];

async function main(): Promise<void> {
  const client = new AirtableClient();
  const records = await listContacts(client);
  const dedupePlan = buildGeneralContactCleanupPlan(records);
  const tierUpdates = buildRelationshipTierPlan(records);
  const mergedUpdates = mergeActions([...dedupePlan.plannedUpdates, ...tierUpdates]);
  const auditBefore = auditRecords(records);
  const backup = {
    generatedAt: new Date().toISOString(),
    execute: EXECUTE,
    auditBefore,
    dedupePlan,
    tierUpdateCount: tierUpdates.length,
    plannedUpdates: mergedUpdates,
    plannedDeletes: dedupePlan.plannedDeletes
  };

  await writeFile(BACKUP_PATH, JSON.stringify(backup, null, 2));

  if (EXECUTE) {
    for (const chunk of chunks(mergedUpdates, 10)) {
      await client.updateMany<ContactFields>(
        tableRef("contacts"),
        chunk.map((action) => ({ id: action.id, fields: action.fields }))
      );
    }
    for (const action of dedupePlan.plannedDeletes) {
      await client.delete(tableRef("contacts"), action.id);
    }
  }

  const afterRecords = EXECUTE ? await listContacts(client) : records;
  const auditAfter = auditRecords(afterRecords);

  console.log(JSON.stringify({
    mode: EXECUTE ? "execute" : "dry-run",
    backupPath: BACKUP_PATH,
    auditBefore,
    duplicateBuckets: dedupePlan.bucketCounts,
    plannedUpdateCount: mergedUpdates.length,
    tierUpdateCount: tierUpdates.length,
    plannedDeleteCount: dedupePlan.plannedDeletes.length,
    skippedDuplicateGroups: dedupePlan.skippedDuplicateGroups.length,
    sampleUpdates: mergedUpdates.slice(0, 10).map((action) => ({
      id: action.id,
      reason: action.reason,
      fields: action.fields
    })),
    sampleDeletes: dedupePlan.plannedDeletes.slice(0, 16),
    auditAfter
  }, null, 2));
}

async function listContacts(client: AirtableClient): Promise<Array<AirtableRecord<ContactFields>>> {
  const query = new URLSearchParams();
  query.set("pageSize", "100");
  for (const field of CONTACT_CLEANUP_FIELDS) query.append("fields[]", field);
  return client.list<ContactFields>(tableRef("contacts"), query);
}

function auditRecords(records: Array<AirtableRecord<ContactFields>>): Record<string, unknown> {
  const groups = groupByName(records);
  const duplicateGroups = [...groups.values()].filter((group) => group.length > 1);
  const workflowCounts: Record<string, number> = {};
  for (const record of records) {
    for (const workflow of workflows(record)) workflowCounts[workflow] = (workflowCounts[workflow] ?? 0) + 1;
  }
  return {
    totalContacts: records.length,
    duplicateGroups: duplicateGroups.length,
    duplicateRows: duplicateGroups.reduce((count, group) => count + group.length, 0),
    extraDuplicateRows: duplicateGroups.reduce((count, group) => count + group.length - 1, 0),
    duplicateGroupsWithLinkedRows: duplicateGroups.filter((group) => group.some(hasLinkedRecords)).length,
    workflowCounts
  };
}

function mergeActions(actions: Array<{ id: string; fields: ContactFields; reason: string }>): Array<{ id: string; fields: ContactFields; reason: string }> {
  const merged = new Map<string, { id: string; fields: ContactFields; reason: string }>();
  for (const action of actions) {
    const existing = merged.get(action.id);
    const fields = { ...(existing?.fields ?? {}), ...action.fields };
    if (existing?.fields[contactFields.workflows] || action.fields[contactFields.workflows]) {
      fields[contactFields.workflows] = mergeStringLists(
        stringList(existing?.fields[contactFields.workflows]),
        stringList(action.fields[contactFields.workflows])
      );
    }
    merged.set(action.id, {
      id: action.id,
      fields,
      reason: existing ? `${existing.reason} ${action.reason}` : action.reason
    });
  }
  return [...merged.values()];
}

function groupByName(records: Array<AirtableRecord<ContactFields>>): Map<string, Array<AirtableRecord<ContactFields>>> {
  const groups = new Map<string, Array<AirtableRecord<ContactFields>>>();
  for (const record of records) {
    const key = normalizeDedupeName(record.fields[contactFields.name]);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return groups;
}

function workflows(record: AirtableRecord<ContactFields>): string[] {
  return stringList(record.fields[contactFields.workflows]);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.flatMap((item) => typeof item === "string" ? [item] : []) : [];
}

function mergeStringLists(...lists: string[][]): string[] {
  const output: string[] = [];
  for (const item of lists.flat()) {
    if (!output.includes(item)) output.push(item);
  }
  return output;
}

function hasLinkedRecords(record: AirtableRecord<ContactFields>): boolean {
  return [
    contactFields.organizations,
    contactFields.interactions,
    contactFields.outreachOpportunities,
    contactFields.importantDates
  ].some((field) => Array.isArray(record.fields[field]) && record.fields[field].length > 0);
}

function chunks<T>(items: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size));
  return output;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
