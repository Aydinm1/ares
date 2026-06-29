# Airtable Contract

The Assignments and Courses workspaces read from the `Assignment Tracker` base.
Field names are centralized in `src/airtable/schema.ts`.

## Courses

The Courses page reads:

- `Course Name`
- `Status`
- `Quarter Taken`
- `Grade`
- `Major Requirements`
- `GE Requirements Used`
- `Credit Hours`

Linked `Category Weights` records provide grade-policy context. Linked
`General Education Requirements` records are resolved to their `Category`
labels before reaching the browser.

## Assignments

The Assignments page reads:

- `Assignment Name`
- `Courses`
- `Due Date`
- `Points Earned`
- `Points Possible`
- `Completed`
- `Category Weights`
- `General Assignment Type`
- `Week`

The only write operation is the `Completed` checkbox. Checked records map to
domain status `submitted`; unchecked records map to `not_started`.

## Environment

```text
AIRTABLE_API_KEY=
AIRTABLE_BASE_ID=
```

`AIRTABLE_BASE_ID` is optional because the current base ID is the application
default. Credentials are read only by server-side API routes.
