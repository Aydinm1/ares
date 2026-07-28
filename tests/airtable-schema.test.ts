import test from "node:test";
import assert from "node:assert/strict";
import nextEnv from "@next/env";
import { AIRTABLE_BASE_ID, tables } from "../src/airtable/schema.js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

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
    id: tables.gradeCategories.id,
    name: tables.gradeCategories.name,
    fields: [
      { id: "fldFEB3hCPYfyr2gO", name: "Category Weight Name", type: "singleLineText" },
      {
        id: "fldlBGVyXIkQe2Vqy",
        name: "Courses",
        type: "multipleRecordLinks",
        linkedTableId: tables.courses.id
      },
      { id: "fldgGJJJ21BKz8UvO", name: "Weight (%)", type: "number" },
      {
        id: "fldHqh72rPBkcq9JK",
        name: "Assignments",
        type: "multipleRecordLinks",
        linkedTableId: tables.assignments.id
      },
      { id: "fldiEsM0oEomrMknp", name: "Calculation Type", type: "singleSelect" },
      { id: "fldlxgH2nfrXdNtC7", name: "Max Extra Credit (%)", type: "number" }
    ]
  },
  {
    id: tables.habits.id,
    name: tables.habits.name,
    fields: [
      { id: "fldH3LJ0SZ10an1Bx", name: "Name", type: "singleLineText" },
      { id: "fldqp5e6dK3fI0Dec", name: "Target Days per Week", type: "number" },
      { id: "fldvQy9duk70Ya72S", name: "Status", type: "singleSelect" },
      { id: "fldlkupf7xJ1aGF4Y", name: "Created At", type: "dateTime" },
      { id: "fldaZOaf1n7pM6gI5", name: "Sort Order", type: "number" }
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
  },
  {
    id: tables.competencies.id,
    name: tables.competencies.name,
    fields: [
      { id: "fldLPaOYlV8q9PMHr", name: "Name", type: "singleLineText" },
      { id: "fldJGN1g8f8bOnOXz", name: "Category", type: "singleLineText" },
      { id: "fldpNIekqsZz8q8XM", name: "Status", type: "singleSelect" },
      { id: "fld9z397rfbXr8oqC", name: "Vision", type: "multilineText" },
      { id: "fldALMslaKuA4dWdV", name: "Description", type: "multilineText" },
      { id: "fldGc8wPgPaEDw8xE", name: "Sort Order", type: "number" },
      { id: "fldOfW4VwMGeHP0oe", name: "Created At", type: "dateTime" }
    ]
  },
  {
    id: tables.competencyFocuses.id,
    name: tables.competencyFocuses.name,
    fields: [
      { id: "fldGMCdIXafvlAof4", name: "Title", type: "singleLineText" },
      {
        id: "fldG2ACQs6YOHuHZ8",
        name: "Competency",
        type: "multipleRecordLinks",
        linkedTableId: tables.competencies.id
      },
      { id: "fld6hhx7mMvdEYFCL", name: "Started At", type: "date" },
      { id: "fldRoJQK32UGOjuHl", name: "Ended At", type: "date" },
      { id: "fld9fLJmasqyggusr", name: "Notes", type: "multilineText" },
      { id: "fldy9bK3IHuyRMAqv", name: "End Reason", type: "multilineText" },
      { id: "fldeQ5Wa62LgKui5O", name: "Created At", type: "dateTime" }
    ]
  },
  {
    id: tables.contacts.id,
    name: tables.contacts.name,
    fields: [
      { id: "fldnrCMRMSKjhtLup", name: "Name", type: "singleLineText" },
      { id: "fldGFrLnXnHcpXmzi", name: "Email", type: "email" },
      { id: "fldET7kXEZhw8KqjN", name: "Course", type: "multipleRecordLinks", linkedTableId: tables.courses.id },
      { id: "fld9Ano4u99JWLmuV", name: "Generated Reach Out Reason", type: "multilineText" },
      { id: "fld37xGsAz1QOTZ1g", name: "Generated Project Ideas", type: "multilineText" },
      { id: "fld3QOuQc3928SmMd", name: "Generated Discovery Prompts", type: "multilineText" },
      { id: "fld0FfCx0iysGDcip", name: "Generated CodeLab Score", type: "number" },
      { id: "fldNRlijYI4y1XPir", name: "Generated Tech Relevance Score", type: "number" },
      { id: "fldnBnlA5bkDDm6tj", name: "Generated Authority Score", type: "number" },
      { id: "fldKsexOG3JpWQvyz", name: "Generated Project Source Score", type: "number" },
      { id: "fldrQl2YVLokfrXLa", name: "Generated Warm Path Score", type: "number" },
      { id: "fldFRkTgsiUzLPffl", name: "Generated Score Reason", type: "multilineText" },
      { id: "fldX06gLAzPPzcVdL", name: "Generated Client Fit Updated At", type: "dateTime" },
      { id: "fldlG9L38hSmsJ00d", name: "Generated Client Fit Version", type: "singleLineText" },
      { id: "fldaHl3fXdMfI8VAJ", name: "LinkedIn URL", type: "url" },
      { id: "fldeQTdUf1RkV1JSi", name: "LinkedIn Connected On", type: "date" },
      { id: "fldUw7ip8hXF45RNR", name: "Identity Status", type: "singleSelect" },
      { id: "fldd82LO106tlyVE8", name: "Organization Match Status", type: "singleSelect" },
      { id: "fldtpuELmI7JUT7Xd", name: "Evidence Notes", type: "multilineText" },
      { id: "fldpJQja9Qw5fNxPM", name: "Last Reviewed At", type: "dateTime" },
      { id: "fldoCrTjiMg2oidDB", name: "Workflows", type: "multipleSelects" },
      { id: "fldur3RmRvvwksQjD", name: "Auto Workflow Tags", type: "formula" },
      { id: "fldT1xbrfoaTjKR5o", name: "Relationship Type", type: "singleSelect" },
      { id: "fldDkO7AqQQ2WzkBm", name: "Personal Priority", type: "singleSelect" },
      { id: "fldGM0IPk4HvUJlUY", name: "Relationship Risk", type: "singleSelect" },
      { id: "fldtw8UCEn9lDGVER", name: "Outreach Readiness", type: "singleSelect" },
      { id: "fldmiF0TSbuYDtPcO", name: "Relationship Context", type: "multilineText" },
      { id: "fldainyJcZRDZx1vK", name: "Research Status", type: "singleSelect" },
      { id: "fldbcoTHwMCP0DHX7", name: "Research Dossier", type: "multilineText" },
      { id: "fldXvmSRNBgrXsUcF", name: "Research Source URLs", type: "multilineText" },
      { id: "fldwIOwQc5Qb1yHYM", name: "Last Researched At", type: "dateTime" },
      { id: "fld6cJoPdgQp8rYAG", name: "Birthday", type: "date" },
      { id: "fldLnY7br8mXdgPsl", name: "Last Contacted", type: "date" },
      { id: "fldAl8tes9C5Ivyjg", name: "Next Follow Up", type: "date" },
      { id: "fldH4nQL5TxpYX6bV", name: "Organizations", type: "multipleRecordLinks", linkedTableId: tables.organizations.id },
      { id: "fldXIywP9NxIazGlq", name: "Interactions", type: "multipleRecordLinks", linkedTableId: tables.interactions.id },
      { id: "fldDirj32sHtBUfdC", name: "Outreach Opportunities", type: "multipleRecordLinks", linkedTableId: tables.outreachOpportunities.id },
      { id: "fldTEFYOzhKjuInnZ", name: "Important Dates", type: "multipleRecordLinks", linkedTableId: tables.importantDates.id }
    ]
  },
  {
    id: tables.organizations.id,
    name: tables.organizations.name,
    fields: [
      { id: "fldrtlqvR57NonPmz", name: "Organization Name", type: "singleLineText" },
      { id: "fldcFljbsPmcbCsUh", name: "Organization Type", type: "singleSelect" },
      { id: "fldve4PyTFSoEg5Bw", name: "Website", type: "url" },
      { id: "fldH1Bsftdbgkz6D8", name: "LinkedIn URL", type: "url" },
      { id: "fldA7zJB5RSziZHqI", name: "Verification Status", type: "singleSelect" },
      { id: "fldxytJ66bHTuinSj", name: "Evidence URLs", type: "multilineText" },
      { id: "fldMJAJ9sw6odSnDy", name: "Description", type: "multilineText" },
      { id: "fld8FdsLAtu1AZ6JB", name: "Tech Relevance", type: "singleSelect" },
      { id: "fldOY3AlZVrNWrxZO", name: "Notes", type: "multilineText" },
      { id: "fldFgucJkHvp17XDW", name: "Contacts", type: "multipleRecordLinks", linkedTableId: tables.contacts.id },
      { id: "fld2s5jHp5a6M2Gex", name: "Outreach Opportunities", type: "multipleRecordLinks", linkedTableId: tables.outreachOpportunities.id }
    ]
  },
  {
    id: tables.interactions.id,
    name: tables.interactions.name,
    fields: [
      { id: "fldQ0bulzpwKoT7Zc", name: "Interaction Title", type: "singleLineText" },
      { id: "fldnncRHdWuZFUYf7", name: "Contacts", type: "multipleRecordLinks", linkedTableId: tables.contacts.id },
      { id: "fldpOgMz1Rtejvbay", name: "Interaction Date", type: "date" },
      { id: "fldjrwe5xisG53rW9", name: "Workflow", type: "singleSelect" }
    ]
  },
  {
    id: tables.outreachOpportunities.id,
    name: tables.outreachOpportunities.name,
    fields: [
      { id: "fldsmd7DYJkn8Ti8Z", name: "Opportunity Name", type: "singleLineText" },
      { id: "fldiGLynWJpsMVKyt", name: "Contacts", type: "multipleRecordLinks", linkedTableId: tables.contacts.id },
      { id: "fld4z9MGMpK66Ieln", name: "Organizations", type: "multipleRecordLinks", linkedTableId: tables.organizations.id },
      { id: "fldjtemQ4ShSLorMP", name: "Workflow", type: "singleSelect" },
      { id: "fldHLOIFif23nKOEv", name: "Stage", type: "singleSelect" }
    ]
  },
  {
    id: tables.importantDates.id,
    name: tables.importantDates.name,
    fields: [
      { id: "fldjvL6q7LqgG2JzG", name: "Date Name", type: "singleLineText" },
      { id: "fldKpCDpR5MHe7Yut", name: "Contacts", type: "multipleRecordLinks", linkedTableId: tables.contacts.id },
      { id: "fldhrhAFa7HM6GKEa", name: "Date", type: "date" },
      { id: "fldHsVGvfSzGy9Zmn", name: "Date Type", type: "singleSelect" }
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
