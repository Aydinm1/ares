import test from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "../app/api/competencies/route.js";
import { PATCH } from "../app/api/competencies/[id]/route.js";
import { PATCH as PATCH_ORDER } from "../app/api/competencies/order/route.js";
import { POST as POST_FOCUS } from "../app/api/competencies/[id]/focuses/route.js";
import { PATCH as PATCH_FOCUS } from "../app/api/focuses/[id]/route.js";
import {
  createCompetency,
  createCompetencyFocus,
  loadCompetencies,
  reorderCompetencies,
  updateCompetency,
  updateCompetencyFocus
} from "../src/app/apiClient.js";
import { fields, tableRef } from "../src/airtable/schema.js";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.AIRTABLE_API_KEY;
process.env.AIRTABLE_API_KEY = "test-key";

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test.after(() => {
  if (originalApiKey === undefined) {
    delete process.env.AIRTABLE_API_KEY;
  } else {
    process.env.AIRTABLE_API_KEY = originalApiKey;
  }
});

test("Competency GET groups current and historical focuses", async () => {
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(init?.method, "GET");
    if (url.pathname.endsWith(`/${tableRef("competencies")}`)) {
      assert.equal(url.searchParams.get("filterByFormula"), `{Status}!="Archived"`);
      return Response.json({ records: [{
        id: "recSkill000000000",
        fields: {
          [fields.competencies.name]: "Piano",
          [fields.competencies.category]: "Creative",
          [fields.competencies.status]: "Current",
          [fields.competencies.vision]: "Play expressively.",
          [fields.competencies.sortOrder]: 1000,
          [fields.competencies.createdAt]: "2026-07-01T12:00:00.000Z"
        }
      }] });
    }
    assert.ok(url.pathname.endsWith(`/${tableRef("competencyFocuses")}`));
    return Response.json({ records: [
      {
        id: "recFocusCurrent0",
        fields: {
          [fields.competencyFocuses.competency]: ["recSkill000000000"],
          [fields.competencyFocuses.title]: "Improvisation",
          [fields.competencyFocuses.startedAt]: "2026-09-18"
        }
      },
      {
        id: "recFocusOlder00",
        fields: {
          [fields.competencyFocuses.competency]: ["recSkill000000000"],
          [fields.competencyFocuses.title]: "Chord Vocabulary",
          [fields.competencyFocuses.startedAt]: "2026-07-13",
          [fields.competencyFocuses.endedAt]: "2026-09-18"
        }
      }
    ] });
  };

  const response = await GET();
  assert.equal(response.status, 200);
  const body = await response.json() as {
    competencies: Array<{
      currentFocus?: { title: string };
      historicalFocuses: Array<{ title: string }>;
    }>;
  };
  assert.equal(body.competencies[0]?.currentFocus?.title, "Improvisation");
  assert.equal(body.competencies[0]?.historicalFocuses[0]?.title, "Chord Vocabulary");
});

test("Competency create, update, and order serialize strict fields", async () => {
  const writes: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { fields: Record<string, unknown> };
    writes.push(body.fields);
    return Response.json({ id: "recSkill000000000", fields: body.fields });
  };

  assert.equal((await POST(new Request("http://localhost/api/competencies", {
    method: "POST",
    body: JSON.stringify({ name: " Piano ", category: "Creative", vision: "Play." })
  }))).status, 201);
  assert.equal((await PATCH(new Request("http://localhost/api/competencies/recSkill000000000", {
    method: "PATCH",
    body: JSON.stringify({ status: "dormant" })
  }), { params: Promise.resolve({ id: "recSkill000000000" }) })).status, 200);
  assert.equal((await PATCH_ORDER(new Request("http://localhost/api/competencies/order", {
    method: "PATCH",
    body: JSON.stringify({ competencyIds: ["recSkill000000000", "recOther000000000"] })
  }))).status, 200);

  assert.equal(writes[0]?.[fields.competencies.name], "Piano");
  assert.equal(writes[1]?.[fields.competencies.status], "Dormant");
  assert.deepEqual(writes.slice(2).map((write) => write[fields.competencies.sortOrder]), [1000, 2000]);
});

test("Creating a focus ends the existing open focus", async () => {
  const writes: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (init?.method === "GET") {
      assert.ok(url.pathname.endsWith(`/${tableRef("competencyFocuses")}`));
      return Response.json({ records: [{
        id: "recFocusOpen000",
        fields: {
          [fields.competencyFocuses.competency]: ["recSkill000000000"],
          [fields.competencyFocuses.title]: "Chord Vocabulary",
          [fields.competencyFocuses.startedAt]: "2026-07-13"
        }
      }] });
    }
    const body = JSON.parse(String(init?.body)) as { fields: Record<string, unknown> };
    writes.push(body.fields);
    return Response.json({ id: "recFocusNew0000", fields: body.fields });
  };

  const response = await POST_FOCUS(new Request("http://localhost/api/competencies/recSkill000000000/focuses", {
    method: "POST",
    body: JSON.stringify({ title: "Improvisation", startedAt: "2026-09-18" })
  }), { params: Promise.resolve({ id: "recSkill000000000" }) });

  assert.equal(response.status, 201);
  assert.equal(writes[0]?.[fields.competencyFocuses.endedAt], "2026-09-18");
  assert.equal(writes[1]?.[fields.competencyFocuses.title], "Improvisation");
});

test("Focus PATCH serializes end reason", async () => {
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { fields: Record<string, unknown> };
    assert.deepEqual(body.fields, {
      [fields.competencyFocuses.endedAt]: "2026-09-18",
      [fields.competencyFocuses.endReason]: "Ready to shift."
    });
    return Response.json({ id: "recFocus0000000", fields: body.fields });
  };

  const response = await PATCH_FOCUS(new Request("http://localhost/api/focuses/recFocus0000000", {
    method: "PATCH",
    body: JSON.stringify({ endedAt: "2026-09-18", endReason: "Ready to shift." })
  }), { params: Promise.resolve({ id: "recFocus0000000" }) });
  assert.equal(response.status, 200);
});

test("Competency API client serializes list and mutations", async () => {
  const calls: Array<{ url: string; method?: string; body?: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined
    });
    if (String(input) === "/api/competencies" && !init?.method) {
      return Response.json({ competencies: [] });
    }
    if (String(input).includes("/focuses") || String(input).startsWith("/api/focuses/")) {
      return Response.json({ focus: {
        id: "recFocus0000000",
        competencyId: "recSkill000000000",
        title: "Improvisation",
        startedAt: "2026-09-18",
        createdAt: "now"
      } });
    }
    return Response.json({ competency: {
      id: "recSkill000000000",
      name: "Piano",
      status: "current",
      createdAt: "now"
    } }, { status: init?.method === "POST" ? 201 : 200 });
  };

  await loadCompetencies();
  await createCompetency({ name: "Piano" });
  await updateCompetency("recSkill000000000", { status: "dormant" });
  await reorderCompetencies(["recSkill000000000", "recOther000000000"]);
  await createCompetencyFocus("recSkill000000000", {
    title: "Improvisation",
    startedAt: "2026-09-18"
  });
  await updateCompetencyFocus("recFocus0000000", {
    endedAt: "2026-10-01",
    endReason: "Shifted."
  });

  assert.deepEqual(calls.map((call) => [call.url, call.method]), [
    ["/api/competencies", undefined],
    ["/api/competencies", "POST"],
    ["/api/competencies/recSkill000000000", "PATCH"],
    ["/api/competencies/order", "PATCH"],
    ["/api/competencies/recSkill000000000/focuses", "POST"],
    ["/api/focuses/recFocus0000000", "PATCH"]
  ]);
});
