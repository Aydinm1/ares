"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Calculator,
  CircleAlert,
  CircleCheckBig,
  Compass,
  DatabaseZap,
  ExternalLink,
  GraduationCap,
  Inbox,
  ListTodo,
  RefreshCw,
  Save,
  Search,
  UsersRound,
} from "lucide-react";
import {
  AssignmentShell,
  WorkspaceHeader,
  type AssignmentSyncState,
} from "../assignment-ui";
import { loadContacts, saveContactClientFit, saveContactEvidence, updateExistingContactIntake } from "../../src/app/apiClient";
import { previewContactIntake, saveContactIntake } from "../../src/app/apiClient";
import { formatLastSyncedLabel } from "../../src/assignments";
import {
  CONTACT_INTELLIGENCE_VERSION,
  buildCodeLabProjectSourcingFit,
  buildContactIntelligence,
  buildPracticeOutreachFit
} from "../../src/contacts/intelligence";
import type { ContactIntakePreview, ParsedContactInput } from "../../src/contacts/intake";
import type {
  Contact,
  ContactOutreachReadiness,
  ContactRelationshipRisk,
  ContactResearchStatus,
  ContactVerificationStatus,
  ContactWorkflow
} from "../../src/domain";
import styles from "./contacts.module.css";

const icons = {
  assignments: <ListTodo size={19} strokeWidth={2} />,
  courses: <GraduationCap size={19} strokeWidth={2} />,
  intake: <Inbox size={19} strokeWidth={2} />,
  habits: <CircleCheckBig size={19} strokeWidth={2} />,
  competencies: <Compass size={19} strokeWidth={2} />,
  contacts: <UsersRound size={19} strokeWidth={2} />,
  grades: <Calculator size={19} strokeWidth={2} />,
  calendar: <CalendarDays size={17} strokeWidth={2} />,
  sync: <RefreshCw size={16} strokeWidth={2} />,
};

type ContactTab = "practice" | "sourcing" | "outreach" | "all" | "school" | "personal" | "birthdays" | "cleanup";
type IntakeMode = "linkedin" | "ipn" | "lead";

const tabs: Array<{ id: ContactTab; label: string }> = [
  { id: "practice", label: "Practice Outreach" },
  { id: "sourcing", label: "CodeLab Sourcing" },
  { id: "outreach", label: "Outreach" },
  { id: "all", label: "All People" },
  { id: "school", label: "School" },
  { id: "personal", label: "Personal" },
  { id: "birthdays", label: "Birthdays" },
  { id: "cleanup", label: "Needs Cleanup" },
];

const priorityOptions = ["All", "High", "Medium", "Low", "Skip", "Needs Review"] as const;
const prospectOptions = [
  "All",
  "Decision Maker",
  "Technical Leader",
  "Product",
  "Operator",
  "Student/Talent",
  "Community/Connector",
  "Low Signal",
  "Skip",
] as const;
const studentOptions = ["All", "Not Student", "Student", "Recent Grad", "Unknown"] as const;
const reviewOptions = ["All", "Auto Parsed", "Needs Review", "Reviewed", "Do Not Contact"] as const;
const scoreOptions = ["All", "8+", "7+", "6+", "Unscored"] as const;
const verificationOptions = ["Unverified", "Needs Review", "Verified", "Rejected"] as const;
const relationshipRiskOptions = [
  "Cold Practice",
  "Warm Light",
  "Warm Sensitive",
  "Big Ask Later",
  "Avoid / Need Context"
] as const satisfies readonly ContactRelationshipRisk[];
const relationshipRiskFilterOptions = ["All", ...relationshipRiskOptions] as const;
const outreachReadinessOptions = [
  "Practice Candidate",
  "Research First",
  "Ready to DM",
  "Ask Family Context",
  "Hold"
] as const satisfies readonly ContactOutreachReadiness[];
const outreachReadinessFilterOptions = ["All", ...outreachReadinessOptions] as const;
const researchStatusOptions = [
  "Not Started",
  "Queued",
  "Researched",
  "Needs More Sources"
] as const satisfies readonly ContactResearchStatus[];
const researchStatusFilterOptions = ["All", ...researchStatusOptions] as const;
const intakeModeOptions = ["linkedin", "ipn", "lead"] as const;
const CONTACT_FIT_BATCH_LIMIT = 50;

export function ContactsWorkspace() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [syncState, setSyncState] = useState<AssignmentSyncState>("syncing");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>();
  const [clock, setClock] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState<ContactTab>("sourcing");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<(typeof priorityOptions)[number]>("All");
  const [prospectType, setProspectType] = useState<(typeof prospectOptions)[number]>("All");
  const [studentStatus, setStudentStatus] = useState<(typeof studentOptions)[number]>("All");
  const [reviewStatus, setReviewStatus] = useState<(typeof reviewOptions)[number]>("All");
  const [scoreFilter, setScoreFilter] = useState<(typeof scoreOptions)[number]>("All");
  const [relationshipRisk, setRelationshipRisk] = useState<(typeof relationshipRiskFilterOptions)[number]>("All");
  const [outreachReadiness, setOutreachReadiness] = useState<(typeof outreachReadinessFilterOptions)[number]>("All");
  const [researchStatus, setResearchStatus] = useState<(typeof researchStatusFilterOptions)[number]>("All");
  const [selectedId, setSelectedId] = useState<string>();
  const [fitSaveState, setFitSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [fitSaveMessage, setFitSaveMessage] = useState<string>();
  const [intakeText, setIntakeText] = useState("");
  const [intakeMode, setIntakeMode] = useState<IntakeMode>("linkedin");
  const [intakePreview, setIntakePreview] = useState<ContactIntakePreview>();
  const [intakeState, setIntakeState] = useState<"idle" | "previewing" | "saving" | "saved" | "error">("idle");
  const [intakeMessage, setIntakeMessage] = useState<string>();

  const load = useCallback(async (options: { refresh?: boolean } = {}) => {
    setSyncState("syncing");
    try {
      const nextContacts = await loadContacts(options);
      setContacts(nextContacts);
      setError(undefined);
      setSyncState("synced");
      const syncedAt = new Date();
      setLastSyncedAt(syncedAt);
      setClock(syncedAt);
      setSelectedId((current) =>
        current && nextContacts.some((contact) => contact.id === current)
          ? current
          : nextContacts[0]?.id
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Contacts could not be loaded.");
      setSyncState("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const counts = useMemo(() => contactCounts(contacts), [contacts]);
  const filteredContacts = useMemo(
    () =>
      contacts.filter((contact) =>
        matchesTab(contact, activeTab) &&
        matchesSearch(contact, query) &&
        (priority === "All" || contact.priority === priority) &&
        (prospectType === "All" || contact.prospectType === prospectType) &&
        (studentStatus === "All" || contact.studentStatus === studentStatus) &&
        (reviewStatus === "All" || contact.reviewStatus === reviewStatus) &&
        (relationshipRisk === "All" || buildPracticeOutreachFit(contact).relationshipRisk === relationshipRisk) &&
        (outreachReadiness === "All" || buildPracticeOutreachFit(contact).outreachReadiness === outreachReadiness) &&
        (researchStatus === "All" || (contact.researchStatus ?? "Not Started") === researchStatus) &&
        matchesScoreFilter(contact, scoreFilter, activeTab)
      ).sort((a, b) => sortContactsForTab(a, b, activeTab)),
    [
      activeTab,
      contacts,
      outreachReadiness,
      priority,
      prospectType,
      query,
      relationshipRisk,
      researchStatus,
      reviewStatus,
      scoreFilter,
      studentStatus
    ]
  );
  const intakePreviewRows = useMemo(() => buildIntakePreviewRows(intakePreview), [intakePreview]);
  const selectedContact =
    filteredContacts.find((contact) => contact.id === selectedId) ?? filteredContacts[0];
  const pendingClientFitContacts = useMemo(
    () => filteredContacts.filter((contact) => contact.generatedClientFitVersion !== CONTACT_INTELLIGENCE_VERSION),
    [filteredContacts]
  );

  const saveVisibleClientFit = useCallback(async () => {
    const contactIds = pendingClientFitContacts.slice(0, CONTACT_FIT_BATCH_LIMIT).map((contact) => contact.id);
    if (!contactIds.length || fitSaveState === "saving") return;

    setFitSaveState("saving");
    setFitSaveMessage(undefined);
    try {
      const result = await saveContactClientFit(contactIds);
      setFitSaveState("saved");
      setFitSaveMessage(
        `Saved ${result.savedCount}${pendingClientFitContacts.length > CONTACT_FIT_BATCH_LIMIT ? ` of ${pendingClientFitContacts.length}` : ""} pending records to Airtable.`
      );
      await load({ refresh: true });
    } catch (saveError) {
      setFitSaveState("error");
      setFitSaveMessage(saveError instanceof Error ? saveError.message : "Client fit could not be saved.");
    }
  }, [fitSaveState, load, pendingClientFitContacts]);

  const handleEvidenceSaved = useCallback((updatedContact: Contact) => {
    setContacts((current) =>
      current.map((contact) => contact.id === updatedContact.id ? updatedContact : contact)
    );
    setSelectedId(updatedContact.id);
  }, []);

  const previewIntake = useCallback(async () => {
    if (!intakeText.trim() || intakeState === "previewing" || intakeState === "saving") return;
    setIntakeState("previewing");
    setIntakeMessage(undefined);
    try {
      const preview = await previewContactIntake(intakeText, intakeOptions(intakeMode));
      setIntakePreview(preview);
      setIntakeState("idle");
      setIntakeMessage(
        `Parsed ${preview.parsedCount} contacts, ${preview.duplicateCount} likely overlap${preview.duplicateCount === 1 ? "" : "s"}.`
      );
    } catch (previewError) {
      setIntakeState("error");
      setIntakeMessage(previewError instanceof Error ? previewError.message : "Contact intake could not be previewed.");
    }
  }, [intakeMode, intakeState, intakeText]);

  const saveIntake = useCallback(async () => {
    if (!intakeText.trim() || intakeState === "saving") return;
    setIntakeState("saving");
    setIntakeMessage(undefined);
    try {
      const result = await saveContactIntake(intakeText, intakeOptions(intakeMode));
      setContacts((current) => [...result.createdContacts, ...current]);
      setIntakePreview(result);
      setIntakeState("saved");
      setIntakeMessage(`Saved ${result.createdContacts.length} new contacts to Airtable. Skipped ${result.duplicateCount} likely overlap${result.duplicateCount === 1 ? "" : "s"}.`);
      if (result.createdContacts[0]) setSelectedId(result.createdContacts[0].id);
    } catch (saveError) {
      setIntakeState("error");
      setIntakeMessage(saveError instanceof Error ? saveError.message : "Contact intake could not be saved.");
    }
  }, [intakeMode, intakeState, intakeText]);

  const updateExistingIntake = useCallback(async () => {
    if (!intakeText.trim() || intakeState === "saving") return;
    setIntakeState("saving");
    setIntakeMessage(undefined);
    try {
      const result = await updateExistingContactIntake(intakeText, intakeOptions(intakeMode));
      setIntakePreview(result);
      setIntakeState("saved");
      setIntakeMessage(
        `Updated ${result.updatedCount} existing contacts, created ${result.createdCount}, and scored ${result.scoredCount} eligible contact${result.scoredCount === 1 ? "" : "s"} in Airtable.`
      );
      await load({ refresh: true });
    } catch (saveError) {
      setIntakeState("error");
      setIntakeMessage(saveError instanceof Error ? saveError.message : "Existing contacts could not be updated.");
    }
  }, [intakeMode, intakeState, intakeText, load]);

  const syncLabel =
    syncState === "syncing"
      ? "Syncing..."
      : syncState === "error"
        ? "Sync failed"
        : lastSyncedAt
          ? formatLastSyncedLabel(lastSyncedAt, clock)
          : "Not synced";

  return (
    <AssignmentShell activeNav="contacts" icons={icons}>
      <WorkspaceHeader
        dateLabel="People CRM"
        title="Contacts"
        summary={
          <>
            <strong>{counts.total} people</strong>, {counts.highSignal} CodeLab sourcing leads, {counts.cleanup} needing cleanup.
          </>
        }
        syncState={syncState}
        syncLabel={syncLabel}
        icons={{ calendar: icons.calendar, sync: icons.sync }}
        onSync={() => void load({ refresh: true })}
      />

      <section className={styles.workspace} aria-label="Contacts workspace">
        <div className={styles.metrics} aria-label="Contact summary">
          <Metric label="Sources" value={counts.highSignal} />
          <Metric label="Practice" value={counts.practice} />
          <Metric label="Decision Makers" value={counts.decisionMakers} />
          <Metric label="Product" value={counts.product} />
          <Metric label="Technical" value={counts.technical} />
          <Metric label="Cleanup" value={counts.cleanup} />
        </div>

        <section className={styles.intakePanel} aria-label="Contact intake">
          <div className={styles.intakeHeader}>
            <div>
              <p>Bulk Intake</p>
              <h2>Paste scraped contact cards</h2>
            </div>
            <div className={styles.intakeActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={!intakeText.trim() || intakeState === "previewing" || intakeState === "saving"}
                onClick={() => void previewIntake()}
              >
                Preview
              </button>
              <button
                className={styles.primaryButton}
                type="button"
                disabled={!intakeText.trim() || intakeState === "saving"}
                onClick={() => void saveIntake()}
              >
                {intakeState === "saving" ? "Saving" : "Save New"}
              </button>
              <button
                className={styles.primaryButton}
                type="button"
                disabled={!intakeText.trim() || intakeState === "saving"}
                onClick={() => void updateExistingIntake()}
              >
                Update Existing
              </button>
            </div>
          </div>
          <div className={styles.intakeModeRow}>
            <Select<IntakeMode>
              label="Source"
              value={intakeMode}
              options={intakeModeOptions}
              onChange={setIntakeMode}
            />
            <p>
              {intakeMode === "ipn"
                ? "IPN imports save as CodeLab Outreach + Community and score eligible records."
                : intakeMode === "lead"
                  ? "Lead queue previews rank pasted names or snippets by project sourcing value before you save them."
                : "LinkedIn imports save as Personal Networking and score eligible records."}
            </p>
          </div>
          <textarea
            className={styles.intakeTextArea}
            value={intakeText}
            onChange={(event) => {
              setIntakeText(event.target.value);
              setIntakePreview(undefined);
              setIntakeMessage(undefined);
              setIntakeState("idle");
            }}
            placeholder="Paste IPN or LinkedIn contact blocks here..."
            rows={6}
          />
          {intakeMessage ? <p className={styles.intakeStatus} data-state={intakeState}>{intakeMessage}</p> : null}
          {intakePreviewRows.length ? (
            <div className={styles.intakePreview} aria-label="Parsed contact preview">
              {intakePreviewRows.slice(0, 12).map(({ contact, intelligence, sourcing, status }) => {
                return (
                  <article
                    className={styles.intakePreviewRow}
                    data-duplicate={Boolean(contact.duplicateReason)}
                    key={`${contact.duplicateKey}-${contact.name}`}
                  >
                    <div>
                      <strong>{contact.name}</strong>
                      <span>{contact.headline ?? "No headline"}</span>
                    </div>
                    <span>{contact.company ?? "Unknown org"}</span>
                    <span className={styles.pills}>
                      <Pill>Source {formatScore(sourcing.score)}</Pill>
                      <Pill>Fit {formatScore(intelligence.score.overall)}</Pill>
                      <Pill>{sourcing.suggestedAsk}</Pill>
                      <Pill>{sourcing.role}</Pill>
                      <Pill>{contact.priority}</Pill>
                    </span>
                    <em>{status}</em>
                  </article>
                );
              })}
              {intakePreviewRows.length > 12 ? (
                <p className={styles.previewMore}>Showing 12 of {intakePreviewRows.length} parsed leads.</p>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className={styles.tabs} aria-label="Contact views">
          {tabs.map((tab) => (
            <button
              className={styles.tab}
              data-active={activeTab === tab.id}
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedId(undefined);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.filters}>
          <label className={styles.searchBox}>
            <Search size={16} aria-hidden="true" />
            <span className={styles.visuallyHidden}>Search contacts</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, company, headline, notes"
            />
          </label>
          <Select label="Priority" value={priority} options={priorityOptions} onChange={setPriority} />
          <Select label="Type" value={prospectType} options={prospectOptions} onChange={setProspectType} />
          <Select label="Student" value={studentStatus} options={studentOptions} onChange={setStudentStatus} />
          <Select label="Review" value={reviewStatus} options={reviewOptions} onChange={setReviewStatus} />
          <Select label="Score" value={scoreFilter} options={scoreOptions} onChange={setScoreFilter} />
          <Select label="Risk" value={relationshipRisk} options={relationshipRiskFilterOptions} onChange={setRelationshipRisk} />
          <Select label="Ready" value={outreachReadiness} options={outreachReadinessFilterOptions} onChange={setOutreachReadiness} />
          <Select label="Research" value={researchStatus} options={researchStatusFilterOptions} onChange={setResearchStatus} />
        </div>

        {loading ? <ContactSkeleton /> : null}
        {!loading && error ? (
          <div className={styles.state}>
            <CircleAlert size={22} aria-hidden="true" />
            <div>
              <h2>Contacts could not be loaded</h2>
              <p>{error}</p>
              <button type="button" onClick={() => void load({ refresh: true })}>Try again</button>
            </div>
          </div>
        ) : null}
        {!loading && !error ? (
          <div className={styles.contactGrid}>
            <section className={styles.listPanel} aria-label={`${filteredContacts.length} contacts`}>
              <header className={styles.listHeader}>
                <span>{filteredContacts.length} shown</span>
                <button
                  className={styles.saveFitButton}
                  type="button"
                  disabled={!pendingClientFitContacts.length || fitSaveState === "saving"}
                  onClick={() => void saveVisibleClientFit()}
                >
                  <DatabaseZap size={14} aria-hidden="true" />
                  {fitSaveState === "saving" ? "Saving" : `Save ${Math.min(pendingClientFitContacts.length, CONTACT_FIT_BATCH_LIMIT)}`}
                </button>
                <span>{activeTabLabel(activeTab)}</span>
              </header>
              {fitSaveMessage ? (
                <p className={styles.saveFitStatus} data-state={fitSaveState}>{fitSaveMessage}</p>
              ) : null}
              <div className={styles.contactList}>
                {filteredContacts.map((contact) => {
                  const sourcing = buildCodeLabProjectSourcingFit(contact);
                  const practice = buildPracticeOutreachFit(contact);
                  const primaryScore = scoreForTab(contact, activeTab);
                  return (
                    <button
                      className={styles.contactRow}
                      data-selected={selectedContact?.id === contact.id}
                      key={contact.id}
                      type="button"
                      onClick={() => setSelectedId(contact.id)}
                    >
                      <span className={styles.identity}>
                        <strong>{contact.name}</strong>
                        <span>{contact.headline ?? contact.role ?? "No headline"}</span>
                      </span>
                      <span className={styles.company}>{contact.company ?? contact.source ?? "Unknown"}</span>
                      <span className={styles.pills}>
                        <Pill>{activeTab === "sourcing" ? "Source" : "Fit"} {formatScore(primaryScore)}</Pill>
                        {activeTab === "sourcing" ? <Pill>Fit {formatScore(contactScore(contact))}</Pill> : null}
                        {activeTab === "sourcing" ? <Pill>{sourcing.suggestedAsk}</Pill> : null}
                        {activeTab === "sourcing" ? <Pill>{sourcing.role}</Pill> : null}
                        {activeTab === "practice" ? <Pill>{practice.relationshipRisk}</Pill> : null}
                        {activeTab === "practice" ? <Pill>{practice.outreachReadiness}</Pill> : null}
                        {activeTab === "practice" ? <Pill>{contact.researchStatus ?? "Not Started"}</Pill> : null}
                        {contact.priority ? <Pill>{contact.priority}</Pill> : null}
                        {contact.prospectType ? <Pill>{contact.prospectType}</Pill> : null}
                        {contact.studentStatus === "Student" ? <Pill>Student</Pill> : null}
                      </span>
                    </button>
                  );
                })}
                {!filteredContacts.length ? (
                  <div className={styles.emptyList}>
                    <Inbox size={21} aria-hidden="true" />
                    <p>No contacts match these filters.</p>
                  </div>
                ) : null}
              </div>
            </section>
            <ContactDetail contact={selectedContact} onEvidenceSaved={handleEvidenceSaved} />
          </div>
        ) : null}
      </section>
    </AssignmentShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.metric}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className={styles.filterField}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function ContactDetail({
  contact,
  onEvidenceSaved
}: {
  contact?: Contact;
  onEvidenceSaved: (contact: Contact) => void;
}) {
  if (!contact) {
    return (
      <aside className={styles.detailPanel}>
        <div className={styles.emptyDetail}>
          <UsersRound size={24} aria-hidden="true" />
          <p>Select a contact to inspect the CRM record.</p>
        </div>
      </aside>
    );
  }

  const intelligence = buildContactIntelligence(contact);
  const sourcing = buildCodeLabProjectSourcingFit(contact);

  return (
    <aside className={styles.detailPanel} aria-label={`${contact.name} details`}>
      <div className={styles.detailHeader}>
        <p>{contact.prospectType ?? "Contact"}</p>
        <h2>{contact.name}</h2>
        <span>{contact.headline ?? contact.role ?? "No headline captured"}</span>
      </div>
      <div className={styles.detailSection}>
        <DetailRow label="Company" value={contact.company} />
        <DetailRow label="Source" value={contact.source} />
        <DetailRow label="Search" value={contact.searchTerm} />
        <DetailRow label="Seniority" value={contact.seniority} />
        <DetailRow label="Project Potential" value={contact.projectPotential} />
        <DetailRow label="Review" value={contact.reviewStatus} />
        <DetailRow label="Relationship Risk" value={buildPracticeOutreachFit(contact).relationshipRisk} />
        <DetailRow label="Readiness" value={buildPracticeOutreachFit(contact).outreachReadiness} />
        <DetailRow label="Research" value={contact.researchStatus ?? "Not Started"} />
        <DetailRow label="Saved Fit" value={formatDateTime(contact.generatedClientFitUpdatedAt)} />
      </div>
      <EvidenceEditor contact={contact} onEvidenceSaved={onEvidenceSaved} />
      <RelationshipEditor contact={contact} onSaved={onEvidenceSaved} />
      <ResearchEditor contact={contact} onSaved={onEvidenceSaved} />
      <OutreachEditor contact={contact} onSaved={onEvidenceSaved} />
      <div className={styles.tagCloud}>
        {[...contact.workflows, ...contact.autoWorkflowTags, ...contact.functionTags]
          .filter((tag, index, tags) => tags.indexOf(tag) === index)
          .map((tag) => <Pill key={tag}>{tag}</Pill>)}
      </div>
      <div className={styles.clientFit} data-low-signal={intelligence.lowSignal}>
        <div className={styles.sectionHeader}>
          <p>CodeLab Sourcing</p>
          <h3>{sourcing.suggestedAsk}</h3>
        </div>
        <div className={styles.tagCloud}>
          <Pill>{sourcing.role}</Pill>
          <Pill>{sourcing.projectBar}</Pill>
          <Pill>{sourcing.personalRisk}</Pill>
          {sourcing.technicalLanes.map((lane) => <Pill key={lane}>{lane}</Pill>)}
        </div>
        <p className={styles.fitReason}>{sourcing.message}</p>
        <div className={styles.fitBlock}>
          <h4>Why this queue</h4>
          <ul>
            {sourcing.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </div>
      </div>
      <div className={styles.clientFit} data-low-signal={intelligence.lowSignal}>
        <div className={styles.scoreCard}>
          <div>
            <span>CodeLab Score</span>
            <strong>{formatScore(intelligence.score.overall)}</strong>
          </div>
          <div className={styles.scoreBreakdown}>
            <ScoreItem label="Tech" value={intelligence.score.techRelevance} />
            <ScoreItem label="Project" value={intelligence.score.projectSource} />
            <ScoreItem label="Authority" value={intelligence.score.authority} />
            <ScoreItem label="Warm Path" value={intelligence.score.warmPath} />
          </div>
        </div>
        <p className={styles.scoreReason}>{intelligence.score.reason}</p>
        <div className={styles.sectionHeader}>
          <p>Client Fit</p>
          <h3>Why reach out</h3>
        </div>
        <p className={styles.fitReason}>{intelligence.reachOutReason}</p>
        {intelligence.reasonSignals.length ? (
          <div className={styles.fitBlock}>
            <h4>Grounding signals</h4>
            <ul>
              {intelligence.reasonSignals.map((signal) => <li key={signal}>{signal}</li>)}
            </ul>
          </div>
        ) : null}
        {intelligence.capturedProjectAngles.length ? (
          <div className={styles.fitBlock}>
            <h4>Captured angles</h4>
            <ul>
              {intelligence.capturedProjectAngles.map((angle) => <li key={angle}>{angle}</li>)}
            </ul>
          </div>
        ) : null}
        {intelligence.projectIdeas.length ? (
          <div className={styles.fitBlock}>
            <h4>Potential project types</h4>
            <div className={styles.projectIdeas}>
              {intelligence.projectIdeas.map((idea) => (
                <article className={styles.projectIdea} key={idea.title}>
                  <strong>{idea.title}</strong>
                  <span>{idea.rationale}</span>
                </article>
              ))}
            </div>
          </div>
        ) : null}
        <div className={styles.fitBlock}>
          <h4>Discovery prompts</h4>
          <ul>
            {intelligence.discoveryPrompts.map((prompt) => <li key={prompt}>{prompt}</li>)}
          </ul>
        </div>
      </div>
      <div className={styles.detailSection}>
        <DetailRow label="Birthday" value={formatDate(contact.birthday)} />
        <DetailRow label="Last Contacted" value={formatDate(contact.lastContacted)} />
        <DetailRow label="Next Follow Up" value={formatDate(contact.nextFollowUp)} />
        <DetailRow label="Last Reviewed" value={formatDateTime(contact.lastReviewedAt)} />
      </div>
      <div className={styles.linkCounts}>
        <Metric label="Organizations" value={contact.organizationIds.length} />
        <Metric label="Interactions" value={contact.interactionIds.length} />
        <Metric label="Opportunities" value={contact.outreachOpportunityIds.length} />
        <Metric label="Dates" value={contact.importantDateIds.length} />
      </div>
      {contact.potentialProjectAngles || contact.codeLabFitReason || contact.notes ? (
        <div className={styles.notes}>
          <h3>Notes</h3>
          {contact.potentialProjectAngles ? <p>{contact.potentialProjectAngles}</p> : null}
          {contact.codeLabFitReason ? <p>{contact.codeLabFitReason}</p> : null}
          {contact.notes ? <p>{contact.notes}</p> : null}
        </div>
      ) : null}
    </aside>
  );
}

function EvidenceEditor({
  contact,
  onEvidenceSaved
}: {
  contact: Contact;
  onEvidenceSaved: (contact: Contact) => void;
}) {
  const [linkedInUrl, setLinkedInUrl] = useState(contact.linkedInUrl ?? "");
  const [identityStatus, setIdentityStatus] = useState<ContactVerificationStatus>(
    contact.identityStatus ?? "Unverified"
  );
  const [organizationMatchStatus, setOrganizationMatchStatus] = useState<ContactVerificationStatus>(
    contact.organizationMatchStatus ?? "Unverified"
  );
  const [evidenceNotes, setEvidenceNotes] = useState(contact.evidenceNotes ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    setLinkedInUrl(contact.linkedInUrl ?? "");
    setIdentityStatus(contact.identityStatus ?? "Unverified");
    setOrganizationMatchStatus(contact.organizationMatchStatus ?? "Unverified");
    setEvidenceNotes(contact.evidenceNotes ?? "");
    setSaveState("idle");
    setMessage(undefined);
  }, [contact]);

  const save = useCallback(async () => {
    if (saveState === "saving") return;
    setSaveState("saving");
    setMessage(undefined);
    try {
      const updated = await saveContactEvidence(contact.id, {
        linkedInUrl: linkedInUrl.trim() || null,
        identityStatus,
        organizationMatchStatus,
        evidenceNotes: evidenceNotes.trim() || null
      });
      setSaveState("saved");
      setMessage("Evidence saved to Airtable.");
      onEvidenceSaved(updated);
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Evidence could not be saved.");
    }
  }, [
    contact.id,
    evidenceNotes,
    identityStatus,
    linkedInUrl,
    onEvidenceSaved,
    organizationMatchStatus,
    saveState
  ]);

  return (
    <form
      className={styles.evidenceCard}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className={styles.sectionHeader}>
        <p>Evidence</p>
        <h3>Identity grounding</h3>
      </div>
      <label className={styles.evidenceField}>
        <span>LinkedIn URL</span>
        <div className={styles.linkInput}>
          <input
            value={linkedInUrl}
            onChange={(event) => setLinkedInUrl(event.target.value)}
            placeholder="https://www.linkedin.com/in/..."
          />
          {linkedInUrl ? (
            <a href={linkedInUrl} target="_blank" rel="noreferrer" aria-label="Open LinkedIn profile">
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </label>
      <div className={styles.evidenceGrid}>
        <Select
          label="Identity"
          value={identityStatus}
          options={verificationOptions}
          onChange={setIdentityStatus}
        />
        <Select
          label="Org Match"
          value={organizationMatchStatus}
          options={verificationOptions}
          onChange={setOrganizationMatchStatus}
        />
      </div>
      <label className={styles.evidenceField}>
        <span>Evidence Notes</span>
        <textarea
          value={evidenceNotes}
          onChange={(event) => setEvidenceNotes(event.target.value)}
          placeholder="Org website, source URLs, or why this match is real"
          rows={3}
        />
      </label>
      <button className={styles.saveEvidenceButton} type="submit" disabled={saveState === "saving"}>
        <Save size={14} aria-hidden="true" />
        {saveState === "saving" ? "Saving" : "Save Evidence"}
      </button>
      {message ? <p className={styles.evidenceStatus} data-state={saveState}>{message}</p> : null}
    </form>
  );
}

function OutreachEditor({
  contact,
  onSaved
}: {
  contact: Contact;
  onSaved: (contact: Contact) => void;
}) {
  const [outreachStatus, setOutreachStatus] = useState(contact.outreachStatus ?? "");
  const [notes, setNotes] = useState(contact.notes ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    setOutreachStatus(contact.outreachStatus ?? "");
    setNotes(contact.notes ?? "");
    setSaveState("idle");
    setMessage(undefined);
  }, [contact]);

  const save = useCallback(async (markDmSent = false) => {
    if (saveState === "saving") return;
    setSaveState("saving");
    setMessage(undefined);
    try {
      const today = localDateString(new Date());
      const followUp = localDateString(addDays(new Date(), 6));
      const updated = await saveContactEvidence(contact.id, {
        outreachStatus: markDmSent ? "DM Sent" : outreachStatus || null,
        notes: notes || null,
        ...(markDmSent ? { lastContacted: today, nextFollowUp: followUp } : {})
      });
      onSaved(updated);
      setSaveState("saved");
      setMessage(markDmSent ? `DM tracked. Follow up ${formatDate(followUp)}.` : "Outreach saved.");
    } catch (saveError) {
      setSaveState("error");
      setMessage(saveError instanceof Error ? saveError.message : "Outreach could not be saved.");
    }
  }, [contact.id, notes, onSaved, outreachStatus, saveState]);

  return (
    <form className={styles.evidenceCard} onSubmit={(event) => {
      event.preventDefault();
      void save(false);
    }}>
      <div className={styles.evidenceGrid}>
        <label className={styles.filterField}>
          <span>Outreach</span>
          <select value={outreachStatus} onChange={(event) => setOutreachStatus(event.target.value)}>
            {["", "Shortlisted", "DM Sent", "Replied", "Discovery Scheduled", "Not Now", "Bad Fit"].map((status) => (
              <option key={status || "blank"} value={status}>{status || "Unset"}</option>
            ))}
          </select>
        </label>
        <div className={styles.detailSection}>
          <DetailRow label="Last Contacted" value={formatDate(contact.lastContacted)} />
          <DetailRow label="Next Follow Up" value={formatDate(contact.nextFollowUp)} />
        </div>
      </div>
      <label className={styles.evidenceField}>
        <span>Outreach Notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="DM context, personal vetoes, intro path, or discovery notes"
          rows={3}
        />
      </label>
      <div className={styles.intakeActions}>
        <button className={styles.secondaryButton} type="button" disabled={saveState === "saving"} onClick={() => void save(true)}>
          Mark DM Sent
        </button>
        <button className={styles.saveEvidenceButton} type="submit" disabled={saveState === "saving"}>
          <Save size={14} aria-hidden="true" />
          {saveState === "saving" ? "Saving" : "Save Outreach"}
        </button>
      </div>
      {message ? <p className={styles.evidenceStatus} data-state={saveState}>{message}</p> : null}
    </form>
  );
}

function RelationshipEditor({
  contact,
  onSaved
}: {
  contact: Contact;
  onSaved: (contact: Contact) => void;
}) {
  const practice = buildPracticeOutreachFit(contact);
  const [relationshipRisk, setRelationshipRisk] = useState<ContactRelationshipRisk>(
    contact.relationshipRisk ?? practice.relationshipRisk
  );
  const [outreachReadiness, setOutreachReadiness] = useState<ContactOutreachReadiness>(
    contact.outreachReadiness ?? practice.outreachReadiness
  );
  const [relationshipContext, setRelationshipContext] = useState(contact.relationshipContext ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    const nextPractice = buildPracticeOutreachFit(contact);
    setRelationshipRisk(contact.relationshipRisk ?? nextPractice.relationshipRisk);
    setOutreachReadiness(contact.outreachReadiness ?? nextPractice.outreachReadiness);
    setRelationshipContext(contact.relationshipContext ?? "");
    setSaveState("idle");
    setMessage(undefined);
  }, [contact]);

  const save = useCallback(async () => {
    if (saveState === "saving") return;
    setSaveState("saving");
    setMessage(undefined);
    try {
      const updated = await saveContactEvidence(contact.id, {
        relationshipRisk,
        outreachReadiness,
        relationshipContext: relationshipContext.trim() || null
      });
      onSaved(updated);
      setSaveState("saved");
      setMessage("Relationship risk saved.");
    } catch (saveError) {
      setSaveState("error");
      setMessage(saveError instanceof Error ? saveError.message : "Relationship risk could not be saved.");
    }
  }, [contact.id, outreachReadiness, relationshipContext, relationshipRisk, onSaved, saveState]);

  return (
    <form className={styles.evidenceCard} onSubmit={(event) => {
      event.preventDefault();
      void save();
    }}>
      <div className={styles.sectionHeader}>
        <p>Practice Safety</p>
        <h3>Relationship risk</h3>
      </div>
      <div className={styles.evidenceGrid}>
        <Select
          label="Risk"
          value={relationshipRisk}
          options={relationshipRiskOptions}
          onChange={setRelationshipRisk}
        />
        <Select
          label="Readiness"
          value={outreachReadiness}
          options={outreachReadinessOptions}
          onChange={setOutreachReadiness}
        />
      </div>
      {practice.reasons.length ? (
        <div className={styles.fitBlock}>
          <h4>Practice blockers</h4>
          <ul>
            {practice.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </div>
      ) : null}
      <label className={styles.evidenceField}>
        <span>Relationship Context</span>
        <textarea
          value={relationshipContext}
          onChange={(event) => setRelationshipContext(event.target.value)}
          placeholder="Dad knows him, met twice, high-school speaker, family sensitivity, representation concern"
          rows={3}
        />
      </label>
      <button className={styles.saveEvidenceButton} type="submit" disabled={saveState === "saving"}>
        <Save size={14} aria-hidden="true" />
        {saveState === "saving" ? "Saving" : "Save Risk"}
      </button>
      {message ? <p className={styles.evidenceStatus} data-state={saveState}>{message}</p> : null}
    </form>
  );
}

function ResearchEditor({
  contact,
  onSaved
}: {
  contact: Contact;
  onSaved: (contact: Contact) => void;
}) {
  const [researchStatus, setResearchStatus] = useState<ContactResearchStatus>(
    contact.researchStatus ?? "Not Started"
  );
  const [researchDossier, setResearchDossier] = useState(contact.researchDossier ?? "");
  const [researchSourceUrls, setResearchSourceUrls] = useState(contact.researchSourceUrls ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    setResearchStatus(contact.researchStatus ?? "Not Started");
    setResearchDossier(contact.researchDossier ?? "");
    setResearchSourceUrls(contact.researchSourceUrls ?? "");
    setSaveState("idle");
    setMessage(undefined);
  }, [contact]);

  const save = useCallback(async () => {
    if (saveState === "saving") return;
    setSaveState("saving");
    setMessage(undefined);
    try {
      const updated = await saveContactEvidence(contact.id, {
        researchStatus,
        researchDossier: researchDossier.trim() || null,
        researchSourceUrls: researchSourceUrls.trim() || null,
        lastResearchedAt: new Date().toISOString()
      });
      onSaved(updated);
      setSaveState("saved");
      setMessage("Research dossier saved.");
    } catch (saveError) {
      setSaveState("error");
      setMessage(saveError instanceof Error ? saveError.message : "Research dossier could not be saved.");
    }
  }, [contact.id, onSaved, researchDossier, researchSourceUrls, researchStatus, saveState]);

  return (
    <form className={styles.evidenceCard} onSubmit={(event) => {
      event.preventDefault();
      void save();
    }}>
      <div className={styles.sectionHeader}>
        <p>Research</p>
        <h3>Source-backed dossier</h3>
      </div>
      <Select
        label="Status"
        value={researchStatus}
        options={researchStatusOptions}
        onChange={setResearchStatus}
      />
      <label className={styles.evidenceField}>
        <span>Research Dossier</span>
        <textarea
          value={researchDossier}
          onChange={(event) => setResearchDossier(event.target.value)}
          placeholder="- Role/company fact [source]\n- Project-relevant problem angle [source]\n- Conversation hook [source]"
          rows={5}
        />
      </label>
      <label className={styles.evidenceField}>
        <span>Research Source URLs</span>
        <textarea
          value={researchSourceUrls}
          onChange={(event) => setResearchSourceUrls(event.target.value)}
          placeholder="https://..."
          rows={3}
        />
      </label>
      <DetailRow label="Last Researched" value={formatDateTime(contact.lastResearchedAt)} />
      <button className={styles.saveEvidenceButton} type="submit" disabled={saveState === "saving"}>
        <Save size={14} aria-hidden="true" />
        {saveState === "saving" ? "Saving" : "Save Research"}
      </button>
      {message ? <p className={styles.evidenceStatus} data-state={saveState}>{message}</p> : null}
    </form>
  );
}

function DetailRow({ label, value, href }: { label: string; value?: string; href?: string }) {
  return (
    <div className={styles.detailRow}>
      <span>{label}</span>
      {href && value ? (
        <a href={href} target="_blank" rel="noreferrer">{value}</a>
      ) : (
        <strong>{value ?? "—"}</strong>
      )}
    </div>
  );
}

function ScoreItem({ label, value }: { label: string; value: number }) {
  return (
    <span>
      {label}
      <strong>{formatScore(value)}</strong>
    </span>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return <span className={styles.pill}>{children}</span>;
}

function ContactSkeleton() {
  return (
    <div className={styles.skeleton} aria-label="Loading contacts">
      {Array.from({ length: 8 }, (_, index) => <span key={index} />)}
    </div>
  );
}

function matchesTab(contact: Contact, tab: ContactTab): boolean {
  const workflows = new Set([...contact.workflows, ...contact.autoWorkflowTags]);
  const sourcing = buildCodeLabProjectSourcingFit(contact);
  const practice = buildPracticeOutreachFit(contact);
  if (tab === "practice") return practice.eligible;
  if (tab === "sourcing") {
    return sourcing.suggestedAsk === "DM First" ||
      sourcing.suggestedAsk === "Ask for Intro" ||
      sourcing.suggestedAsk === "Advisor Later";
  }
  if (tab === "all") return true;
  if (tab === "school") return workflows.has("School") || contact.courseIds.length > 0;
  if (tab === "personal") {
    return workflows.has("Personal Networking") ||
      workflows.has("Friends/Family") ||
      contact.relationshipType === "Friend" ||
      contact.relationshipType === "Family";
  }
  if (tab === "birthdays") return workflows.has("Birthdays") || Boolean(contact.birthday);
  if (tab === "cleanup") return contact.reviewStatus === "Needs Review" || workflows.has("Needs Cleanup");
  return contact.priority !== "Skip" &&
    contact.prospectType !== "Skip" &&
    contact.studentStatus === "Not Student" &&
    (contact.priority === "High" || contact.priority === "Medium");
}

function sortContactsForTab(a: Contact, b: Contact, tab: ContactTab): number {
  if (tab === "practice") {
    return buildPracticeOutreachFit(b).score - buildPracticeOutreachFit(a).score ||
      buildCodeLabProjectSourcingFit(b).score - buildCodeLabProjectSourcingFit(a).score ||
      a.name.localeCompare(b.name);
  }
  if (tab === "sourcing") {
    return buildCodeLabProjectSourcingFit(b).score - buildCodeLabProjectSourcingFit(a).score ||
      contactScore(b) - contactScore(a) ||
      a.name.localeCompare(b.name);
  }
  return contactScore(b) - contactScore(a) || a.name.localeCompare(b.name);
}

function matchesSearch(contact: Contact, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return [
    contact.name,
    contact.company,
    contact.headline,
    contact.notes,
    contact.source,
    contact.searchTerm,
    contact.codeLabFitReason,
    contact.potentialProjectAngles,
    contact.generatedReachOutReason,
    contact.generatedProjectIdeas,
    contact.relationshipContext,
    contact.researchDossier,
    contact.researchSourceUrls,
  ].some((value) => value?.toLowerCase().includes(normalizedQuery));
}

function matchesScoreFilter(contact: Contact, scoreFilter: (typeof scoreOptions)[number], tab: ContactTab): boolean {
  if (scoreFilter === "All") return true;
  if (scoreFilter === "Unscored") {
    return contact.generatedClientFitVersion !== CONTACT_INTELLIGENCE_VERSION ||
      typeof contact.generatedCodeLabScore !== "number";
  }
  return scoreForTab(contact, tab) >= Number(scoreFilter.replace("+", ""));
}

function scoreForTab(contact: Contact, tab: ContactTab): number {
  if (tab === "practice") return buildPracticeOutreachFit(contact).score;
  return tab === "sourcing" ? buildCodeLabProjectSourcingFit(contact).score : contactScore(contact);
}

function contactScore(contact: Contact): number {
  return buildContactIntelligence(contact).score.overall;
}

function buildIntakePreviewRows(preview?: ContactIntakePreview) {
  return (preview?.contacts ?? [])
    .map((contact) => {
      const asContact = parsedContactAsContact(contact);
      return {
        contact,
        intelligence: buildContactIntelligence(asContact),
        sourcing: buildCodeLabProjectSourcingFit(asContact),
        status: contact.duplicateOfId
          ? "Existing"
          : contact.duplicateReason
            ? "Duplicate"
            : "New"
      };
    })
    .sort((a, b) =>
      b.sourcing.score - a.sourcing.score ||
      b.intelligence.score.overall - a.intelligence.score.overall ||
      a.contact.name.localeCompare(b.contact.name)
    );
}

function parsedContactAsContact(contact: ParsedContactInput): Contact {
  return {
    id: `preview-${contact.duplicateKey}`,
    name: contact.name,
    headline: contact.headline,
    company: contact.company,
    source: contact.source,
    searchTerm: contact.searchTerm,
    connectionDegree: contact.connectionDegree,
    priority: contact.priority,
    prospectType: contact.prospectType,
    studentStatus: contact.studentStatus,
    projectPotential: contact.projectPotential,
    functionTags: contact.functionTags,
    workflows: contact.workflows,
    autoWorkflowTags: [],
    identityStatus: "Unverified",
    organizationMatchStatus: "Unverified",
    courseIds: [],
    organizationIds: [],
    interactionIds: [],
    outreachOpportunityIds: [],
    importantDateIds: []
  };
}

function formatScore(value: number): string {
  return value.toFixed(1);
}

function contactCounts(contacts: Contact[]) {
  return {
    total: contacts.length,
    highSignal: contacts.filter((contact) => matchesTab(contact, "sourcing")).length,
    practice: contacts.filter((contact) => matchesTab(contact, "practice")).length,
    decisionMakers: contacts.filter((contact) => contact.prospectType === "Decision Maker").length,
    product: contacts.filter((contact) => contact.prospectType === "Product").length,
    technical: contacts.filter((contact) => contact.prospectType === "Technical Leader").length,
    cleanup: contacts.filter((contact) => matchesTab(contact, "cleanup")).length,
  };
}

function intakeOptions(mode: IntakeMode): {
  sourceOverride: string;
  targetWorkflows: ContactWorkflow[];
  createUnmatched: boolean;
  saveEligibleClientFit: boolean;
} {
  if (mode === "ipn") {
    return {
      sourceOverride: "IPN Directory Search",
      targetWorkflows: ["CodeLab Outreach", "Community"],
      createUnmatched: true,
      saveEligibleClientFit: true
    };
  }
  if (mode === "lead") {
    return {
      sourceOverride: "Lead Queue Research",
      targetWorkflows: ["CodeLab Outreach", "Community"],
      createUnmatched: true,
      saveEligibleClientFit: true
    };
  }
  return {
    sourceOverride: "LinkedIn connections paste",
    targetWorkflows: ["Personal Networking"],
    createUnmatched: true,
    saveEligibleClientFit: true
  };
}

function activeTabLabel(tab: ContactTab): string {
  return tabs.find((item) => item.id === tab)?.label ?? "Contacts";
}

function formatDate(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
