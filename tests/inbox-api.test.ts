import test from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "../app/api/inbox/route.js";
import { DELETE } from "../app/api/inbox/[id]/route.js";
import {
  createInboxItem,
  deleteInboxItem,
  loadInboxItems
} from "../src/app/apiClient.js";
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

test("Inbox GET requests unprocessed records newest-first", async () => {
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.pathname.endsWith(`/${tableRef("inboxItems")}`), true);
    assert.equal(url.searchParams.get("filterByFormula"), "NOT({Processed})");
    assert.equal(url.searchParams.get("sort[0][field]"), fields.inboxItems.createdAt);
    assert.equal(url.searchParams.get("sort[0][direction]"), "desc");
    assert.equal(init?.method, "GET");
    return Response.json({
      records: [{
        id: "recInbox",
        fields: {
          [fields.inboxItems.text]: "Newest thought",
          [fields.inboxItems.createdAt]: "2026-06-30T18:00:00.000Z"
        }
      }]
    });
  };

  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(
    (await response.json() as { items: Array<{ text: string }> }).items[0]?.text,
    "Newest thought"
  );
});

test("Inbox POST validates and creates an unprocessed record", async () => {
  let requestBody: { fields: Record<string, unknown> } | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return Response.json({
      id: "recInbox",
      fields: requestBody?.fields ?? {}
    });
  };

  const response = await POST(
    new Request("http://localhost/api/inbox", {
      method: "POST",
      body: JSON.stringify({ text: "  Capture this  " })
    })
  );

  assert.equal(response.status, 201);
  assert.equal(requestBody?.fields[fields.inboxItems.text], "Capture this");
  assert.equal(requestBody?.fields[fields.inboxItems.processed], false);
  assert.equal(
    Number.isNaN(Date.parse(String(requestBody?.fields[fields.inboxItems.createdAt]))),
    false
  );
});

test("Inbox DELETE removes only the selected record", async () => {
  globalThis.fetch = async (input, init) => {
    assert.match(String(input), new RegExp(`${tableRef("inboxItems")}/rec%2Fone$`));
    assert.equal(init?.method, "DELETE");
    return Response.json({ id: "rec/one", deleted: true });
  };

  const response = await DELETE(
    new Request("http://localhost/api/inbox/rec%2Fone", { method: "DELETE" }),
    { params: Promise.resolve({ id: "rec%2Fone" }) }
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });
});

test("Inbox API client serializes create and delete operations", async () => {
  const calls: Array<{ url: string; method?: string; body?: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined
    });
    if (String(input) === "/api/inbox" && init?.method === "POST") {
      return Response.json({
        item: {
          id: "recInbox",
          text: "Capture this",
          createdAt: "2026-06-30T18:00:00.000Z",
          processed: false
        }
      }, { status: 201 });
    }
    if (String(input) === "/api/inbox") return Response.json({ items: [] });
    return Response.json({ deleted: true });
  };

  assert.deepEqual(await loadInboxItems(), []);
  assert.equal((await createInboxItem("Capture this")).id, "recInbox");
  await deleteInboxItem("rec/one");
  assert.deepEqual(calls, [
    { url: "/api/inbox", method: undefined, body: undefined },
    { url: "/api/inbox", method: "POST", body: { text: "Capture this" } },
    { url: "/api/inbox/rec%2Fone", method: "DELETE", body: undefined }
  ]);
});
