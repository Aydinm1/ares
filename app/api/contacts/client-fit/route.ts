import {
  getRepository,
  json,
  readJson,
  routeJson
} from "../../_lib/schoolRoutes.js";
import {
  CONTACT_INTELLIGENCE_VERSION,
  buildContactIntelligence,
  formatDiscoveryPromptsForAirtable,
  formatProjectIdeasForAirtable
} from "../../../../src/contacts/intelligence.js";
import { ValidationError } from "../../../../src/validation/domain.js";

export const dynamic = "force-dynamic";

const MAX_CONTACT_FIT_BATCH = 50;

export async function POST(request: Request): Promise<Response> {
  return routeJson(async () => {
    const body = await readJson(request);
    const contactIds = contactIdsFromBody(body);
    const repository = getRepository();
    const contacts = await repository.listContacts({ refresh: true });
    const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
    const requestedContacts = contactIds
      .map((id) => contactsById.get(id))
      .filter((contact) => contact !== undefined);
    const updatedAt = new Date().toISOString();

    await repository.updateContactClientFits(
      requestedContacts.map((contact) => {
        const intelligence = buildContactIntelligence(contact);
        return {
          id: contact.id,
          reachOutReason: intelligence.reachOutReason,
          projectIdeas: formatProjectIdeasForAirtable(intelligence),
          discoveryPrompts: formatDiscoveryPromptsForAirtable(intelligence),
          codeLabScore: intelligence.score.overall,
          techRelevanceScore: intelligence.score.techRelevance,
          authorityScore: intelligence.score.authority,
          projectSourceScore: intelligence.score.projectSource,
          warmPathScore: intelligence.score.warmPath,
          scoreReason: intelligence.score.reason,
          updatedAt,
          version: CONTACT_INTELLIGENCE_VERSION
        };
      })
    );

    const savedIds = requestedContacts.map((contact) => contact.id);
    const missingIds = contactIds.filter((id) => !contactsById.has(id));

    return json(200, {
      savedIds,
      missingIds,
      savedCount: savedIds.length,
      skippedCount: missingIds.length,
      updatedAt,
      version: CONTACT_INTELLIGENCE_VERSION
    });
  });
}

function contactIdsFromBody(body: unknown): string[] {
  const issues: string[] = [];
  const value = body && typeof body === "object" ? (body as { contactIds?: unknown }).contactIds : undefined;
  if (!Array.isArray(value)) {
    throw new ValidationError(["contactIds must be an array."]);
  }

  const ids = value.filter((item): item is string => typeof item === "string");
  if (ids.length !== value.length) issues.push("Every contactIds item must be a record ID string.");
  if (!ids.length) issues.push("contactIds must include at least one contact.");
  if (ids.length > MAX_CONTACT_FIT_BATCH) {
    issues.push(`contactIds cannot include more than ${MAX_CONTACT_FIT_BATCH} records.`);
  }

  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length !== ids.length) issues.push("contactIds cannot include duplicates.");
  if (uniqueIds.some((id) => !/^rec[A-Za-z0-9]+$/.test(id))) {
    issues.push("Every contactIds item must look like an Airtable record ID.");
  }
  if (issues.length) throw new ValidationError(issues);
  return uniqueIds;
}
