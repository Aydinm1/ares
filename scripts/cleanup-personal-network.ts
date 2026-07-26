import { writeFile } from "node:fs/promises";
import { AirtableClient, type AirtableRecord } from "../src/airtable/client.js";
import { fields, tableRef } from "../src/airtable/schema.js";
import { buildPersonalNetworkCleanupPlan, normalizeDedupeName } from "../src/contacts/dedupe.js";
import { parseContactBlocks } from "../src/contacts/intake.js";

type ContactFields = Record<string, unknown>;

const EXECUTE = process.argv.includes("--execute");
const MIN_PARSED_CONTACTS = 100;
const BACKUP_PATH = "/private/tmp/ares-contact-dedupe-plan.json";
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
  const rawText = await readStdin();
  const parsedContacts = parseContactBlocks(rawText, {
    targetWorkflows: ["Personal Networking"],
    sourceOverride: "LinkedIn connections paste"
  });
  const parsedNames = parsedContacts.map((contact) => contact.name);
  if (parsedNames.length < MIN_PARSED_CONTACTS) {
    throw new Error(
      `Refusing to cleanup personal network: parsed only ${parsedNames.length} contact(s). ` +
        "Copy the LinkedIn connections list to the clipboard or pass it on stdin."
    );
  }
  const client = new AirtableClient();
  const records = await listContacts(client);
  const plan = buildPersonalNetworkCleanupPlan(records, parsedNames);
  const auditBefore = auditRecords(records, parsedNames);
  const backup = {
    generatedAt: new Date().toISOString(),
    execute: EXECUTE,
    auditBefore,
    plan,
    parsedContacts: parsedContacts.map((contact) => ({
      name: contact.name,
      headline: contact.headline,
      company: contact.company
    }))
  };

  await writeFile(BACKUP_PATH, JSON.stringify(backup, null, 2));

  if (EXECUTE) {
    for (const chunk of chunks(plan.plannedUpdates, 10)) {
      await client.updateMany<ContactFields>(
        tableRef("contacts"),
        chunk.map((action) => ({ id: action.id, fields: action.fields }))
      );
    }
    for (const action of plan.plannedDeletes) {
      await client.delete(tableRef("contacts"), action.id);
    }
  }

  const afterRecords = EXECUTE ? await listContacts(client) : records;
  const auditAfter = auditRecords(afterRecords, parsedNames);
  console.log(JSON.stringify({
    mode: EXECUTE ? "execute" : "dry-run",
    backupPath: BACKUP_PATH,
    auditBefore,
    plannedUpdateCount: plan.plannedUpdates.length,
    plannedDeleteCount: plan.plannedDeletes.length,
    skippedDuplicateGroups: plan.skippedDuplicateGroups.length,
    sampleUpdates: plan.plannedUpdates.slice(0, 8).map((action) => ({
      id: action.id,
      reason: action.reason,
      fields: action.fields
    })),
    sampleDeletes: plan.plannedDeletes.slice(0, 12),
    auditAfter
  }, null, 2));
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function listContacts(client: AirtableClient): Promise<Array<AirtableRecord<ContactFields>>> {
  const query = new URLSearchParams();
  query.set("pageSize", "100");
  for (const field of CONTACT_CLEANUP_FIELDS) {
    query.append("fields[]", field);
  }
  return client.list<ContactFields>(tableRef("contacts"), query);
}

function auditRecords(records: Array<AirtableRecord<ContactFields>>, parsedNames: string[]): Record<string, unknown> {
  const parsedNameSet = new Set(parsedNames.map(normalizeDedupeName).filter(Boolean));
  const personal = records.filter((record) => workflows(record).includes("Personal Networking"));
  const personalInPaste = personal.filter((record) => parsedNameSet.has(normalizeDedupeName(record.fields[contactFields.name])));
  const personalNotInPaste = personal.filter((record) => !parsedNameSet.has(normalizeDedupeName(record.fields[contactFields.name])));
  const duplicateGroups = [...groupByName(personalInPaste).values()].filter((group) => group.length > 1);

  return {
    totalContacts: records.length,
    parsedNames: parsedNameSet.size,
    personalNetworking: personal.length,
    personalInPaste: personalInPaste.length,
    personalNotInPaste: personalNotInPaste.length,
    duplicateGroups: duplicateGroups.length,
    duplicateRows: duplicateGroups.reduce((count, group) => count + group.length, 0),
    personalWithCodeLab: personal.filter((record) => workflows(record).includes("CodeLab Outreach")).length
  };
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
  const value = record.fields[contactFields.workflows];
  return Array.isArray(value) ? value.flatMap((item) => typeof item === "string" ? [item] : []) : [];
}

function chunks<T>(items: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
