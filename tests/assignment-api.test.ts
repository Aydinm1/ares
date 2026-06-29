import test from "node:test";
import assert from "node:assert/strict";
import { GET as getAssignments } from "../app/api/assignments/route.js";
import { PATCH } from "../app/api/assignments/[id]/route.js";
import { GET as getCourses } from "../app/api/courses/route.js";
import {
  ApiClientError,
  loadAssignments,
  loadCourses,
  updateAssignmentCompletion
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

test("completion PATCH updates only Airtable Completed and returns the assignment", async () => {
  let requestBody: unknown;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.match(url, new RegExp(`${tableRef("assignments")}/rec%2Fone$`));
    assert.equal(init?.method, "PATCH");
    requestBody = JSON.parse(String(init?.body));
    return Response.json({
      id: "rec/one",
      fields: {
        [fields.assignments.title]: "Essay",
        [fields.assignments.completed]: true
      }
    });
  };

  const response = await PATCH(
    new Request("http://localhost/api/assignments/rec%2Fone", {
      method: "PATCH",
      body: JSON.stringify({ status: "submitted" })
    }),
    { params: Promise.resolve({ id: "rec%2Fone" }) }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(requestBody, {
    fields: { [fields.assignments.completed]: true }
  });
  assert.deepEqual(await response.json(), {
    assignment: {
      id: "rec/one",
      title: "Essay",
      status: "submitted",
      category: "other"
    }
  });
});

test("assignment and course GET routes return mapped Airtable records", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes(encodeURIComponent(tableRef("assignments")))) {
      return Response.json({
        records: [{
          id: "recAssignment",
          fields: {
            [fields.assignments.title]: "Essay",
            [fields.assignments.completed]: false
          }
        }]
      });
    }
    if (url.includes(encodeURIComponent(tableRef("courses")))) {
      return Response.json({
        records: [{
          id: "recCourse",
          fields: {
            [fields.courses.name]: "Writing",
            [fields.courses.quarterTaken]: "Fall 2024"
          }
        }]
      });
    }
    return Response.json({ records: [] });
  };

  const assignmentsResponse = await getAssignments();
  const coursesResponse = await getCourses();

  assert.equal(assignmentsResponse.status, 200);
  assert.equal(coursesResponse.status, 200);
  assert.equal(
    (await assignmentsResponse.json() as { assignments: Array<{ title: string }> })
      .assignments[0]?.title,
    "Essay"
  );
  assert.equal(
    (await coursesResponse.json() as { courses: Array<{ name: string }> })
      .courses[0]?.name,
    "Writing"
  );
});

test("assignment GET exposes Airtable failures as a non-2xx response", async () => {
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });

  const response = await getAssignments();

  assert.equal(response.status, 500);
  assert.match(
    String((await response.json() as { error: string }).error),
    /Airtable 503/
  );
});

test("completion PATCH exposes Airtable failures as non-2xx responses", async () => {
  globalThis.fetch = async () =>
    new Response('{"error":{"type":"SERVER_ERROR"}}', { status: 503 });

  const response = await PATCH(
    new Request("http://localhost/api/assignments/rec1", {
      method: "PATCH",
      body: JSON.stringify({ status: "not_started" })
    }),
    { params: Promise.resolve({ id: "rec1" }) }
  );

  assert.equal(response.status, 500);
  assert.match(
    String((await response.json() as { error: string }).error),
    /Airtable 503/
  );
});

test("workspace API client parses assignment and course responses", async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url === "/api/assignments") {
      return Response.json({
        assignments: [
          { id: "recA", title: "Essay", status: "not_started", category: "paper" }
        ]
      });
    }
    return Response.json({ courses: [{ id: "recC", name: "Writing" }] });
  };

  assert.equal((await loadAssignments())[0]?.id, "recA");
  assert.equal((await loadCourses())[0]?.id, "recC");
  assert.deepEqual(calls, ["/api/assignments", "/api/courses"]);
});

test("workspace API client serializes completion and propagates normalized errors", async () => {
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "/api/assignments/rec%2Fone");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      status: "not_started"
    });
    return Response.json(
      { error: "Airtable unavailable", issues: ["retry later"] },
      { status: 503 }
    );
  };

  await assert.rejects(
    () => updateAssignmentCompletion("rec/one", false),
    (error) =>
      error instanceof ApiClientError &&
      error.status === 503 &&
      error.message === "Airtable unavailable" &&
      error.issues?.[0] === "retry later"
  );
});
