import test from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "../app/api/habits/route.js";
import { PATCH } from "../app/api/habits/[id]/route.js";
import { PATCH as PATCH_ORDER } from "../app/api/habits/order/route.js";
import {
  DELETE as DELETE_CHECK_IN,
  PUT
} from "../app/api/habits/[id]/check-ins/[date]/route.js";
import {
  createHabit,
  loadHabitWeek,
  reorderHabits,
  setHabitCheckIn,
  updateHabit
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

test("Habit week GET returns active habits, weekly check-ins, and all-time totals", async () => {
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(init?.method, "GET");
    if (url.pathname.endsWith(`/${tableRef("habits")}`)) {
      assert.equal(url.searchParams.get("filterByFormula"), `{Status}="Active"`);
      return Response.json({ records: [{
        id: "recHabit",
        fields: {
          [fields.habits.name]: "Gym",
          [fields.habits.targetDaysPerWeek]: 4,
          [fields.habits.status]: "Active",
          [fields.habits.createdAt]: "2026-06-20T12:00:00.000Z"
        }
      }] });
    }
    assert.ok(url.pathname.endsWith(`/${tableRef("habitCheckIns")}`));
    assert.equal(url.searchParams.get("filterByFormula"), null);
    return Response.json({ records: [
      {
        id: "recCheck",
        fields: {
          [fields.habitCheckIns.habit]: ["recHabit"],
          [fields.habitCheckIns.date]: "2026-07-01",
          [fields.habitCheckIns.createdAt]: "2026-07-01T12:00:00.000Z"
        }
      },
      {
        id: "recOlder",
        fields: {
          [fields.habitCheckIns.habit]: ["recHabit"],
          [fields.habitCheckIns.date]: "2026-06-20",
          [fields.habitCheckIns.createdAt]: "2026-06-20T12:00:00.000Z"
        }
      },
      {
        id: "recDuplicateOlder",
        fields: {
          [fields.habitCheckIns.habit]: ["recHabit"],
          [fields.habitCheckIns.date]: "2026-06-20",
          [fields.habitCheckIns.createdAt]: "2026-06-20T13:00:00.000Z"
        }
      },
      {
        id: "recOtherHabit",
        fields: {
          [fields.habitCheckIns.habit]: ["recOther"],
          [fields.habitCheckIns.date]: "2026-07-01",
          [fields.habitCheckIns.createdAt]: "2026-07-01T12:00:00.000Z"
        }
      }
    ] });
  };
  const response = await GET(new Request("http://localhost/api/habits?weekStart=2026-06-29"));
  assert.equal(response.status, 200);
  const body = await response.json() as {
    week: {
      habits: unknown[];
      checkIns: unknown[];
      totals: Array<{ habitId: string; completedSessions: number }>;
    };
  };
  assert.equal(body.week.habits.length, 1);
  assert.equal(body.week.checkIns.length, 1);
  assert.deepEqual(body.week.totals, [{ habitId: "recHabit", completedSessions: 2 }]);
});

test("Habit create and update serialize strict fields", async () => {
  const writes: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { fields: Record<string, unknown> };
    writes.push(body.fields);
    return Response.json({ id: "recHabit", fields: body.fields });
  };
  assert.equal((await POST(new Request("http://localhost/api/habits", {
    method: "POST",
    body: JSON.stringify({ name: " Gym ", targetDaysPerWeek: 4 })
  }))).status, 201);
  assert.equal((await PATCH(new Request("http://localhost/api/habits/recHabit", {
    method: "PATCH",
    body: JSON.stringify({ status: "archived" })
  }), { params: Promise.resolve({ id: "recHabit" }) })).status, 200);
  assert.equal(writes[0]?.[fields.habits.name], "Gym");
  assert.equal(writes[1]?.[fields.habits.status], "Archived");
});

test("Habit order PATCH persists spaced sort order values", async () => {
  const writes: Array<{ path: string; fields: Record<string, unknown> }> = [];
  globalThis.fetch = async (input, init) => {
    const body = JSON.parse(String(init?.body)) as { fields: Record<string, unknown> };
    writes.push({ path: new URL(String(input)).pathname, fields: body.fields });
    return Response.json({ id: "recHabit000000000", fields: body.fields });
  };

  const response = await PATCH_ORDER(new Request("http://localhost/api/habits/order", {
    method: "PATCH",
    body: JSON.stringify({
      habitIds: ["recHabit000000000", "recOther000000000"]
    })
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(writes.map((write) => write.fields[fields.habits.sortOrder]), [1000, 2000]);
  assert.ok(writes[0]?.path.endsWith(`/recHabit000000000`));
  assert.ok(writes[1]?.path.endsWith(`/recOther000000000`));
});

test("Habit check-in PUT is idempotent and DELETE removes matching records", async () => {
  let listCount = 0;
  let createCount = 0;
  let deleteCount = 0;
  globalThis.fetch = async (_input, init) => {
    if (init?.method === "GET") {
      listCount += 1;
      return Response.json({ records: listCount === 1 ? [] : [{
        id: "recCheck",
        fields: {
          [fields.habitCheckIns.habit]: ["recHabit"],
          [fields.habitCheckIns.date]: "2026-07-01"
        }
      }] });
    }
    if (init?.method === "POST") {
      createCount += 1;
      const body = JSON.parse(String(init.body)) as { fields: Record<string, unknown> };
      return Response.json({ id: "recCheck", fields: body.fields });
    }
    deleteCount += 1;
    return Response.json({ id: "recCheck", deleted: true });
  };
  const context = { params: Promise.resolve({ id: "recHabit", date: "2026-07-01" }) };
  assert.equal((await PUT(new Request("http://localhost", { method: "PUT" }), context)).status, 200);
  assert.equal((await DELETE_CHECK_IN(new Request("http://localhost", { method: "DELETE" }), context)).status, 200);
  assert.equal(createCount, 1);
  assert.equal(deleteCount, 1);
});

test("Habit API client serializes week, definition, and check-in operations", async () => {
  const calls: Array<{ url: string; method?: string; body?: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined
    });
    if (String(input).startsWith("/api/habits?")) {
      return Response.json({ week: {
        habits: [], checkIns: [], totals: [], weekStart: "2026-06-29", weekEnd: "2026-07-05"
      } });
    }
    if (init?.method === "PUT") {
      return Response.json({ checkIn: {
        id: "recCheck", habitId: "recHabit", date: "2026-07-01", createdAt: "now"
      } });
    }
    return Response.json({ habit: {
      id: "recHabit", name: "Gym", targetDaysPerWeek: 4, status: "active", createdAt: "now"
    } }, { status: init?.method === "POST" ? 201 : 200 });
  };
  await loadHabitWeek("2026-06-29");
  await createHabit("Gym", 4);
  await updateHabit("recHabit", { targetDaysPerWeek: 5 });
  await reorderHabits(["recHabit000000000", "recOther000000000"]);
  await setHabitCheckIn("recHabit", "2026-07-01", true);
  await setHabitCheckIn("recHabit", "2026-07-01", false);
  assert.deepEqual(calls.map((call) => [call.url, call.method]), [
    ["/api/habits?weekStart=2026-06-29", undefined],
    ["/api/habits", "POST"],
    ["/api/habits/recHabit", "PATCH"],
    ["/api/habits/order", "PATCH"],
    ["/api/habits/recHabit/check-ins/2026-07-01", "PUT"],
    ["/api/habits/recHabit/check-ins/2026-07-01", "DELETE"]
  ]);
  assert.deepEqual(calls[3]?.body, {
    habitIds: ["recHabit000000000", "recOther000000000"]
  });
});
