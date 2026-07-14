# Aydin

A focused academic workspace backed by Airtable.

## Current Product

- `/` shows assignments in a list and calendar.
- `/assignments` redirects to `/`.
- `/courses` shows 13 quarters across four academic years.
- `/competencies` shows the Identity layer and focus timelines.
- Assignment completion writes immediately to Airtable and can be reversed.

## Setup

1. Install dependencies with `npm install`.
2. Create `.env` from `.env.example`.
3. Add an Airtable personal access token with record read/write access.
4. Start the app with `npm run dev`.

## Commands

```bash
npm test
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

The Airtable field contract is documented in
[`docs/airtable-schema.md`](docs/airtable-schema.md). The accepted Stitch
reference is retained in [`design-reference/stitch`](design-reference/stitch),
and current UI rules are documented in [`DESIGN.md`](DESIGN.md).

Long-term product decisions live in
[`docs/architecture.md`](docs/architecture.md), with implementation milestones
tracked in [`todo.md`](todo.md).
