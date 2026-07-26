import type { Contact } from "../domain/types.js";

export interface ContactProjectIdea {
  title: string;
  rationale: string;
}

export interface ContactScoreBreakdown {
  overall: number;
  techRelevance: number;
  authority: number;
  projectSource: number;
  warmPath: number;
  reason: string;
}

export interface ContactIntelligence {
  reachOutReason: string;
  score: ContactScoreBreakdown;
  reasonSignals: string[];
  capturedProjectAngles: string[];
  projectIdeas: ContactProjectIdea[];
  discoveryPrompts: string[];
  lowSignal: boolean;
}

export const CONTACT_INTELLIGENCE_VERSION = "client-fit-v5";

export type CodeLabSourcingRole = "Sponsor" | "Router" | "Scout" | "Advisor" | "Skip";
export type CodeLabProjectBar = "Strong Technical" | "Name-Brand Maybe" | "Generic" | "Reject";
export type CodeLabPersonalRisk = "Safe" | "Awkward" | "Family" | "Do Not Contact";
export type CodeLabSuggestedAsk = "DM First" | "Ask for Intro" | "Advisor Later" | "Review" | "Avoid";

export interface CodeLabProjectSourcingFit {
  score: number;
  role: CodeLabSourcingRole;
  projectBar: CodeLabProjectBar;
  personalRisk: CodeLabPersonalRisk;
  suggestedAsk: CodeLabSuggestedAsk;
  technicalLanes: string[];
  reasons: string[];
  message: string;
}

const DEFAULT_DISCOVERY_PROMPTS = [
  "Where does your team still rely on spreadsheets, manual handoffs, or repeated status updates?",
  "What reporting or onboarding workflow is painful but too small for your engineering team to prioritize?",
  "What would you prototype first if a student team could build a focused version in a few weeks?"
];

export function buildContactIntelligence(contact: Contact): ContactIntelligence {
  const signals = contactSignals(contact);
  const capturedProjectAngles = splitCapturedAngles(contact.potentialProjectAngles);
  const lowSignal =
    contact.priority === "Skip" ||
    contact.prospectType === "Skip" ||
    contact.prospectType === "Low Signal" ||
    contact.reviewStatus === "Do Not Contact";
  const projectIdeas = lowSignal ? [] : projectIdeasForContact(contact);
  const score = scoreContact(contact, lowSignal, capturedProjectAngles);
  return {
    reachOutReason: contact.codeLabFitReason || generatedReachOutReason(contact, signals, lowSignal),
    score,
    reasonSignals: signals,
    capturedProjectAngles,
    projectIdeas,
    discoveryPrompts: lowSignal ? lowSignalPrompts(contact) : discoveryPromptsForContact(contact),
    lowSignal
  };
}

export function buildCodeLabProjectSourcingFit(contact: Contact): CodeLabProjectSourcingFit {
  const profile = contactProfileHaystack(contact);
  const full = contactHaystack(contact);
  const studentOrJunior = isStudentOrJuniorForSourcing(contact, profile);
  const authority = sponsorAuthorityScore(profile, contact);
  const lanes = technicalLanesForContact(profile);
  const brand = brandScore(profile);
  const personalRisk = personalRiskForContact(contact, full);
  const role = sourcingRole(contact, profile, studentOrJunior, authority, lanes, brand, personalRisk);
  const projectBar = projectBarForContact(role, lanes, brand, profile);
  const warmPath = sourcingWarmPath(contact);
  const score = roundScore(Math.min(10, Math.max(1,
    authority * 0.40 +
    (lanes.length ? 8 : brand >= 6 ? 6.5 : 4) * 0.30 +
    brand * 0.15 +
    warmPath * 0.10 +
    (personalRisk === "Safe" ? 8 : personalRisk === "Awkward" ? 2 : 0) * 0.05
  )));
  const suggestedAsk = suggestedAskForSourcing(role, projectBar, personalRisk);
  const reasons = sourcingReasons(contact, { authority, lanes, brand, studentOrJunior, personalRisk, projectBar, role });
  return {
    score,
    role,
    projectBar,
    personalRisk,
    suggestedAsk,
    technicalLanes: lanes,
    reasons,
    message: sourcingMessage(contact, suggestedAsk, lanes)
  };
}

export function formatProjectIdeasForAirtable(intelligence: ContactIntelligence): string {
  return intelligence.projectIdeas
    .map((idea) => `${idea.title}: ${idea.rationale}`)
    .join("\n");
}

export function formatDiscoveryPromptsForAirtable(intelligence: ContactIntelligence): string {
  return intelligence.discoveryPrompts.join("\n");
}

function scoreContact(
  contact: Contact,
  lowSignal: boolean,
  capturedProjectAngles: string[]
): ContactScoreBreakdown {
  const haystack = contactHaystack(contact);
  const evidence = contactEvidence(contact);
  const studentOrInternProfile = isStudentOrInternProfile(contact, haystack);
  const earlyCareerProfile = isEarlyCareerProfile(contact, haystack, studentOrInternProfile);
  let techRelevance = 3.5;
  let authority = 4;
  let projectSource = 4;
  let warmPath = 4;

  if (contact.priority === "High") {
    projectSource += 0.9;
    warmPath += 0.4;
  }
  if (contact.priority === "Medium") projectSource += 0.5;
  if (contact.projectPotential === "Strong") projectSource += 1.5;
  if (contact.projectPotential === "Possible") projectSource += 0.7;
  if (contact.projectPotential === "Weak") projectSource -= 0.7;

  if (contact.prospectType === "Technical Leader") techRelevance += 2.8;
  if (contact.prospectType === "Product") {
    techRelevance += 2.4;
    projectSource += 0.9;
  }
  if (contact.prospectType === "Decision Maker") {
    authority += 1.5;
    projectSource += 0.5;
  }
  if (contact.prospectType === "Operator") projectSource += 1.2;
  if (contact.prospectType === "Community/Connector") warmPath += 1.5;

  const tags = new Set(contact.functionTags);
  if (tags.has("Engineering")) techRelevance += 2.2;
  if (tags.has("AI/ML")) techRelevance += 1.8;
  if (tags.has("Product")) techRelevance += 1.7;
  if (tags.has("Data")) techRelevance += 1.4;
  if (tags.has("Security")) techRelevance += 1.0;
  if (tags.has("Operations")) projectSource += 1.0;
  if (tags.has("Healthcare")) projectSource += 0.5;
  if (tags.has("Marketing/Growth")) projectSource += 0.5;

  if (/head of engineering|vp of engineering|vice president.*engineering|director of engineering|cto\b|chief technology officer/.test(haystack)) {
    techRelevance += 2.4;
    authority += 3.0;
    projectSource += 4.0;
  } else if (/engineering manager|software engineering manager|principal engineering manager|sr\.? manager.*engineering/.test(haystack)) {
    techRelevance += 1.8;
    authority += 1.3;
    projectSource += 1.0;
  } else if (/software engineer|data engineer|machine learning|ai engineer|cloud|platform/.test(haystack)) {
    techRelevance += 1.2;
  }

  if (/chief product officer|head of product|vp.*product|director.*product|group product manager|principal product manager/.test(haystack)) {
    techRelevance += 2.0;
    authority += 2.4;
    projectSource += 3.0;
  } else if (/product manager|product owner|product lead/.test(haystack)) {
    techRelevance += 1.4;
    projectSource += 1.1;
  }

  if (/head of|global head|chief|cxo|founder|ceo|co-founder|president|svp|vp\b|vice president|director|partner/.test(haystack)) {
    authority += 1.5;
  }
  if (/senior manager|technology executive|platform lead|solutions lead|ai solutions.*lead|platform engineering.*lead/.test(haystack)) {
    authority += 2.0;
    projectSource += 1.1;
  }
  if (/\$?\d+\s?m\+?\s+(budget|budgets)|global teams|global divisions|fortune 500|enterprise-scale|enterprise ready|executive leadership/.test(haystack)) {
    authority += 1.7;
    projectSource += 1.4;
  }
  if (/ai adoption|digital transformation|cloud-native|ml platforms|mlops|platform architecture|kubernetes|terraform/.test(haystack)) {
    techRelevance += 1.0;
    projectSource += 0.8;
  }
  if (/chief of staff/.test(haystack)) {
    authority += 1.4;
    warmPath += 1.1;
  }
  if (/investor|venture capital|private equity|vc\b/.test(haystack)) {
    warmPath += 1.8;
    authority += 0.5;
    projectSource += 0.8;
  }
  if (/shopify|google|meta|microsoft|amazon|aws|atlassian|salesforce|stripe|openai|deepmind|anthropic|physical intelligence|uber|coinbase|docusign|workday|capital one|jpmorgan|mastercard|palo alto networks|splunk|cisco|bloomberg|pixar|nintendo|instacart/.test(haystack)) {
    techRelevance += 0.8;
    authority += 0.4;
    projectSource += 0.5;
    warmPath += 0.8;
  }
  if (/startup|founder|0.?1|scale|growth|operator/.test(haystack)) {
    projectSource += 0.5;
    warmPath += 0.3;
  }
  if (/building something new|stealth|new venture|founding/.test(haystack)) {
    projectSource += 0.9;
    warmPath += 0.5;
  }
  if (/prev\.?\s+.*(coinbase|wealthsimple|stripe|shopify|openai|google|meta|microsoft|amazon|aws)/.test(haystack)) {
    techRelevance += 0.6;
    projectSource += 0.4;
    warmPath += 0.3;
  }
  if (/small business|real estate|restaurant|retail|hospitality|insurance agent|wealth advisor/.test(haystack)) {
    techRelevance -= 0.8;
  }

  if (capturedProjectAngles.length) projectSource += 1.0;
  if (contact.codeLabFitReason) projectSource += 0.8;
  if (contact.connectionDegree === "1st") warmPath += 2.0;
  if (contact.connectionDegree === "2nd") warmPath += 1.2;
  if (contact.connectionDegree === "3rd") warmPath += 0.5;
  if (/ipn|ismaili|jamat|linkedin/.test(haystack)) warmPath += 0.7;
  if (contact.personalPriority === "High") {
    warmPath += 2.0;
    projectSource += 0.6;
  }
  if (contact.relationshipType === "Friend" || contact.relationshipType === "Family") {
    warmPath += 2.5;
  } else if (contact.relationshipType === "Professional Contact" || contact.relationshipType === "Community Contact") {
    warmPath += 1.4;
  }

  if (studentOrInternProfile) {
    techRelevance -= 1.0;
    authority -= 2.5;
    projectSource -= 1.7;
  }
  if (contact.studentStatus === "Recent Grad") {
    authority -= 1.4;
    projectSource -= 0.7;
  }
  if (earlyCareerProfile) {
    authority = Math.min(authority - 1.1, 4.0);
    projectSource = Math.min(projectSource - 1.4, 6.0);
    warmPath -= 0.3;
  }
  if (lowSignal) {
    techRelevance = Math.min(techRelevance, 3.5);
    authority = Math.min(authority, 3.5);
    projectSource = Math.min(projectSource, 2.5);
    warmPath = Math.min(warmPath, 4.0);
  }

  techRelevance = clampScore(techRelevance);
  authority = clampScore(authority);
  projectSource = clampScore(projectSource);
  warmPath = clampScore(warmPath);
  let overall = roundScore(
    techRelevance * 0.35 +
    projectSource * 0.30 +
    authority * 0.25 +
    warmPath * 0.10
  );
  const evidenceCap = scoreEvidenceCap(contact, evidence);
  const uncappedOverall = overall;
  overall = Math.min(overall, evidenceCap);
  if (studentOrInternProfile) overall = Math.min(overall, 4.4);
  if (earlyCareerProfile) overall = Math.min(overall, 6.2);
  if (contact.studentStatus === "Recent Grad") overall = Math.min(overall, 6.2);
  if (lowSignal) overall = Math.min(overall, 3.5);

  return {
    overall: roundScore(overall),
    techRelevance,
    authority,
    projectSource,
    warmPath,
    reason: scoreReason(
      contact,
      { overall, techRelevance, authority, projectSource, warmPath },
      {
        ...evidence,
        capApplied: uncappedOverall > overall,
        capReason: evidenceCapReason(contact, evidence)
      }
    )
  };
}

function scoreReason(
  contact: Contact,
  score: Omit<ContactScoreBreakdown, "reason">,
  evidence: ContactEvidenceState
): string {
  const parts = [
    `Overall ${roundScore(score.overall)}/10`,
    `tech ${score.techRelevance}/10`,
    `project source ${score.projectSource}/10`,
    `authority ${score.authority}/10`,
    `warm path ${score.warmPath}/10`
  ];
  const context = [
    contact.headline,
    contact.company ? `company ${contact.company}` : undefined,
    contact.prospectType ? `type ${contact.prospectType}` : undefined,
    contact.seniority ? `seniority ${contact.seniority}` : undefined,
    contact.functionTags.length ? `functions ${contact.functionTags.join(", ")}` : undefined,
    contact.identityStatus ? `identity ${contact.identityStatus}` : undefined,
    contact.organizationMatchStatus ? `org match ${contact.organizationMatchStatus}` : undefined,
    contact.linkedInUrl ? "LinkedIn URL present" : undefined,
    contact.evidenceNotes ? "evidence notes present" : undefined
  ].filter(Boolean).join("; ");
  const cap = evidence.capApplied
    ? ` Evidence cap applied because ${evidence.capReason}.`
    : "";
  return `${parts.join(", ")}. Based on ${context || "available profile signals"}.${cap}`;
}

function generatedReachOutReason(contact: Contact, signals: string[], lowSignal: boolean): string {
  if (lowSignal) {
    return `${contact.name} is currently low priority for outreach because the record is marked ${
      contact.prospectType ?? contact.priority ?? contact.reviewStatus ?? "low signal"
    }. Keep them in the CRM, but do not prioritize a project-sourcing reach-out without new context.`;
  }

  const role = contact.prospectType ?? contact.seniority ?? "professional contact";
  const domain = primaryDomain(contact);
  const company = contact.company ? ` at ${contact.company}` : "";
  const evidence = contactEvidence(contact);
  const grounding = signals[0] ? ` The strongest signal is ${signals[0].toLowerCase()}.` : "";
  const caveat = evidence.verified
    ? " The identity and organization match are marked verified."
    : " Treat this as a hypothesis until the identity and organization match are verified.";
  return `${contact.name} looks worth reaching out to as a ${role.toLowerCase()}${company} with ${domain} relevance.${grounding}${caveat}`;
}

function contactSignals(contact: Contact): string[] {
  const signals: string[] = [];
  if (contact.linkedInUrl) signals.push(`LinkedIn: ${contact.linkedInUrl}`);
  if (contact.identityStatus) signals.push(`Identity status: ${contact.identityStatus}`);
  if (contact.organizationMatchStatus) signals.push(`Organization match: ${contact.organizationMatchStatus}`);
  if (contact.evidenceNotes) signals.push(`Evidence notes: ${contact.evidenceNotes}`);
  if (contact.headline) signals.push(`Headline: ${contact.headline}`);
  if (contact.company) signals.push(`Company: ${contact.company}`);
  if (contact.prospectType) signals.push(`Prospect type: ${contact.prospectType}`);
  if (contact.seniority) signals.push(`Seniority: ${contact.seniority}`);
  if (contact.functionTags.length) signals.push(`Function tags: ${contact.functionTags.join(", ")}`);
  if (contact.projectPotential) signals.push(`Project potential: ${contact.projectPotential}`);
  if (contact.priority) signals.push(`Priority: ${contact.priority}`);
  if (contact.source) signals.push(`Source: ${contact.source}`);
  return signals.slice(0, 7);
}

interface ContactEvidenceState {
  verified: boolean;
  hasAnyEvidence: boolean;
  capApplied: boolean;
  capReason: string;
}

function contactEvidence(contact: Contact): Omit<ContactEvidenceState, "capApplied" | "capReason"> {
  const verified =
    contact.identityStatus === "Verified" &&
    contact.organizationMatchStatus === "Verified";
  const hasAnyEvidence = Boolean(
    contact.linkedInUrl ||
    contact.evidenceNotes ||
    contact.identityStatus ||
    contact.organizationMatchStatus ||
    contact.reviewStatus === "Reviewed"
  );
  return { verified, hasAnyEvidence };
}

function isEarlyCareerProfile(
  contact: Contact,
  haystack: string,
  studentOrInternProfile: boolean
): boolean {
  if (studentOrInternProfile) return false;
  if (contact.studentStatus === "Recent Grad") return true;
  return /new grad|recent grad|just graduated|fresh grad|entry.?level|incoming|about to start|starting.*(at|@)|new.?grad/.test(haystack);
}

function scoreEvidenceCap(
  contact: Contact,
  evidence: Omit<ContactEvidenceState, "capApplied" | "capReason">
): number {
  if (evidence.verified) return 10;
  if (contact.identityStatus === "Rejected" || contact.organizationMatchStatus === "Rejected") return 4.5;
  if (contact.identityStatus === "Needs Review" || contact.organizationMatchStatus === "Needs Review") return 8.0;
  if (evidence.hasAnyEvidence) return 8.5;
  return 7.8;
}

function evidenceCapReason(
  contact: Contact,
  evidence: Omit<ContactEvidenceState, "capApplied" | "capReason">
): string {
  if (evidence.verified) return "";
  if (contact.identityStatus === "Rejected" || contact.organizationMatchStatus === "Rejected") {
    return "the identity or organization match is rejected";
  }
  if (contact.identityStatus === "Needs Review" || contact.organizationMatchStatus === "Needs Review") {
    return "the identity or organization match still needs review";
  }
  if (evidence.hasAnyEvidence) return "available evidence has not been fully verified";
  return "the record has no verified person or organization evidence";
}

function projectIdeasForContact(contact: Contact): ContactProjectIdea[] {
  const tags = new Set(contact.functionTags);
  const haystack = [
    contact.headline,
    contact.company,
    contact.notes,
    contact.searchTerm,
    contact.source,
    ...contact.functionTags
  ].join(" ").toLowerCase();
  const ideas: ContactProjectIdea[] = [];

  if (tags.has("Product") || contact.prospectType === "Product" || /product|customer|platform/.test(haystack)) {
    ideas.push({
      title: "Product workflow or customer onboarding prototype",
      rationale: "Product-facing contacts can usually identify onboarding friction, feature-discovery gaps, or internal product ops work that a student team can prototype."
    });
  }
  if (tags.has("AI/ML") || /ai|machine learning|genai|automation|agent/.test(haystack)) {
    ideas.push({
      title: "AI-assisted internal workflow automation",
      rationale: "AI signals suggest opportunities around intake triage, summarization, routing, knowledge retrieval, or agent-assisted repetitive workflows."
    });
  }
  if (tags.has("Data") || /data|analytics|reporting|dashboard|bi\b|metrics/.test(haystack)) {
    ideas.push({
      title: "Analytics dashboard or reporting cleanup",
      rationale: "Data-oriented contacts often have recurring reporting, metric definition, or data-quality problems that fit a scoped student build."
    });
  }
  if (tags.has("Engineering") || /engineering|developer|software|cloud|platform|systems/.test(haystack)) {
    ideas.push({
      title: "Internal developer or operations tool",
      rationale: "Engineering leaders can surface tooling gaps around queues, dashboards, runbooks, process automation, or integration glue."
    });
  }
  if (tags.has("Security") || /security|risk|compliance|identity|iam|governance/.test(haystack)) {
    ideas.push({
      title: "Security, compliance, or access review workflow",
      rationale: "Security and governance work often has structured checklists, exception tracking, and reporting flows suited to lightweight tools."
    });
  }
  if (tags.has("Healthcare") || /health|clinical|patient|medical|hospital|care/.test(haystack)) {
    ideas.push({
      title: "Healthcare operations or patient workflow tool",
      rationale: "Healthcare contacts may have scheduling, intake, patient communication, trial ops, or care coordination workflows that benefit from prototypes."
    });
  }
  if (tags.has("Education") || /education|school|student|learning|curriculum|teacher/.test(haystack)) {
    ideas.push({
      title: "Education support or student services tool",
      rationale: "Education contexts often need lightweight systems for advising, progress tracking, content organization, or student support workflows."
    });
  }
  if (tags.has("Operations") || contact.prospectType === "Operator" || /operations|supply chain|process|program|project/.test(haystack)) {
    ideas.push({
      title: "Process automation and handoff tracker",
      rationale: "Operators are strong sources for manual handoff, status tracking, and process visibility problems that can be scoped into useful student projects."
    });
  }
  if (tags.has("Marketing/Growth") || /growth|marketing|sales|partnership|gtm/.test(haystack)) {
    ideas.push({
      title: "Growth, partnerships, or CRM workflow",
      rationale: "Growth and partnership contacts often need lead tracking, segmentation, campaign reporting, or follow-up systems."
    });
  }

  if (!ideas.length) {
    ideas.push({
      title: "Workflow discovery and lightweight internal tool",
      rationale: "The record has enough professional signal to justify a discovery conversation around repetitive work, reporting, or coordination pain."
    });
  }

  return ideas.slice(0, 5);
}

function discoveryPromptsForContact(contact: Contact): string[] {
  const prompts = [...DEFAULT_DISCOVERY_PROMPTS];
  const tags = new Set(contact.functionTags);
  if (tags.has("Product")) {
    prompts.unshift("What part of your product or customer onboarding flow creates the most repeated manual work?");
  }
  if (tags.has("AI/ML") || tags.has("Data")) {
    prompts.unshift("Where do people need answers from scattered data, documents, or dashboards but cannot get them quickly today?");
  }
  if (tags.has("Operations")) {
    prompts.unshift("Which handoff between people, teams, or systems loses the most time or context?");
  }
  if (tags.has("Healthcare")) {
    prompts.unshift("Which patient, staff, or administrative workflow is high-friction but safe to prototype around?");
  }
  return prompts.slice(0, 4);
}

function lowSignalPrompts(contact: Contact): string[] {
  return [
    `Find one missing qualifier before outreach: current company, role, problem area, or warm intro for ${contact.name}.`,
    "If no stronger context appears, keep this record for networking but skip project-sourcing outreach."
  ];
}

function contactHaystack(contact: Contact): string {
  return [
    contact.name,
    contact.headline,
    contact.company,
    contact.notes,
    contact.searchTerm,
    contact.source,
    contact.seniority,
    contact.projectPotential,
    contact.prospectType,
    contact.relationshipType,
    contact.personalPriority,
    ...contact.functionTags
  ].join(" ").toLowerCase();
}

function contactProfileHaystack(contact: Contact): string {
  return [
    contact.name,
    contact.headline,
    contact.company,
    contact.seniority,
    contact.projectPotential,
    contact.prospectType,
    ...contact.functionTags,
    ...contact.workflows
  ].join(" ").toLowerCase();
}

function isStudentOrJuniorForSourcing(contact: Contact, profile: string): boolean {
  return contact.studentStatus === "Student" ||
    contact.studentStatus === "Recent Grad" ||
    /\b(intern|internship|new grad|recent grad|fresh grad|incoming|entry.?level|student at|undergraduate|freshman|sophomore|class of 202[7-9]|candidate|seeking|aspiring)\b/.test(profile);
}

function sponsorAuthorityScore(profile: string, contact: Contact): number {
  let score = 2;
  if (/\b(founder|co-founder|ceo|cto|cio|ciso|chief|owner|president)\b/.test(profile)) score = 9;
  else if (/\b(svp|vp|vice president|director|head of|partner|medical director|program director|associate director)\b/.test(profile)) score = 8;
  else if (/\b(staff|principal|architect|senior .*manager|sr\.? manager|engineering manager|product manager|program manager|project manager|technical project manager|supervisor|lead)\b/.test(profile)) score = 6.5;
  else if (/\b(manager|consultant|advisor|strategy|partnerships|chief of staff|business partner)\b/.test(profile)) score = 5.5;
  if (contact.prospectType === "Decision Maker") score += 0.8;
  if (contact.prospectType === "Technical Leader" || contact.prospectType === "Product" || contact.prospectType === "Operator") score += 0.4;
  return clampScore(score);
}

function technicalLanesForContact(profile: string): string[] {
  const lanes: string[] = [];
  if (/\b(game|gaming|interactive|studio|unity|unreal|roblox|blizzard|2k|overwatch|animation|graphics|render|vfx|cg|pixar|nintendo|metroid|lighting|cinematic|pipeline)\b/.test(profile)) {
    lanes.push("Games/Interactive");
  }
  if (/\b(infra|infrastructure|devops|sre|site reliability|platform|cloud|kubernetes|terraform|developer tools|mlops|azure local|hybrid infrastructure)\b/.test(profile)) {
    lanes.push("Infra/DevOps");
  }
  if (/\b(hardware|embedded|firmware|robotics|aerospace|systems|soc|semiconductor|validation|boeing|northrop|nasa|jpl|amd|nvidia|iot|edge|gnss|rf|navigation|satellite|telemetry|fleet|mobility|vehicle|automotive|agriculture|machine control)\b/.test(profile)) {
    lanes.push("Hardware/Systems");
  }
  if (/\b(network|networking|security|cyber|palo alto|splunk|cisco|observability|soc|threat|identity|iam|risk|compliance|fincrime|aml)\b/.test(profile)) {
    lanes.push("Networking/Security");
  }
  if (/\b(ai|machine learning|ml\b|llm|agent|deepmind|openai|anthropic|physical intelligence|databricks|data engineer|analytics|search quality|recommendations|genmedia|bloomberg)\b/.test(profile)) {
    lanes.push("AI/Data Systems");
  }
  if (/\b(product|ux research|uxr|designer|platforms|gcp|google cloud|gtm|strategic partnerships|program management|brand manager|sales brand|partner channel|cdw|microsoft)\b/.test(profile)) {
    lanes.push("Product/Platform");
  }
  return lanes.filter((lane, index) => lanes.indexOf(lane) === index);
}

function brandScore(profile: string): number {
  if (/\b(openai|anthropic|physical intelligence|google deepmind|deepmind|nvidia|databricks|vercel|shopify|pixar|nintendo|blizzard|2k|roblox|unity|stripe)\b/.test(profile)) return 9;
  if (/\b(google|youtube|microsoft|amazon|aws|meta|salesforce|mongodb|visa|boeing|northrop|nasa|jpl|amd|palo alto|splunk|cisco|bloomberg|github|snapchat)\b/.test(profile)) return 8;
  if (/\b(pepsico|cognizant|abbvie|genentech|vitalant|mitre|clearblade|komodo|oracle|ibm|deloitte|pwc|west monroe|at&t|connexion|hemisphere|cnh|cdw)\b/.test(profile)) return 6.5;
  return 4;
}

function personalRiskForContact(contact: Contact, full: string): CodeLabPersonalRisk {
  if (contact.reviewStatus === "Do Not Contact") return "Do Not Contact";
  if (contact.relationshipType === "Family" || contact.workflows.includes("Friends/Family")) return "Family";
  if (/\b(ex'?s mom|ex family|awkward|avoid|do not ask|do not contact)\b/.test(full) || contact.personalPriority === "Avoid" || contact.personalPriority === "Awkward") {
    return "Awkward";
  }
  return "Safe";
}

function sourcingRole(
  contact: Contact,
  profile: string,
  studentOrJunior: boolean,
  authority: number,
  lanes: string[],
  brand: number,
  risk: CodeLabPersonalRisk
): CodeLabSourcingRole {
  if (risk !== "Safe" || contact.prospectType === "Skip") return "Skip";
  if (studentOrJunior) return lanes.length || brand >= 8 ? "Scout" : "Skip";
  if (isCreativePipelineProfile(profile) && !hasCreativeSponsorOwnership(profile)) {
    if (authority >= 5.5 && (lanes.length || brand >= 8)) return "Router";
    if (lanes.length && authority >= 4) return "Advisor";
  }
  if (authority >= 7 && (lanes.length || brand >= 6.5)) return "Sponsor";
  if (authority >= 5.5 && (lanes.length || brand >= 8)) return "Router";
  if (/\b(software engineer|engineer|researcher|designer|ux|data|product)\b/.test(profile) && (lanes.length || brand >= 8)) return "Scout";
  if (lanes.length && authority >= 4) return "Advisor";
  return "Skip";
}

function isCreativePipelineProfile(profile: string): boolean {
  return /\b(cg|vfx|lighting|director of photography|render|animation|unity|unreal|game|cinematic|pixar|nintendo|metroid)\b/.test(profile);
}

function hasCreativeSponsorOwnership(profile: string): boolean {
  return /\b(founder|co-founder|owner|head of|vp|vice president|cto|chief|engineering manager|studio head|technical director)\b/.test(profile);
}

function projectBarForContact(
  role: CodeLabSourcingRole,
  lanes: string[],
  brand: number,
  profile: string
): CodeLabProjectBar {
  if (role === "Skip") return "Reject";
  if (lanes.some((lane) => lane !== "Product/Platform") && (role === "Sponsor" || role === "Router")) return "Strong Technical";
  if (brand >= 8 && role !== "Advisor") return "Name-Brand Maybe";
  if (/\b(dashboard|crm|marketing|sales|seo|real estate|retail|generic)\b/.test(profile) && !lanes.some((lane) => lane !== "Product/Platform")) return "Generic";
  return lanes.length ? "Name-Brand Maybe" : "Generic";
}

function sourcingWarmPath(contact: Contact): number {
  let score = 4;
  if (contact.workflows.includes("Community")) score += 1.3;
  if (contact.workflows.includes("Personal Networking")) score += 1.1;
  if (contact.relationshipType === "Friend") score += 1.8;
  if (contact.relationshipType === "Community Contact" || contact.relationshipType === "Professional Contact") score += 1.2;
  if (contact.personalPriority === "High") score += 1.2;
  if (contact.connectionDegree === "1st") score += 1;
  if (contact.connectionDegree === "2nd") score += 0.6;
  return clampScore(score);
}

function suggestedAskForSourcing(
  role: CodeLabSourcingRole,
  projectBar: CodeLabProjectBar,
  risk: CodeLabPersonalRisk
): CodeLabSuggestedAsk {
  if (risk !== "Safe" || role === "Skip" || projectBar === "Reject") return "Avoid";
  if (role === "Sponsor" && projectBar !== "Generic") return "DM First";
  if (role === "Router" || role === "Scout") return "Ask for Intro";
  if (role === "Advisor") return "Advisor Later";
  return "Review";
}

function sourcingReasons(
  contact: Contact,
  input: {
    authority: number;
    lanes: string[];
    brand: number;
    studentOrJunior: boolean;
    personalRisk: CodeLabPersonalRisk;
    projectBar: CodeLabProjectBar;
    role: CodeLabSourcingRole;
  }
): string[] {
  const reasons = [
    `${input.role} fit`,
    `project bar: ${input.projectBar}`,
    input.lanes.length ? `technical lane: ${input.lanes.join(", ")}` : undefined,
    input.authority >= 7 ? "senior enough to sponsor or route" : input.authority >= 5.5 ? "can likely route to an owner" : "limited ownership signal",
    input.brand >= 8 ? "strong brand signal" : undefined,
    input.studentOrJunior ? "junior/student signal limits sponsor fit" : undefined,
    input.personalRisk !== "Safe" ? `personal risk: ${input.personalRisk}` : undefined,
    contact.generatedCodeLabScore ? `general CodeLab score ${contact.generatedCodeLabScore}/10` : undefined
  ].filter((reason): reason is string => Boolean(reason));
  return reasons.slice(0, 6);
}

function sourcingMessage(contact: Contact, ask: CodeLabSuggestedAsk, lanes: string[]): string {
  const firstName = contact.name.split(/\s+/)[0] || contact.name;
  const lane = lanes[0] ?? "technical projects";
  const company = contact.company ?? "your team";
  if (ask === "Ask for Intro") {
    return `Hi ${firstName}, I’m Aydin, a UC Davis student helping run CodeLab. We’re trying to source stronger technical projects this year around ${lane}. Since you’re close to ${company}, could I ask who usually owns internal tooling/prototype ideas there? Mostly trying to find the right project sponsor.`;
  }
  if (ask === "Advisor Later") {
    return `Hi ${firstName}, I’m Aydin, a UC Davis student helping run CodeLab. We’re sourcing more serious student software projects this year around ${lane}. If a student team lands something in that area, would you be open to giving quick technical feedback or pointing us toward better problem owners?`;
  }
  return `Hi ${firstName}, I’m Aydin, a UC Davis student helping run CodeLab. We’re sourcing serious student software projects this year, ideally around ${lane}. Given your role at ${company}, I figured you might know where a small student team could build something genuinely useful. Would you be open to a quick 15-min chat, or point me to the right person?`;
}

function isStudentOrInternProfile(contact: Contact, haystack = contactHaystack(contact)): boolean {
  return contact.studentStatus === "Student" ||
    /\b(intern|internship|student|undergraduate|freshman|sophomore|junior|senior @|class of|university|college|uc davis|data science & econ)\b/.test(haystack);
}

function clampScore(value: number): number {
  return roundScore(Math.min(10, Math.max(1, value)));
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function primaryDomain(contact: Contact): string {
  if (contact.functionTags.length) return contact.functionTags.slice(0, 2).join("/");
  if (contact.searchTerm) return contact.searchTerm;
  if (contact.source) return contact.source;
  return "potential workflow";
}

function splitCapturedAngles(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/\n+|(?:^|\s)[-•]\s+/)
    .map((item) => item.trim().replace(/^[-•]\s*/, ""))
    .filter(Boolean)
    .slice(0, 6);
}
