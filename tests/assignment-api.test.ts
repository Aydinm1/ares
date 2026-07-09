import test from "node:test";
import assert from "node:assert/strict";
import { GET as getAssignments } from "../app/api/assignments/route.js";
import { PATCH } from "../app/api/assignments/[id]/route.js";
import { GET as getCourses } from "../app/api/courses/route.js";
import { clearRepositoryReadCache } from "../app/api/_lib/schoolRoutes.js";
import {
  ApiClientError,
  loadAssignments,
  loadCourses,
  updateAssignmentCompletion,
  updateAssignmentDetails,
  updateAssignmentVisibility
} from "../src/app/apiClient.js";
import { fields, tableRef } from "../src/airtable/schema.js";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.AIRTABLE_API_KEY;

process.env.AIRTABLE_API_KEY = "test-key";

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  clearRepositoryReadCache();
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
      category: "other",
      hiddenFromList: false
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

  const assignmentsResponse = await getAssignments(new Request("http://localhost/api/assignments"));
  const coursesResponse = await getCourses(new Request("http://localhost/api/courses"));

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

test("assignment GET uses cached Airtable reads until refresh is requested", async () => {
  let assignmentReads = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    assert.ok(url.includes(encodeURIComponent(tableRef("assignments"))));
    assignmentReads += 1;
    return Response.json({
      records: [{
        id: `recAssignment${assignmentReads}`,
        fields: {
          [fields.assignments.title]: `Essay ${assignmentReads}`,
          [fields.assignments.completed]: false
        }
      }]
    });
  };

  const first = await getAssignments(new Request("http://localhost/api/assignments"));
  const second = await getAssignments(new Request("http://localhost/api/assignments"));
  const refreshed = await getAssignments(
    new Request("http://localhost/api/assignments?refresh=1")
  );

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(refreshed.status, 200);
  assert.equal(assignmentReads, 2);
  assert.equal(
    (await second.json() as { assignments: Array<{ title: string }> }).assignments[0]?.title,
    "Essay 1"
  );
  assert.equal(
    (await refreshed.json() as { assignments: Array<{ title: string }> }).assignments[0]?.title,
    "Essay 2"
  );
});

test("course GET caches the multi-table Airtable read", async () => {
  let courseReads = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes(encodeURIComponent(tableRef("courses")))) {
      courseReads += 1;
      return Response.json({
        records: [{
          id: `recCourse${courseReads}`,
          fields: {
            [fields.courses.name]: `Writing ${courseReads}`,
            [fields.courses.quarterTaken]: "Fall 2024"
          }
        }]
      });
    }
    return Response.json({ records: [] });
  };

  const first = await getCourses(new Request("http://localhost/api/courses"));
  const second = await getCourses(new Request("http://localhost/api/courses"));

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(courseReads, 1);
  assert.equal(
    (await second.json() as { courses: Array<{ name: string }> }).courses[0]?.name,
    "Writing 1"
  );
});

test("assignment PATCH invalidates cached assignment reads", async () => {
  let assignmentReads = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.ok(url.includes(encodeURIComponent(tableRef("assignments"))));
    if (init?.method === "PATCH") {
      return Response.json({
        id: "recAssignment",
        fields: {
          [fields.assignments.title]: "Essay",
          [fields.assignments.completed]: true
        }
      });
    }
    assignmentReads += 1;
    return Response.json({
      records: [{
        id: "recAssignment",
        fields: {
          [fields.assignments.title]: `Essay ${assignmentReads}`,
          [fields.assignments.completed]: false
        }
      }]
    });
  };

  assert.equal((await getAssignments(new Request("http://localhost/api/assignments"))).status, 200);
  assert.equal((await getAssignments(new Request("http://localhost/api/assignments"))).status, 200);
  assert.equal(assignmentReads, 1);

  const patchResponse = await PATCH(
    new Request("http://localhost/api/assignments/recAssignment", {
      method: "PATCH",
      body: JSON.stringify({ status: "submitted" })
    }),
    { params: Promise.resolve({ id: "recAssignment" }) }
  );
  assert.equal(patchResponse.status, 200);

  assert.equal((await getAssignments(new Request("http://localhost/api/assignments"))).status, 200);
  assert.equal(assignmentReads, 2);
});

test("assignment PATCH updates editable Airtable fields", async () => {
  let requestBody: unknown;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return Response.json({
      id: "recAssignment",
      fields: {
        [fields.assignments.title]: "Revised essay",
        [fields.assignments.course]: ["rec12345678901234"],
        [fields.assignments.dueAt]: "2026-07-04T06:59:00.000Z",
        [fields.assignments.pointsPossible]: 20,
        [fields.assignments.weekLabel]: "2"
      }
    });
  };

  const response = await PATCH(
    new Request("http://localhost/api/assignments/recAssignment", {
      method: "PATCH",
      body: JSON.stringify({
        title: "Revised essay",
        courseId: "rec12345678901234",
        dueDate: "2026-07-03",
        dueTime: "",
        pointsPossible: 20,
        weekLabel: "2"
      })
    }),
    { params: Promise.resolve({ id: "recAssignment" }) }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(requestBody, {
    fields: {
      [fields.assignments.title]: "Revised essay",
      [fields.assignments.course]: ["rec12345678901234"],
      [fields.assignments.dueAt]: "2026-07-04T06:59:00.000Z",
      [fields.assignments.pointsPossible]: 20,
      [fields.assignments.weekLabel]: "2"
    }
  });
});

test("assignment PATCH updates hidden-from-list without completing work", async () => {
  let requestBody: unknown;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return Response.json({
      id: "recAssignment",
      fields: {
        [fields.assignments.title]: "Essay",
        [fields.assignments.completed]: false,
        [fields.assignments.hiddenFromList]: true
      }
    });
  };

  const response = await PATCH(
    new Request("http://localhost/api/assignments/recAssignment", {
      method: "PATCH",
      body: JSON.stringify({ hiddenFromList: true })
    }),
    { params: Promise.resolve({ id: "recAssignment" }) }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(requestBody, {
    fields: { [fields.assignments.hiddenFromList]: true }
  });
  assert.deepEqual(await response.json(), {
    assignment: {
      id: "recAssignment",
      title: "Essay",
      status: "not_started",
      category: "other",
      hiddenFromList: true
    }
  });
});

test("workspace API client serializes assignment visibility updates", async () => {
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "/api/assignments/recAssignment");
    assert.equal(init?.method, "PATCH");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      hiddenFromList: false
    });
    return Response.json({
      assignment: {
        id: "recAssignment",
        title: "Essay",
        status: "not_started",
        category: "other",
        hiddenFromList: false
      }
    });
  };

  assert.equal((await updateAssignmentVisibility("recAssignment", false)).hiddenFromList, false);
});

test("assignment GET exposes Airtable failures as a non-2xx response", async () => {
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });

  const response = await getAssignments(new Request("http://localhost/api/assignments"));

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

test("workspace API client serializes assignment editor updates", async () => {
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "/api/assignments/recAssignment");
    assert.equal(init?.method, "PATCH");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      title: "Revised essay",
      dueDate: "2026-07-03",
      dueTime: null
    });
    return Response.json({
      assignment: {
        id: "recAssignment",
        title: "Revised essay",
        status: "not_started",
        category: "paper",
        hiddenFromList: false
      }
    });
  };

  assert.equal(
    (await updateAssignmentDetails("recAssignment", {
      title: "Revised essay",
      dueDate: "2026-07-03",
      dueTime: null
    })).title,
    "Revised essay"
  );
});
