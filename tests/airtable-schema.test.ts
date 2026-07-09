import test from "node:test";
import assert from "node:assert/strict";
import { AIRTABLE_BASE_ID, tables } from "../src/airtable/schema.js";

type ExpectedField = {
  id: string;
  name: string;
  type: string;
  linkedTableId?: string;
};

type ExpectedTable = {
  id: string;
  name: string;
  fields: ExpectedField[];
};

type AirtableField = {
  id: string;
  name: string;
  type: string;
  options?: { linkedTableId?: string };
};

type AirtableTable = {
  id: string;
  name: string;
  fields: AirtableField[];
};

const expectedSchema: ExpectedTable[] = [
  {
    id: tables.courses.id,
    name: tables.courses.name,
    fields: [
      { id: "fldX5u5DvwA3p8H3c", name: "Course Name", type: "singleLineText" },
      { id: "fldCB3mnZtG7iAt4I", name: "Professor", type: "singleLineText" },
      { id: "fld7mBgD6pwhJHsSA", name: "Credit Hours", type: "number" },
      { id: "fld2WYIRNWo1R8ANf", name: "Class Location", type: "singleLineText" },
      { id: "fldCoMazyRy1J6AUg", name: "Class Time", type: "singleLineText" },
      { id: "fldJOYnE4NnFY0JEd", name: "Office Hours", type: "multilineText" },
      { id: "fldNyDga1N0gZ43iy", name: "Office Hours Locations", type: "singleLineText" },
      { id: "fldwatKuN19hFgW8x", name: "Syllabus", type: "multipleAttachments" }
    ]
  },
  {
    id: tables.assignments.id,
    name: tables.assignments.name,
    fields: [
      { id: "fldU0xvLg3grCmonN", name: "Assignment Name", type: "singleLineText" },
      {
        id: "fldg8IIB1H8zwrSDH",
        name: "Courses",
        type: "multipleRecordLinks",
        linkedTableId: tables.courses.id
      },
      { id: "fldEisJqSaUIIDWy8", name: "Due Date", type: "dateTime" },
      { id: "fld4rCP4y8j3ulO0Y", name: "Points Earned", type: "number" },
      { id: "fldAWln49fynQWzFv", name: "Points Possible", type: "number" },
      { id: "fldA1MTcA1wh0GLA4", name: "Completed", type: "checkbox" },
      { id: "fldWDpMsq76I8xYq7", name: "Hidden from List", type: "checkbox" },
      {
        id: "fld33ksNpJYirqrfm",
        name: "Category Weights",
        type: "multipleRecordLinks",
        linkedTableId: tables.gradeCategories.id
      },
      { id: "fldAZvY3fCDuMp8gZ", name: "General Assignment Type", type: "singleSelect" },
      { id: "fldk4t3tyOGLZ1ncx", name: "Week", type: "singleSelect" }
    ]
  },
  {
    id: tables.inboxItems.id,
    name: tables.inboxItems.name,
    fields: [
      { id: "fldXAwX2jCPSsc5mx", name: "Text", type: "multilineText" },
      { id: "fldGB45UhXXCHgwv3", name: "Created At", type: "dateTime" },
      { id: "fld6uRZAHwr5Vj3Ni", name: "Processed", type: "checkbox" }
    ]
  },
  {
    id: tables.habits.id,
    name: tables.habits.name,
    fields: [
      { id: "fldH3LJ0SZ10an1Bx", name: "Name", type: "singleLineText" },
      { id: "fldqp5e6dK3fI0Dec", name: "Target Days per Week", type: "number" },
      { id: "fldvQy9duk70Ya72S", name: "Status", type: "singleSelect" },
      { id: "fldlkupf7xJ1aGF4Y", name: "Created At", type: "dateTime" }
    ]
  },
  {
    id: tables.habitCheckIns.id,
    name: tables.habitCheckIns.name,
    fields: [
      { id: "fldwKUd43qyAI3pMA", name: "Key", type: "singleLineText" },
      {
        id: "fldGv76U3A8srROqs",
        name: "Habit",
        type: "multipleRecordLinks",
        linkedTableId: tables.habits.id
      },
      { id: "fldTgiR19mBkjO2Qd", name: "Date", type: "date" },
      { id: "fldYkG614nyOBbXLB", name: "Created At", type: "dateTime" }
    ]
  }
];

test(
  "live Airtable schema matches the application contract",
  { skip: !process.env.AIRTABLE_API_KEY },
  async () => {
    const baseId = process.env.AIRTABLE_BASE_ID || AIRTABLE_BASE_ID;
    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${encodeURIComponent(baseId)}/tables`,
      {
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`
        }
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      assert.fail(
        [
          `Could not inspect Airtable schema (HTTP ${response.status}).`,
          "The token must have schema.bases:read access to this base.",
          detail
        ].join("\n")
      );
    }

    const body = (await response.json()) as { tables?: AirtableTable[] };
    assert.ok(Array.isArray(body.tables), "Airtable metadata response did not contain tables.");

    const mismatches = compareSchema(expectedSchema, body.tables);
    assert.equal(
      mismatches.length,
      0,
      `Airtable schema mismatches:\n${mismatches.map((item) => `- ${item}`).join("\n")}`
    );
  }
);

function compareSchema(expected: ExpectedTable[], actual: AirtableTable[]): string[] {
  const mismatches: string[] = [];
  const actualTables = new Map(actual.map((table) => [table.id, table]));

  for (const expectedTable of expected) {
    const actualTable = actualTables.get(expectedTable.id);
    if (!actualTable) {
      mismatches.push(
        `missing table ${expectedTable.name} (${expectedTable.id})`
      );
      continue;
    }
    if (actualTable.name !== expectedTable.name) {
      mismatches.push(
        `table ${expectedTable.id}: expected name "${expectedTable.name}", actual "${actualTable.name}"`
      );
    }

    const actualFields = new Map(
      actualTable.fields.map((field) => [field.id, field])
    );
    for (const expectedField of expectedTable.fields) {
      const actualField = actualFields.get(expectedField.id);
      const label = `${expectedTable.name}.${expectedField.name} (${expectedField.id})`;
      if (!actualField) {
        mismatches.push(`missing field ${label}`);
        continue;
      }
      if (actualField.name !== expectedField.name) {
        mismatches.push(
          `${label}: expected name "${expectedField.name}", actual "${actualField.name}"`
        );
      }
      if (actualField.type !== expectedField.type) {
        mismatches.push(
          `${label}: expected type "${expectedField.type}", actual "${actualField.type}"`
        );
      }
      if (
        expectedField.linkedTableId &&
        actualField.options?.linkedTableId !== expectedField.linkedTableId
      ) {
        mismatches.push(
          `${label}: expected linked table "${expectedField.linkedTableId}", actual "${actualField.options?.linkedTableId ?? "none"}"`
        );
      }
    }
  }

  return mismatches;
}
