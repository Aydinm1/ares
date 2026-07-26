import { getRepository, json, readJson, routeJson } from "../../_lib/schoolRoutes.js";
import { previewContactIntake } from "../../../../src/contacts/intake.js";
import {
  CONTACT_INTELLIGENCE_VERSION,
  buildContactIntelligence,
  formatDiscoveryPromptsForAirtable,
  formatProjectIdeasForAirtable
} from "../../../../src/contacts/intelligence.js";
import type { Contact } from "../../../../src/domain/types.js";
import { validateContactIntakeRequest } from "../../../../src/validation/domain.js";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return routeJson(async () => {
    const input = validateContactIntakeRequest(await readJson(request));
    const repository = getRepository();
    const existingContacts = await repository.listContacts({ refresh: true });
    const preview = previewContactIntake(input.rawText, existingContacts, {
      targetWorkflows: input.targetWorkflows,
      sourceOverride: input.sourceOverride
    });
    if (input.dryRun) return json(200, preview);

    if (input.action === "updateExisting") {
      const parsedByRecordId = new Map(
        preview.contacts
          .filter((contact) => contact.duplicateOfId)
          .map((contact) => [contact.duplicateOfId!, contact])
      );
      const updatedContacts = await repository.updateContactsFromIntake([...parsedByRecordId.values()]);
      const unmatchedContacts = preview.contacts.filter((contact) => !contact.duplicateOfId);
      const createdContacts = input.createUnmatched
        ? await repository.createContactsFromIntake(unmatchedContacts)
        : [];
      const scoredContacts = [...updatedContacts, ...createdContacts].filter(shouldSaveClientFit);
      if (input.saveEligibleClientFit && scoredContacts.length) {
        await saveClientFits(repository, scoredContacts);
      }
      return json(200, {
        ...preview,
        updatedContacts,
        updatedCount: updatedContacts.length,
        createdContacts,
        createdCount: createdContacts.length,
        unmatchedContacts,
        scoredCount: input.saveEligibleClientFit ? scoredContacts.length : 0,
        clientFitVersion: input.saveEligibleClientFit ? CONTACT_INTELLIGENCE_VERSION : undefined
      });
    }

    const contactsToCreate = preview.contacts.filter((contact) => !contact.duplicateReason);
    const createdContacts = await repository.createContactsFromIntake(contactsToCreate);
    const scoredContacts = createdContacts.filter(shouldSaveClientFit);
    if (input.saveEligibleClientFit && scoredContacts.length) {
      await saveClientFits(repository, scoredContacts);
    }
    return json(201, {
      ...preview,
      createdContacts,
      scoredCount: input.saveEligibleClientFit ? scoredContacts.length : 0,
      clientFitVersion: input.saveEligibleClientFit ? CONTACT_INTELLIGENCE_VERSION : undefined
    });
  });
}

async function saveClientFits(
  repository: ReturnType<typeof getRepository>,
  contacts: Contact[]
): Promise<void> {
  const updatedAt = new Date().toISOString();
  await repository.updateContactClientFits(contacts.map((contact) => {
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
  }));
}

function shouldSaveClientFit(contact: Contact): boolean {
  return contact.priority === "High" ||
    contact.priority === "Medium" ||
    contact.projectPotential === "Strong" ||
    contact.projectPotential === "Possible";
}
