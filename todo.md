# ARES Roadmap

## Working Rules

- [ ] Keep one active product milestone at a time.
- [ ] Every milestone must leave behind a useful non-AI workflow.
- [ ] Do not add navigation for unfinished workflows.
- [ ] Capture once and link records instead of copying information.
- [ ] Archive rather than delete durable records.
- [ ] Put speculative ideas in the parking lot instead of partially building them.
- [ ] Do not build analytics before enough Session data exists.
- [ ] Do not build AI before the corresponding manual workflow is dependable.

## Current Foundation

### Academic Workspace

- [x] Airtable-backed Courses
- [x] Airtable-backed Assignments
- [x] Assignment list and month calendar
- [x] Reversible assignment completion
- [x] Assignment editing and due-date management
- [x] Four-year plan with 13 quarters
- [x] Commit the Assignments and Courses page designs
- [ ] Update the live Airtable contract documentation after any schema changes

Exit criterion: Courses and Assignments remain trustworthy daily tools while
new modules are introduced.

## Next 8 Weeks

Assumption: 5-8 focused build hours per week. Actual recruiting work takes
priority over building tooling for recruiting.

### Week 1: Inbox, Foundation Conventions, Areas, and Projects

- [ ] Review and approve `docs/architecture.md`
- [ ] Back up the current Airtable base
- [ ] Rename the base to ARES
- [ ] Define common ID, lifecycle, timestamp, and archive conventions
- [x] Create the three-field Inbox Items table
- [x] Build five-second capture with only text input and automatic creation time
- [ ] Create Areas and Projects tables
- [ ] Add a compact Project list with create, status, and archive actions

Exit criterion: thoughts can be captured without classification, and an active
initiative can be managed under one Area without using raw Airtable.

### Week 2: Inbox Review, Work Items, and Daily Dashboard

- [ ] Create the Work Items table
- [ ] Build Inbox Review with process and delete actions
- [ ] Convert captures to Work Items or Projects using the captured text
- [ ] Leave captures unprocessed when their destination module does not exist
- [ ] Add Work Item create, complete, schedule, waiting, and archive actions
- [ ] Compose Work Items and Academic Assignments into one Daily Dashboard
- [ ] Keep each source record authoritative; do not duplicate Academic
      Assignments

Exit criterion: the dashboard is usable each morning to decide what to do and
each evening to close or reschedule work.

### Week 3: Activities and Sessions

- [ ] Create Activities and Sessions tables
- [ ] Add Activity management under one primary Area
- [ ] Build one-click minimal Session logging with an Activity and current time
- [ ] Add optional duration, takeaway, notes, accomplishments, challenge, and
      next step through progressive disclosure
- [ ] Link Sessions to an Activity and optionally to Projects, Work Items, and
      Academic Assignments
- [ ] Allow Work Items to link an Activity for prefilled Session logging
- [ ] Keep Work Item completion and Session creation completely independent
- [ ] Add recent Sessions to relevant Project and Activity views

Exit criterion: meaningful work can be logged in one click without a timer or
AI, enriched only when worthwhile, and recalled by Activity or outcome.

### Week 4: Recruiting Pipeline

- [ ] Create Organizations and minimal People tables
- [ ] Create Career Opportunities with explicit pipeline stages
- [ ] Add saved role, company, URL, source, deadline, and contact fields
- [ ] Build a scannable opportunity pipeline and list
- [ ] Add create, stage-change, archive, and deadline workflows

Exit criterion: every role of interest is tracked in one place from discovery
through final outcome.

### Week 5: Application Operations

- [ ] Add application details and submitted date
- [ ] Link follow-up Work Items and People
- [ ] Link the immutable submitted-resume Artifact to each application
- [ ] Show overdue follow-ups and upcoming deadlines on the Daily Dashboard
- [ ] Add a complete application timeline

Exit criterion: no application deadline, follow-up, contact, or submitted
resume output depends on memory.

### Week 6: Experiences and Bullet Library

- [ ] Create Experiences and Bullets tables
- [ ] Link Experiences to Organizations and Projects
- [ ] Capture role scope, outcomes, evidence, and date ranges
- [ ] Build reusable Bullet create/edit/select workflows
- [ ] Link Bullets to supporting Projects and Sessions
- [ ] Export an immutable resume Artifact from selected Experiences, Projects,
      and Bullets
- [ ] Store the ordered source manifest and generation time on the output
- [ ] Do not create a Resume Versions table

Exit criterion: a tailored resume can be assembled from reusable,
evidence-backed material, and every exported output remains traceable without
becoming an editable source.

### Week 7: Interview Preparation

- [ ] Add interview stages and scheduled interview records
- [ ] Link preparation Work Items and Documents to Career Opportunities
- [ ] Capture interview stories from Experiences, Projects, and Sessions
- [ ] Log interview-practice Sessions
- [ ] Add post-interview notes and follow-up Work Items

Exit criterion: each active interview has a visible preparation plan, evidence,
practice history, and follow-up.

### Week 8: Habit Tracker and Hardening

- [ ] Create Habit definitions linked to Activities
- [ ] Implement Monday-Sunday distinct-day progress
- [ ] Let a quick check create a minimal Session
- [ ] Allow at most one active Habit per Activity
- [ ] Keep the tracker limited to target, seven days, and current progress
- [ ] Review friction in Inbox, Work Items, Sessions, and Career Opportunities
- [ ] Fix workflow problems before adding another module
- [ ] Reassess the next eight weeks using recruiting needs and actual usage

Exit criterion: the simple 4/7 tracker is useful without analytics, and the
existing daily workflows are stable enough to continue expanding.

## Long-Term Product Phases

### Phase 4: Research Hub

Dependencies: Organizations, People, Work Items, Documents.

#### Milestone 4.1: Research Directory

- [ ] Add research opportunities and lab-oriented Organization views
- [ ] Add professor-oriented People views
- [ ] Link interests, eligibility, source, and deadlines

Usable outcome: labs, professors, and opportunities can be found and compared
without maintaining a separate spreadsheet.

#### Milestone 4.2: Outreach Pipeline

- [ ] Add outreach stages and last-contact dates
- [ ] Link follow-up Work Items
- [ ] Store email drafts as Documents

Usable outcome: every intended outreach has a visible status, draft, and next
action.

#### Milestone 4.3: Research Follow-Through

- [ ] Store meetings and notes as Documents
- [ ] Capture decisions and outcomes
- [ ] Create Projects or Work Items directly from accepted opportunities

Usable outcome: outreach conversations turn into tracked work without losing
context.

### Phase 5: Portfolio

Dependencies: Experiences, Projects, Sessions, Artifacts, Documents, Bullets.

#### Milestone 5.1: Portfolio Case Studies

- [ ] Create Portfolio Case Studies with exactly one primary Project or
      Experience
- [ ] Add structured narrative sections for problem, role, constraints,
      process, decisions, tradeoffs, results, and lessons
- [ ] Link supporting Projects, Experiences, Sessions, Artifacts, Documents,
      and Bullets
- [ ] Support draft, ready, published, and archived states

Usable outcome: a project or experience can be shaped into an authored
narrative without moving or duplicating its canonical facts.

#### Milestone 5.2: Portfolio Preview

- [ ] Render private previews from Case Studies and linked canonical records
- [ ] Handle missing media and incomplete records explicitly
- [ ] Support multiple Case Studies for different audiences or angles

Usable outcome: each Case Study renders as a complete preview without a
separate Portfolio content store.

#### Milestone 5.3: Publishing

- [ ] Publish only Case Studies in the published state
- [ ] Add stable slugs and public URLs
- [ ] Verify mobile, metadata, and accessibility
- [ ] Do not create Portfolio or Published Pages tables

Usable outcome: approved Case Studies become public generated pages while
their narrative and source data remain authoritative in ARES.

### Phase 6: People

Dependencies: minimal People and Organizations from Career Hub.

#### Milestone 6.1: Relationship Context

- [ ] Add relationship categories and context
- [ ] Add private notes and important links
- [ ] Show connected Organizations, Opportunities, and Experiences

Usable outcome: opening a Person record restores the context needed for the
next conversation.

#### Milestone 6.2: Interaction History

- [ ] Log meaningful interactions
- [ ] Link meeting notes and outreach Documents
- [ ] Show a chronological relationship history

Usable outcome: important conversations and commitments are searchable.

#### Milestone 6.3: Follow-Up

- [ ] Add optional follow-up dates
- [ ] Create linked Work Items rather than a second reminder system
- [ ] Add focused networking views

Usable outcome: relationship follow-ups appear in the same execution system as
other work.

### Phase 7: Knowledge and Reviews

Dependencies: Documents, Sessions, Work Items, Projects, Habits.

#### Milestone 7.1: Documents and Search

- [ ] Add note, research summary, meeting note, and journal views
- [ ] Support links to existing domain records
- [ ] Search titles, content, people, projects, and sources

Usable outcome: useful written context can be captured and retrieved without
remembering where it was filed.

#### Milestone 7.2: Weekly Review

- [ ] Generate a deterministic weekly review from Work Items, Sessions, and
      Habits
- [ ] Capture accomplishments, friction, decisions, and next-week focus
- [ ] Save the review as a linked Document

Usable outcome: a complete weekly review can be performed without AI.

#### Milestone 7.3: Knowledge Reuse

- [ ] Surface related Documents on Projects, People, and Experiences
- [ ] Add source and citation fields where appropriate
- [ ] Add manual summaries and evergreen status

Usable outcome: captured knowledge supports current work instead of becoming an
isolated archive.

### Phase 8: AI Enhancement Layer

Dependencies: stable manual workflows and sufficient structured history.

#### Milestone 8.1: Read-Only Assistance

- [ ] Add source-linked summaries and search answers
- [ ] Add pattern and risk insights over existing records
- [ ] Display uncertainty and source records

Usable outcome: AI can explain existing data without changing it.

#### Milestone 8.2: Drafting Assistance

- [ ] Draft Inbox classifications and planning suggestions
- [ ] Draft Weekly Reviews
- [ ] Draft resume tailoring and interview stories

Usable outcome: AI reduces writing and synthesis effort while the user remains
the editor.

#### Milestone 8.3: Reviewed Actions

- [ ] Add explicit previews for proposed writes
- [ ] Require human approval
- [ ] Record accepted, edited, and rejected proposals

Usable outcome: approved AI suggestions can update operational data without
making AI the source of truth.

### Phase 9: Derived Graph Layer

Dependencies: mature cross-domain links and proven graph queries.

#### Milestone 9.1: Derived Life Graph

- [ ] Project nodes and edges from existing linked records
- [ ] Add focused neighborhood views rather than one giant graph
- [ ] Trace every edge back to its source record

Usable outcome: a Project, Person, Competency, or Experience can be explored
through its meaningful connections.

#### Milestone 9.2: Network and Opportunity Views

- [ ] Add relationship and Organization network queries
- [ ] Add explainable opportunity matching
- [ ] Validate that graph views improve a real decision

Usable outcome: graph relationships help identify a contact, experience, or
opportunity that would otherwise be missed.

#### Milestone 9.3: Explicit Relationships

- [ ] Identify queries that cannot be served by derived links
- [ ] Add an explicit relationship record only when it carries unique metadata
- [ ] Reassess whether a graph database is actually required

Usable outcome: relationship complexity increases only in response to proven
queries.

### Phase 10: Agent and Automation Layer

Dependencies: stable APIs, permissions, audit history, and AI review controls.

#### Milestone 10.1: Safe Tool Operations

- [ ] Wrap supported operations in narrow typed tools
- [ ] Define read, write, destructive, and external-communication permissions
- [ ] Add dry-run and preview behavior

Usable outcome: tools can be invoked manually with predictable boundaries.

#### Milestone 10.2: Model Routing

- [ ] Route tasks by capability, cost, latency, and data sensitivity
- [ ] Log model choice and outcome
- [ ] Keep deterministic workflows available without a model

Usable outcome: AI tasks use an appropriate model without changing product
behavior.

#### Milestone 10.3: Approved Automation

- [ ] Add an automation audit log
- [ ] Require approval at defined risk boundaries
- [ ] Make agent writes reversible
- [ ] Add limited scheduled automations only after manual usage proves value

Usable outcome: repetitive trusted workflows can run automatically and remain
inspectable and recoverable.

## Parking Lot

### Academic Enhancements

Defer these until daily use reveals enough friction to justify reopening the
stable academic workspace.

- [ ] Add Assignment filtering by course week
- [ ] Add four-year-plan editing for course placement and academic details
- [ ] Build grade tracking from Assignment scores and Category Weights

### Other Deferred Work

- Session timers and interruption recovery
- Recurring Work Item engine
- Generic metrics and analytics
- Competency scoring
- Automated resume layout
- AI-owned memory
- Graph database
- Autonomous planning and execution
