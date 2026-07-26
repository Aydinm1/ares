import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/contacts/route.js";
import { POST } from "../app/api/contacts/client-fit/route.js";
import { POST as POST_INTAKE } from "../app/api/contacts/intake/route.js";
import { PATCH } from "../app/api/contacts/[id]/route.js";
import { loadContacts, saveContactClientFit, saveContactEvidence, updateExistingContactIntake } from "../src/app/apiClient.js";
import { fields, tableRef } from "../src/airtable/schema.js";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.AIRTABLE_API_KEY;

process.env.AIRTABLE_API_KEY = "test-key";

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test.after(() => {
  if (originalApiKey === undefined) delete process.env.AIRTABLE_API_KEY;
  else process.env.AIRTABLE_API_KEY = originalApiKey;
});

test("Contacts GET maps auto-classified CRM fields", async () => {
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.pathname.endsWith(`/${tableRef("contacts")}`), true);
    assert.equal(init?.method, "GET");
    assert.equal(url.searchParams.getAll("fields[]").includes(fields.contacts.autoPriority), true);
    assert.equal(url.searchParams.getAll("fields[]").includes(fields.contacts.autoWorkflowTags), true);
    return Response.json({
      records: [{
        id: "recContact000000",
        createdTime: "2026-07-18T12:00:00.000Z",
        fields: {
          [fields.contacts.name]: "Zahida Virani",
          [fields.contacts.autoHeadline]: "Head of North America @ OSACO | Responsible AI",
          [fields.contacts.autoCompany]: "OSACO Group",
          [fields.contacts.autoPriority]: "High",
          [fields.contacts.autoProspectType]: "Decision Maker",
          [fields.contacts.autoStudentStatus]: "Not Student",
          [fields.contacts.autoReviewStatus]: "Auto Parsed",
          [fields.contacts.autoFunctionTags]: "AI/ML, Security, ",
          [fields.contacts.autoWorkflowTags]: "CodeLab Outreach, ",
          [fields.contacts.generatedReachOutReason]: "Previously saved reason",
          [fields.contacts.generatedCodeLabScore]: 8.4,
          [fields.contacts.generatedTechRelevanceScore]: 8.1,
          [fields.contacts.generatedClientFitVersion]: "client-fit-v3",
          [fields.contacts.linkedInUrl]: "https://www.linkedin.com/in/zahida-virani",
          [fields.contacts.identityStatus]: "Verified",
          [fields.contacts.organizationMatchStatus]: "Needs Review",
          [fields.contacts.evidenceNotes]: "Matched against company website.",
          [fields.contacts.organizations]: ["recOrg000000000"],
          [fields.contacts.outreachOpportunities]: ["recOpp000000000"]
        }
      }]
    });
  };

  const response = await GET(new Request("http://localhost/api/contacts"));
  assert.equal(response.status, 200);
  const body = await response.json() as { contacts: Array<Record<string, unknown>> };
  assert.equal(body.contacts[0]?.name, "Zahida Virani");
  assert.equal(body.contacts[0]?.company, "OSACO Group");
  assert.equal(body.contacts[0]?.priority, "High");
  assert.deepEqual(body.contacts[0]?.functionTags, ["AI/ML", "Security"]);
  assert.deepEqual(body.contacts[0]?.autoWorkflowTags, ["CodeLab Outreach"]);
  assert.equal(body.contacts[0]?.generatedReachOutReason, "Previously saved reason");
  assert.equal(body.contacts[0]?.generatedCodeLabScore, 8.4);
  assert.equal(body.contacts[0]?.generatedTechRelevanceScore, 8.1);
  assert.equal(body.contacts[0]?.generatedClientFitVersion, "client-fit-v3");
  assert.equal(body.contacts[0]?.linkedInUrl, "https://www.linkedin.com/in/zahida-virani");
  assert.equal(body.contacts[0]?.identityStatus, "Verified");
  assert.equal(body.contacts[0]?.organizationMatchStatus, "Needs Review");
  assert.equal(body.contacts[0]?.evidenceNotes, "Matched against company website.");
});

test("Contacts API client loads contacts", async () => {
  const calls: Array<{ url: string; method?: string }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), method: init?.method });
    return Response.json({
      contacts: [{
        id: "recContact000000",
        name: "Zahida Virani",
        functionTags: [],
        workflows: [],
        autoWorkflowTags: [],
        courseIds: [],
        organizationIds: [],
        interactionIds: [],
        outreachOpportunityIds: [],
        importantDateIds: []
      }]
    });
  };

  const contacts = await loadContacts({ refresh: true });
  assert.equal(contacts[0]?.name, "Zahida Virani");
  assert.deepEqual(calls, [{ url: "/api/contacts?refresh=1", method: undefined }]);
});

test("Contacts client fit POST persists generated Airtable fields", async () => {
  const writes: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (init?.method === "GET") {
      assert.equal(url.pathname.endsWith(`/${tableRef("contacts")}`), true);
      return Response.json({
        records: [{
          id: "recContact000000",
          createdTime: "2026-07-18T12:00:00.000Z",
          fields: {
            [fields.contacts.name]: "Zahida Virani",
            [fields.contacts.autoHeadline]: "Head of North America @ OSACO | Responsible AI",
            [fields.contacts.autoCompany]: "OSACO Group",
            [fields.contacts.autoPriority]: "High",
            [fields.contacts.autoProspectType]: "Decision Maker",
            [fields.contacts.autoStudentStatus]: "Not Student",
            [fields.contacts.autoFunctionTags]: "AI/ML, Security, "
          }
        }]
      });
    }

    assert.equal(init?.method, "PATCH");
    assert.equal(url.pathname.endsWith(`/${tableRef("contacts")}`), true);
    const body = JSON.parse(String(init?.body)) as {
      records: Array<{ id: string; fields: Record<string, unknown> }>;
    };
    assert.equal(body.records[0]?.id, "recContact000000");
    writes.push(body.records[0]?.fields ?? {});
    return Response.json({ records: body.records });
  };

  const response = await POST(new Request("http://localhost/api/contacts/client-fit", {
    method: "POST",
    body: JSON.stringify({ contactIds: ["recContact000000"] })
  }));
  assert.equal(response.status, 200);
  const body = await response.json() as { savedCount: number; savedIds: string[]; version: string };
  assert.equal(body.savedCount, 1);
  assert.deepEqual(body.savedIds, ["recContact000000"]);
  assert.equal(body.version, "client-fit-v5");
  assert.equal(writes.length, 1);
  assert.match(String(writes[0]?.[fields.contacts.generatedReachOutReason]), /Zahida Virani looks worth reaching out/);
  assert.match(String(writes[0]?.[fields.contacts.generatedProjectIdeas]), /AI-assisted internal workflow automation/);
  assert.match(String(writes[0]?.[fields.contacts.generatedDiscoveryPrompts]), /scattered data/);
  assert.equal(typeof writes[0]?.[fields.contacts.generatedCodeLabScore], "number");
  assert.equal(typeof writes[0]?.[fields.contacts.generatedTechRelevanceScore], "number");
  assert.match(String(writes[0]?.[fields.contacts.generatedScoreReason]), /Overall/);
  assert.equal(writes[0]?.[fields.contacts.generatedClientFitVersion], "client-fit-v5");
});

test("Contacts PATCH persists evidence fields", async () => {
  const writes: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(init?.method, "PATCH");
    assert.equal(url.pathname.endsWith(`/${tableRef("contacts")}/recContact000000`), true);
    const body = JSON.parse(String(init?.body)) as { fields: Record<string, unknown> };
    writes.push(body.fields);
    return Response.json({
      id: "recContact000000",
      createdTime: "2026-07-18T12:00:00.000Z",
      fields: {
        [fields.contacts.name]: "Zahida Virani",
        ...body.fields
      }
    });
  };

  const response = await PATCH(
    new Request("http://localhost/api/contacts/recContact000000", {
      method: "PATCH",
      body: JSON.stringify({
        linkedInUrl: "https://www.linkedin.com/in/zahida-virani",
        identityStatus: "Verified",
        organizationMatchStatus: "Needs Review",
        evidenceNotes: "Matched against company website."
      })
    }),
    { params: Promise.resolve({ id: "recContact000000" }) }
  );

  assert.equal(response.status, 200);
  const body = await response.json() as { contact: Record<string, unknown> };
  assert.equal(body.contact.linkedInUrl, "https://www.linkedin.com/in/zahida-virani");
  assert.equal(body.contact.identityStatus, "Verified");
  assert.equal(body.contact.organizationMatchStatus, "Needs Review");
  assert.equal(body.contact.evidenceNotes, "Matched against company website.");
  assert.equal(writes[0]?.[fields.contacts.linkedInUrl], "https://www.linkedin.com/in/zahida-virani");
  assert.equal(writes[0]?.[fields.contacts.identityStatus], "Verified");
  assert.equal(writes[0]?.[fields.contacts.organizationMatchStatus], "Needs Review");
  assert.equal(writes[0]?.[fields.contacts.evidenceNotes], "Matched against company website.");
  assert.equal(typeof writes[0]?.[fields.contacts.lastReviewedAt], "string");
});

test("Contacts client fit POST rejects oversized batches", async () => {
  const response = await POST(new Request("http://localhost/api/contacts/client-fit", {
    method: "POST",
    body: JSON.stringify({
      contactIds: Array.from({ length: 51 }, (_, index) => `recContact${String(index).padStart(6, "0")}`)
    })
  }));
  assert.equal(response.status, 400);
  const body = await response.json() as { issues: string[] };
  assert.match(body.issues.join(" "), /more than 50/);
});

test("Contacts API client saves generated client fit", async () => {
  const calls: Array<{ url: string; method?: string; body?: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined
    });
    return Response.json({
      savedIds: ["recContact000000"],
      missingIds: [],
      savedCount: 1,
      skippedCount: 0,
      updatedAt: "2026-07-18T12:00:00.000Z",
      version: "client-fit-v3"
    });
  };

  const result = await saveContactClientFit(["recContact000000"]);
  assert.equal(result.savedCount, 1);
  assert.deepEqual(calls, [{
    url: "/api/contacts/client-fit",
    method: "POST",
    body: { contactIds: ["recContact000000"] }
  }]);
});

test("Contacts API client saves evidence updates", async () => {
  const calls: Array<{ url: string; method?: string; body?: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined
    });
    return Response.json({
      contact: {
        id: "recContact000000",
        name: "Zahida Virani",
        linkedInUrl: "https://www.linkedin.com/in/zahida-virani",
        identityStatus: "Verified",
        organizationMatchStatus: "Verified",
        functionTags: [],
        workflows: [],
        autoWorkflowTags: [],
        courseIds: [],
        organizationIds: [],
        interactionIds: [],
        outreachOpportunityIds: [],
        importantDateIds: []
      }
    });
  };

  const result = await saveContactEvidence("recContact000000", {
    linkedInUrl: "https://www.linkedin.com/in/zahida-virani",
    identityStatus: "Verified",
    organizationMatchStatus: "Verified",
    outreachStatus: "DM Sent",
    lastContacted: "2026-07-22",
    nextFollowUp: "2026-07-28",
    notes: "Sent IPN sourcing DM."
  });
  assert.equal(result.identityStatus, "Verified");
  assert.deepEqual(calls, [{
    url: "/api/contacts/recContact000000",
    method: "PATCH",
    body: {
      linkedInUrl: "https://www.linkedin.com/in/zahida-virani",
      identityStatus: "Verified",
      organizationMatchStatus: "Verified",
      outreachStatus: "DM Sent",
      lastContacted: "2026-07-22",
      nextFollowUp: "2026-07-28",
      notes: "Sent IPN sourcing DM."
    }
  }]);
});

test("Contacts API client sends IPN sourcing intake options", async () => {
  const calls: Array<{ url: string; method?: string; body?: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined
    });
    return Response.json({
      contacts: [],
      parsedCount: 0,
      duplicateCount: 0,
      skippedCount: 0,
      updatedContacts: [],
      updatedCount: 0,
      createdContacts: [],
      createdCount: 0,
      scoredCount: 0,
      unmatchedContacts: []
    });
  };

  await updateExistingContactIntake("Noureen Nanjee\nProduct Manager @ Google", {
    sourceOverride: "IPN Directory Search",
    targetWorkflows: ["CodeLab Outreach", "Community"],
    createUnmatched: true,
    saveEligibleClientFit: true
  });

  assert.deepEqual(calls, [{
    url: "/api/contacts/intake",
    method: "POST",
    body: {
      rawText: "Noureen Nanjee\nProduct Manager @ Google",
      dryRun: false,
      action: "updateExisting",
      targetWorkflows: ["CodeLab Outreach", "Community"],
      sourceOverride: "IPN Directory Search",
      createUnmatched: true,
      saveEligibleClientFit: true
    }
  }]);
});

test("Contacts PATCH persists outreach tracking fields", async () => {
  const updates: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(init?.method, "PATCH");
    assert.equal(url.pathname.endsWith(`/${tableRef("contacts")}/recContact000000`), true);
    const body = JSON.parse(String(init?.body)) as { fields: Record<string, unknown> };
    updates.push(body.fields);
    return Response.json({
      id: "recContact000000",
      fields: {
        [fields.contacts.name]: "Noureen Nanjee",
        [fields.contacts.outreachStatus]: body.fields[fields.contacts.outreachStatus],
        [fields.contacts.lastContacted]: body.fields[fields.contacts.lastContacted],
        [fields.contacts.nextFollowUp]: body.fields[fields.contacts.nextFollowUp],
        [fields.contacts.notes]: body.fields[fields.contacts.notes]
      }
    });
  };

  const response = await PATCH(new Request("http://localhost/api/contacts/recContact000000", {
    method: "PATCH",
    body: JSON.stringify({
      outreachStatus: "DM Sent",
      lastContacted: "2026-07-22",
      nextFollowUp: "2026-07-28",
      notes: "Asked for CodeLab project sponsor intro."
    })
  }), { params: Promise.resolve({ id: "recContact000000" }) });

  assert.equal(response.status, 200);
  assert.equal(updates[0]?.[fields.contacts.outreachStatus], "DM Sent");
  assert.equal(updates[0]?.[fields.contacts.lastContacted], "2026-07-22");
  assert.equal(updates[0]?.[fields.contacts.nextFollowUp], "2026-07-28");
  assert.equal(updates[0]?.[fields.contacts.notes], "Asked for CodeLab project sponsor intro.");
});

test("Contacts intake POST previews and creates only non-duplicates", async () => {
  const created: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (init?.method === "GET") {
      assert.equal(url.pathname.endsWith(`/${tableRef("contacts")}`), true);
      return Response.json({
        records: [{
          id: "recExisting00000",
          fields: {
            [fields.contacts.name]: "Noureen Nanjee",
            [fields.contacts.company]: "Google"
          }
        }]
      });
    }

    assert.equal(init?.method, "POST");
    assert.equal(url.pathname.endsWith(`/${tableRef("contacts")}`), true);
    const body = JSON.parse(String(init?.body)) as {
      records: Array<{ fields: Record<string, unknown> }>;
      typecast?: boolean;
    };
    assert.equal(body.typecast, true);
    created.push(...body.records.map((record) => record.fields));
    return Response.json({
      records: body.records.map((record, index) => ({
        id: `recCreated00000${index}`,
        fields: record.fields
      }))
    });
  };

  const response = await POST_INTAKE(new Request("http://localhost/api/contacts/intake", {
    method: "POST",
    body: JSON.stringify({
      rawText: `
NN
Noureen Nanjee

Product Manager @ Google

Technology, Information and Internet

Google

menu icon
FH
Farhana Hirji

Product Manager and Product Owner

IT Services and IT Consulting

Genesys

menu icon
`,
      dryRun: false
    })
  }));

  assert.equal(response.status, 201);
  const body = await response.json() as {
    parsedCount: number;
    duplicateCount: number;
    createdContacts: Array<Record<string, unknown>>;
  };
  assert.equal(body.parsedCount, 2);
  assert.equal(body.duplicateCount, 1);
  assert.equal(body.createdContacts.length, 1);
  assert.equal(created.length, 1);
  assert.equal(created[0]?.[fields.contacts.name], "Farhana Hirji");
  assert.equal(created[0]?.[fields.contacts.company], "Genesys");
  assert.deepEqual(created[0]?.[fields.contacts.workflows], ["CodeLab Outreach"]);
});

test("Contacts intake POST updates existing contacts without creating new records", async () => {
  const updated: Array<{ id: string; fields: Record<string, unknown> }> = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (init?.method === "GET") {
      assert.equal(url.pathname.endsWith(`/${tableRef("contacts")}`), true);
      return Response.json({
        records: [{
          id: "recExisting00000",
          fields: {
            [fields.contacts.name]: "Nicholas Olson",
            [fields.contacts.company]: "Connected on July 20, 2026",
            [fields.contacts.headline]: "--"
          }
        }, {
          id: "recCurated000000",
          fields: {
            [fields.contacts.name]: "Cassandra Lee",
            [fields.contacts.company]: "Curated Company",
            [fields.contacts.headline]: "Curated headline"
          }
        }]
      });
    }

    assert.equal(init?.method, "PATCH");
    assert.equal(url.pathname.endsWith(`/${tableRef("contacts")}`), true);
    const body = JSON.parse(String(init?.body)) as {
      records: Array<{ id: string; fields: Record<string, unknown> }>;
    };
    updated.push(...body.records);
    return Response.json({
      records: body.records.map((record) => ({
        id: record.id,
        fields: {
          [fields.contacts.name]: record.id === "recExisting00000" ? "Nicholas Olson" : "Cassandra Lee",
          ...record.fields
        }
      }))
    });
  };

  const response = await POST_INTAKE(new Request("http://localhost/api/contacts/intake", {
    method: "POST",
    body: JSON.stringify({
      rawText: `
Nicholas Olson’s profile picture
Nicholas Olson
--
Connected on July 20, 2026
Message

Cassandra Lee’s profile picture
Cassandra Lee
Cognitive Science @ UC Davis
Connected on July 20, 2026
Message

Missing Person
Student
Connected on July 20, 2026
Message
`,
      dryRun: false,
      action: "updateExisting"
    })
  }));

  assert.equal(response.status, 200);
  const body = await response.json() as {
    updatedCount: number;
    unmatchedContacts: Array<Record<string, unknown>>;
  };
  assert.equal(body.updatedCount, 2);
  assert.equal(body.unmatchedContacts.length, 1);
  assert.equal(updated.length, 2);
  assert.equal(updated[0]?.id, "recExisting00000");
  assert.equal(updated[0]?.fields[fields.contacts.linkedInConnectedOn], "2026-07-20");
  assert.equal(updated[0]?.fields[fields.contacts.company], null);
  assert.equal(updated[0]?.fields[fields.contacts.headline], null);
  assert.equal(updated[1]?.id, "recCurated000000");
  assert.equal(updated[1]?.fields[fields.contacts.headline], undefined);
  assert.equal(updated[1]?.fields[fields.contacts.company], undefined);
  assert.equal(updated[1]?.fields[fields.contacts.linkedInConnectedOn], "2026-07-20");
});

test("Contacts intake POST can enrich personal network, create unmatched, and score eligible contacts", async () => {
  const updated: Array<{ id: string; fields: Record<string, unknown> }> = [];
  const created: Array<Record<string, unknown>> = [];
  const scored: Array<{ id: string; fields: Record<string, unknown> }> = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (init?.method === "GET") {
      assert.equal(url.pathname.endsWith(`/${tableRef("contacts")}`), true);
      return Response.json({
        records: [{
          id: "recAaron0000000",
          fields: {
            [fields.contacts.name]: "Aaron Zhuo",
            [fields.contacts.company]: "Curated Visa",
            [fields.contacts.headline]: "--",
            [fields.contacts.workflows]: ["CodeLab Outreach"]
          }
        }]
      });
    }

    const body = JSON.parse(String(init?.body)) as {
      records: Array<{ id?: string; fields: Record<string, unknown> }>;
      typecast?: boolean;
    };

    if (init?.method === "POST") {
      assert.equal(url.pathname.endsWith(`/${tableRef("contacts")}`), true);
      created.push(...body.records.map((record) => record.fields));
      return Response.json({
        records: body.records.map((record, index) => ({
          id: `recCreated00000${index}`,
          fields: record.fields
        }))
      });
    }

    assert.equal(init?.method, "PATCH");
    assert.equal(url.pathname.endsWith(`/${tableRef("contacts")}`), true);
    if (body.records.some((record) => fields.contacts.generatedCodeLabScore in record.fields)) {
      scored.push(...body.records as Array<{ id: string; fields: Record<string, unknown> }>);
    } else {
      updated.push(...body.records as Array<{ id: string; fields: Record<string, unknown> }>);
    }
    return Response.json({
      records: body.records.map((record) => ({
        id: record.id,
        fields: {
          [fields.contacts.name]: record.id === "recAaron0000000" ? "Aaron Zhuo" : "Created Contact",
          ...record.fields
        }
      }))
    });
  };

  const response = await POST_INTAKE(new Request("http://localhost/api/contacts/intake", {
    method: "POST",
    body: JSON.stringify({
      rawText: `
Aaron Zhuo’s profile picture
Aaron Zhuo

Product Analytics Manager @ Visa | Behavioral Science → AI | Berkeley Haas MBA | Co-founder @ yfint

Message

Eric Simone’s profile picture
Eric Simone

Founder & CEO at ClearBlade | Streaming Machine Data into AI with Proven Edge & Cloud Software | Industrial IoT & Edge AI | Google Cloud Premier Partner

Message
`,
      dryRun: false,
      action: "updateExisting",
      targetWorkflows: ["Personal Networking"],
      sourceOverride: "LinkedIn connections paste",
      createUnmatched: true,
      saveEligibleClientFit: true
    })
  }));

  assert.equal(response.status, 200);
  const result = await response.json() as {
    updatedCount: number;
    createdCount: number;
    scoredCount: number;
  };
  assert.equal(result.updatedCount, 1);
  assert.equal(result.createdCount, 1);
  assert.equal(result.scoredCount, 2);
  assert.equal(updated.length, 1);
  assert.equal(updated[0]?.id, "recAaron0000000");
  assert.equal(updated[0]?.fields[fields.contacts.company], undefined);
  assert.equal(updated[0]?.fields[fields.contacts.headline], "Product Analytics Manager @ Visa | Behavioral Science → AI | Berkeley Haas MBA | Co-founder @ yfint");
  assert.deepEqual(updated[0]?.fields[fields.contacts.workflows], ["CodeLab Outreach", "Personal Networking"]);
  assert.equal(created.length, 1);
  assert.equal(created[0]?.[fields.contacts.name], "Eric Simone");
  assert.deepEqual(created[0]?.[fields.contacts.workflows], ["Personal Networking"]);
  assert.equal(scored.length, 2);
  assert.equal(scored.every((record) => fields.contacts.generatedCodeLabScore in record.fields), true);
});
