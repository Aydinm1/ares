import test from "node:test";
import assert from "node:assert/strict";
import { fields } from "../src/airtable/schema.js";
import {
  buildGeneralContactCleanupPlan,
  buildPersonalNetworkCleanupPlan,
  buildRelationshipTierPlan,
  classifyDuplicateGroup,
  chooseCanonicalContact,
  inferredNetworkWorkflows,
  type ContactDedupeRecord
} from "../src/contacts/dedupe.js";

const contactFields = fields.contacts;

function record(id: string, name: string, overrides: Record<string, unknown> = {}): ContactDedupeRecord {
  return {
    id,
    fields: {
      [contactFields.name]: name,
      [contactFields.workflows]: ["Personal Networking"],
      ...overrides
    }
  };
}

test("personal network cleanup removes accidental workflow tags outside the paste", () => {
  const plan = buildPersonalNetworkCleanupPlan([
    record("recKeep", "Aydin Merchant"),
    record("recTag", "Old Outreach", {
      [contactFields.workflows]: ["CodeLab Outreach", "Personal Networking"]
    })
  ], ["Aydin Merchant"]);

  assert.equal(plan.plannedUpdates.length, 1);
  assert.equal(plan.plannedUpdates[0]?.id, "recTag");
  assert.deepEqual(plan.plannedUpdates[0]?.fields[contactFields.workflows], ["CodeLab Outreach"]);
  assert.equal(plan.plannedDeletes.length, 0);
});

test("personal network cleanup merges useful duplicate fields before deleting losers", () => {
  const plan = buildPersonalNetworkCleanupPlan([
    record("recCanonical", "Pranaya Rao Ganta", {
      [contactFields.company]: "Google",
      [contactFields.generatedCodeLabScore]: 4.4,
      [contactFields.generatedScoreReason]: "Good student talent fit.",
      [contactFields.notes]: "Personal row notes"
    }),
    record("recLoser", "Pranaya Rao Ganta", {
      [contactFields.workflows]: ["CodeLab Outreach", "Personal Networking"],
      [contactFields.headline]: "SWE Intern @ Google | CS @ UC Davis",
      [contactFields.notes]: "Outreach row notes"
    })
  ], ["Pranaya Rao Ganta"]);

  assert.equal(plan.plannedDeletes.length, 1);
  assert.equal(plan.plannedDeletes[0]?.id, "recLoser");
  const update = plan.plannedUpdates.find((action) => action.id === "recCanonical");
  assert.ok(update);
  assert.equal(update.fields[contactFields.headline], "SWE Intern @ Google | CS @ UC Davis");
  assert.equal(update.fields[contactFields.notes], "Personal row notes\n\nOutreach row notes");
  assert.deepEqual(update.fields[contactFields.workflows], ["Personal Networking"]);
  assert.equal(update.fields[contactFields.generatedCodeLabScore], undefined);
});

test("personal network cleanup preserves best generated score bundle", () => {
  const plan = buildPersonalNetworkCleanupPlan([
    record("recCanonical", "James Tan", {
      [contactFields.generatedCodeLabScore]: 5,
      [contactFields.generatedScoreReason]: "Lower score."
    }),
    record("recLoser", "James Tan", {
      [contactFields.workflows]: ["CodeLab Outreach", "Personal Networking"],
      [contactFields.generatedCodeLabScore]: 7.2,
      [contactFields.generatedScoreReason]: "Better score.",
      [contactFields.generatedClientFitVersion]: "client-fit-v5"
    })
  ], ["James Tan"]);

  const update = plan.plannedUpdates.find((action) => action.id === "recLoser");
  assert.equal(update, undefined);
  const canonicalUpdate = plan.plannedUpdates.find((action) => action.id === "recCanonical");
  assert.ok(canonicalUpdate);
  assert.equal(canonicalUpdate.fields[contactFields.generatedCodeLabScore], 7.2);
  assert.equal(canonicalUpdate.fields[contactFields.generatedScoreReason], "Better score.");
  assert.equal(canonicalUpdate.fields[contactFields.generatedClientFitVersion], "client-fit-v5");
});

test("personal network cleanup keeps CodeLab workflow only with CodeLab-specific evidence", () => {
  const plan = buildPersonalNetworkCleanupPlan([
    record("recCanonical", "Karim Bandealy"),
    record("recLoser", "Karim Bandealy", {
      [contactFields.workflows]: ["CodeLab Outreach", "Personal Networking"],
      [contactFields.codeLabFitReason]: "Design systems buyer for CodeLab."
    })
  ], ["Karim Bandealy"]);

  const update = plan.plannedUpdates.find((action) => action.id === "recCanonical");
  assert.ok(update);
  assert.deepEqual(update.fields[contactFields.workflows], ["Personal Networking", "CodeLab Outreach"]);
});

test("personal network cleanup marks linked duplicate losers instead of deleting them", () => {
  const plan = buildPersonalNetworkCleanupPlan([
    record("recCanonical", "Zubair Talib", {
      [contactFields.organizations]: ["recOrganization"],
      [contactFields.notes]: "More complete linked row."
    }),
    record("recLinked", "Zubair Talib", {
      [contactFields.interactions]: ["recInteraction"]
    })
  ], ["Zubair Talib"]);

  assert.equal(plan.plannedDeletes.length, 0);
  assert.equal(plan.skippedDuplicateGroups.length, 1);
  const update = plan.plannedUpdates.find((action) => action.id === "recLinked");
  assert.ok(update);
  assert.deepEqual(update.fields[contactFields.workflows], ["Personal Networking", "Needs Cleanup"]);
  assert.equal(update.fields[contactFields.reviewStatus], "Needs Review");
});

test("canonical contact selection prefers personal-only rows before mixed workflow rows", () => {
  const canonical = chooseCanonicalContact([
    record("recMixed", "Connie Zhu", {
      [contactFields.workflows]: ["CodeLab Outreach", "Personal Networking"],
      [contactFields.company]: "Google"
    }),
    record("recPersonal", "Connie Zhu", {
      [contactFields.workflows]: ["Personal Networking"]
    })
  ]);

  assert.equal(canonical.id, "recPersonal");
});

test("general cleanup merges personal and codelab duplicate workflows", () => {
  const plan = buildGeneralContactCleanupPlan([
    record("recPersonal", "Ameen Tharani", {
      [contactFields.workflows]: ["Personal Networking"],
      [contactFields.headline]: "Product Manager @ Genentech",
      [contactFields.generatedCodeLabScore]: 7.5
    }),
    record("recCodeLab", "Ameen Tharani", {
      [contactFields.workflows]: ["CodeLab Outreach"],
      [contactFields.source]: "Manual contact intake"
    })
  ]);

  assert.equal(plan.duplicateGroupCount, 1);
  assert.equal(plan.plannedDeletes.length, 1);
  assert.equal(plan.plannedDeletes[0]?.id, "recCodeLab");
  const update = plan.plannedUpdates.find((action) => action.id === "recPersonal");
  assert.ok(update);
  assert.deepEqual(update.fields[contactFields.workflows], ["Personal Networking", "CodeLab Outreach"]);
});

test("general cleanup preserves multiple source contexts in canonical notes", () => {
  const plan = buildGeneralContactCleanupPlan([
    record("recEvent", "Naveed Lalani", {
      [contactFields.workflows]: [],
      [contactFields.source]: "Din & Dunya Innovators Retreat 2025",
      [contactFields.notes]: "Event import note"
    }),
    record("recLinkedIn", "Naveed Lalani", {
      [contactFields.workflows]: ["Personal Networking"],
      [contactFields.source]: "LinkedIn Connections Export",
      [contactFields.headline]: "Co-Founder & CEO @ Plexor.ai"
    })
  ]);

  assert.equal(classifyDuplicateGroup([
    record("recEvent", "Naveed Lalani", { [contactFields.source]: "Din & Dunya Innovators Retreat 2025" }),
    record("recLinkedIn", "Naveed Lalani", { [contactFields.source]: "LinkedIn Connections Export" })
  ]), "event_plus_linkedin_duplicate");
  const update = plan.plannedUpdates.find((action) => action.id === "recLinkedIn");
  assert.ok(update);
  assert.match(String(update.fields[contactFields.notes]), /Merged duplicate source context/);
  assert.match(String(update.fields[contactFields.notes]), /Din & Dunya/);
  assert.match(String(update.fields[contactFields.notes]), /LinkedIn Connections Export/);
});

test("relationship tier plan adds conservative school and community workflows", () => {
  const teacher = record("recTeacher", "Teresa Elmore", {
    [contactFields.workflows]: [],
    [contactFields.headline]: "Math / Computer Science Teacher at Libertyville High School"
  });
  const community = record("recCommunity", "Aleem Walji", {
    [contactFields.workflows]: [],
    [contactFields.source]: "IPN Summit 2026"
  });

  assert.deepEqual(inferredNetworkWorkflows(teacher), ["School"]);
  assert.deepEqual(inferredNetworkWorkflows(community), ["Community"]);

  const updates = buildRelationshipTierPlan([teacher, community]);
  assert.equal(updates.length, 2);
  assert.deepEqual(updates.find((action) => action.id === "recTeacher")?.fields[contactFields.workflows], ["School"]);
  assert.deepEqual(updates.find((action) => action.id === "recCommunity")?.fields[contactFields.workflows], ["Community"]);
});
