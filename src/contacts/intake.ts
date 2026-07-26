import type {
  Contact,
  ContactPriority,
  ContactProspectType,
  ContactStudentStatus,
  ContactWorkflow
} from "../domain/types.js";

export interface ParsedContactInput {
  name: string;
  headline?: string;
  company?: string;
  linkedInConnectedOn?: string;
  source: string;
  searchTerm?: string;
  connectionDegree?: string;
  priority: ContactPriority;
  prospectType: ContactProspectType;
  studentStatus: ContactStudentStatus;
  projectPotential: "Strong" | "Possible" | "Weak" | "None";
  functionTags: string[];
  workflows: ContactWorkflow[];
  duplicateKey: string;
}

export interface ContactIntakePreview {
  contacts: Array<ParsedContactInput & {
    duplicateOfId?: string;
    duplicateReason?: string;
  }>;
  parsedCount: number;
  duplicateCount: number;
  skippedCount: number;
}

export interface ContactIntakeOptions {
  targetWorkflows?: ContactWorkflow[];
  sourceOverride?: string;
}

const JUNK_LINES = new Set([
  "message",
  "menu icon",
  "about",
  "accessibility",
  "ad choices",
  "advertising",
  "business services",
  "compose message",
  "first name",
  "for business",
  "get the linkedin app",
  "help center",
  "i'm looking for…",
  "jobs",
  "learning",
  "me",
  "messaging",
  "more",
  "my network",
  "notifications",
  "previous",
  "next",
  "search by name",
  "search with filters",
  "sort by:",
  "status is online",
  "instagram icon",
  "terms of service",
  "privacy policy",
  "privacy & terms",
  "quick nav",
  "home",
  "contact us",
  "events",
  "communities",
  "programs",
  "my hub",
  "mhns",
  "arrow",
  "current company",
  "region",
  "jamat khana"
]);

const INDUSTRY_HINTS = [
  "accounting",
  "airlines",
  "apparel",
  "banking",
  "biotechnology",
  "business consulting",
  "civil engineering",
  "computer software",
  "consumer goods",
  "data infrastructure",
  "education",
  "financial services",
  "health",
  "higher education",
  "hospital",
  "information technology",
  "insurance",
  "internet",
  "investment",
  "legal",
  "manufacturing",
  "marketing",
  "medical",
  "non-profit",
  "professional services",
  "real estate",
  "retail",
  "software development",
  "technology",
  "telecommunications",
  "transportation"
];

export function previewContactIntake(
  rawText: string,
  existingContacts: Contact[],
  options: ContactIntakeOptions = {}
): ContactIntakePreview {
  const existingByName = new Map<string, Contact[]>();
  for (const contact of existingContacts) {
    const key = normalizeName(contact.name);
    existingByName.set(key, [...(existingByName.get(key) ?? []), contact]);
  }

  const parsedContacts = parseContactBlocks(rawText, options);
  const seenKeys = new Map<string, ParsedContactInput>();
  const contacts = parsedContacts.map((contact) => {
    const existingMatch = findExistingDuplicate(contact, existingByName);
    const duplicateReason = existingMatch
      ? `Existing contact: ${existingMatch.name}${existingMatch.company ? ` at ${existingMatch.company}` : ""}`
      : seenKeys.has(contact.duplicateKey)
        ? `Duplicate in this paste: ${seenKeys.get(contact.duplicateKey)?.name}`
        : undefined;
    if (!duplicateReason) seenKeys.set(contact.duplicateKey, contact);
    return {
      ...contact,
      duplicateOfId: existingMatch?.id,
      duplicateReason
    };
  });

  return {
    contacts,
    parsedCount: contacts.length,
    duplicateCount: contacts.filter((contact) => contact.duplicateReason).length,
    skippedCount: 0
  };
}

export function parseContactBlocks(rawText: string, options: ContactIntakeOptions = {}): ParsedContactInput[] {
  const blocks = rawText
    .split(/\n\s*(?:menu icon|Message)\s*\n/gi)
    .flatMap((block) => block.split(/\n\s*Previous\s*(?:\n|$)/gi))
    .map(cleanBlockLines)
    .filter((lines) => lines.length >= 1);

  const contacts: ParsedContactInput[] = [];
  const seen = new Set<string>();
  for (const lines of blocks) {
    const parsed = parseBlock(lines, options);
    if (!parsed || seen.has(parsed.duplicateKey)) continue;
    seen.add(parsed.duplicateKey);
    contacts.push(parsed);
  }
  return contacts;
}

export function contactIntakeToAirtable(contact: ParsedContactInput): Record<string, unknown> {
  return {
    "Name": contact.name,
    "Headline": contact.headline,
    "Company": contact.company,
    "LinkedIn Connected On": contact.linkedInConnectedOn,
    "Source": contact.source,
    "Search Term": contact.searchTerm,
    "Connection Degree": contact.connectionDegree,
    "CodeLab Priority": contact.priority === "Skip" ? "Low" : contact.priority,
    "Prospect Type": contact.prospectType,
    "Student Status": contact.studentStatus,
    "Project Potential": contact.projectPotential,
    "Review Status": "Auto Parsed",
    "Function": contact.functionTags,
    "Workflows": contact.workflows,
    "Identity Status": "Unverified",
    "Organization Match Status": "Unverified",
    "Duplicate Key": contact.duplicateKey
  };
}

function parseBlock(lines: string[], options: ContactIntakeOptions): ParsedContactInput | undefined {
  const working = [...lines];
  if (working[0] && isInitials(working[0])) working.shift();
  const name = working.shift();
  if (!name || !looksLikeName(name)) return undefined;
  if (working[0] && normalizeLine(working[0]) === normalizeLine(name)) working.shift();

  const connectionIndex = working.findIndex((line) => /\b[123](?:st|nd|rd)\b/i.test(line));
  const connectionDegree = connectionIndex >= 0
    ? working.splice(connectionIndex, 1)[0]?.match(/\b[123](?:st|nd|rd)\b/i)?.[0]
    : undefined;

  const connectedOnIndex = working.findIndex((line) => /^connected on\b/i.test(line));
  const linkedInConnectedOn = connectedOnIndex >= 0
    ? parseLinkedInConnectedOn(working.splice(connectedOnIndex, 1)[0])
    : undefined;

  const headlineIndex = working.findIndex(looksLikeSignalLine);
  const headline = headlineIndex >= 0 ? working[headlineIndex] : undefined;
  const trailing = headlineIndex >= 0
    ? working.slice(headlineIndex + 1).filter((line) => !isIndustryLine(line))
    : [];
  const company = trailing.length
    ? trailing[trailing.length - 1]
    : headline
      ? extractCompanyFromHeadline(headline)
      : undefined;
  const classified = classifyContact({ name, headline, company }, options);
  return {
    name,
    headline,
    company,
    linkedInConnectedOn,
    connectionDegree,
    source: options.sourceOverride ?? (linkedInConnectedOn ? "LinkedIn connections paste" : "Manual contact intake"),
    searchTerm: inferSearchTerm(headline),
    duplicateKey: duplicateKey(name, company),
    ...classified
  };
}

function classifyContact(input: { name: string; headline?: string; company?: string }, options: ContactIntakeOptions): Pick<
  ParsedContactInput,
  "priority" | "prospectType" | "studentStatus" | "projectPotential" | "functionTags" | "workflows"
> {
  const haystack = `${input.name} ${input.headline ?? ""} ${input.company ?? ""}`.toLowerCase();
  const functionTags = inferFunctionTags(haystack);
  const studentStatus = inferStudentStatus(haystack);
  const prospectType = inferProspectType(haystack, studentStatus);
  const projectPotential = inferProjectPotential(haystack, prospectType, studentStatus);
  const priority = inferPriority(prospectType, studentStatus, projectPotential, haystack);
  return {
    priority,
    prospectType,
    studentStatus,
    projectPotential,
    functionTags,
    workflows: options.targetWorkflows?.length ? options.targetWorkflows : ["CodeLab Outreach"]
  };
}

function inferFunctionTags(haystack: string): string[] {
  const tags: string[] = [];
  if (/ai|machine learning|ml\b|genai|agent|automation|deepmind|anthropic|physical intelligence|robotics foundation/.test(haystack)) tags.push("AI/ML");
  if (/product|platform|ux|user experience|customer experience|designer|design/.test(haystack)) tags.push("Product");
  if (/engineering|engineer|software|developer|cto|cloud|infrastructure|devops|architect|gnss|embedded|telemetry|fleet|mobility|robotics|vfx|render|game/.test(haystack)) tags.push("Engineering");
  if (/data|analytics|bi\b|dashboard|governance|snowflake|databricks|observability|splunk|bloomberg/.test(haystack)) tags.push("Data");
  if (/security|cyber|risk|compliance|identity|iam|ciso/.test(haystack)) tags.push("Security");
  if (/health|clinical|medical|hospital|patient|biotech|pharma/.test(haystack)) tags.push("Healthcare");
  if (/school|education|student services|teacher|learning|edtech/.test(haystack)) tags.push("Education");
  if (/finance|bank|fintech|investment|capital|portfolio|cfo|accounting/.test(haystack)) tags.push("Finance");
  if (/operations|supply chain|logistics|program|project|pmo|process|coo/.test(haystack)) tags.push("Operations");
  if (/climate|energy|sustainability|renewable/.test(haystack)) tags.push("Climate");
  if (/legal|policy|counsel|attorney|government/.test(haystack)) tags.push("Legal/Policy");
  if (/marketing|growth|sales|partnership|gtm|revenue/.test(haystack)) tags.push("Marketing/Growth");
  if (/hr|talent|people|recruit/.test(haystack)) tags.push("HR/Talent");
  if (/community|volunteer|jamat|ismaili|aga khan/.test(haystack)) tags.push("Community");
  if (/research|phd|scientist/.test(haystack)) tags.push("Research");
  if (/account executive|business development|partnerships|sales/.test(haystack)) tags.push("Sales/Partnerships");
  return tags.filter((tag, index) => tags.indexOf(tag) === index);
}

function inferStudentStatus(haystack: string): ContactStudentStatus {
  if (/student|intern\b|internship|candidate|undergraduate|freshman|sophomore|junior|senior @|class of|university|college|school of engineering|mba candidate|phd candidate|uc davis|uiuc|ut austin|georgia tech/.test(haystack)) {
    return "Student";
  }
  if (/recent grad|graduate|alumnus|alumni/.test(haystack)) return "Recent Grad";
  return "Not Student";
}

function inferProspectType(haystack: string, studentStatus: ContactStudentStatus): ContactProspectType {
  if (studentStatus === "Student") return "Student/Talent";
  if (/head of engineering|vp of engineering|director of engineering|engineering manager|cto\b|chief technology officer|software engineering manager/.test(haystack)) {
    return "Technical Leader";
  }
  if (/chief product officer|head of product|vp.*product|director.*product|group product manager|principal product manager|product manager|product owner|product lead/.test(haystack)) {
    return "Product";
  }
  if (/chief|ceo|founder|co-founder|president|svp|vp\b|vice president|director|head of|partner|investor/.test(haystack)) {
    return "Decision Maker";
  }
  if (/operations|program manager|project manager|manager|consultant|business analyst|supply chain/.test(haystack)) {
    return "Operator";
  }
  if (/community|volunteer|coach|mentor|teacher/.test(haystack)) return "Community/Connector";
  return "Low Signal";
}

function inferProjectPotential(
  haystack: string,
  prospectType: ContactProspectType,
  studentStatus: ContactStudentStatus
): "Strong" | "Possible" | "Weak" | "None" {
  if (studentStatus === "Student") return "Weak";
  if (/head of engineering|vp of engineering|cto\b|head of product|vp.*product|ai product|data|automation|platform|operations|workflow|observability|security|gnss|telemetry|fleet|robotics|vfx|game|render|pipeline/.test(haystack)) {
    return "Strong";
  }
  if (["Technical Leader", "Product", "Decision Maker", "Operator"].includes(prospectType)) return "Possible";
  if (prospectType === "Community/Connector") return "Weak";
  return "None";
}

function inferPriority(
  prospectType: ContactProspectType,
  studentStatus: ContactStudentStatus,
  projectPotential: "Strong" | "Possible" | "Weak" | "None",
  haystack: string
): ContactPriority {
  if (studentStatus === "Student") return "Low";
  if (prospectType === "Low Signal" || prospectType === "Skip") return "Low";
  if (projectPotential === "Strong") return "High";
  if (/google|meta|microsoft|amazon|aws|stripe|shopify|salesforce|atlassian|capital one|jpmorgan|deepmind|anthropic|physical intelligence|uber|palo alto networks|splunk|cisco|docusign|bloomberg|pixar|nintendo|connexion|hemisphere/.test(haystack)) {
    return "High";
  }
  if (projectPotential === "Possible") return "Medium";
  return "Low";
}

function inferSearchTerm(headline?: string): string | undefined {
  const text = headline?.toLowerCase() ?? "";
  if (text.includes("chief")) return "chief";
  if (text.includes("cto")) return "cto";
  if (text.includes("cio")) return "cio";
  if (text.includes("coo")) return "coo";
  if (text.includes("vp") || text.includes("vice president")) return "vp";
  if (text.includes("head of")) return "head of";
  if (text.includes("product")) return "product";
  if (text.includes("engineering") || text.includes("engineer")) return "engineering";
  if (text.includes("manager")) return "manager";
  return undefined;
}

function cleanBlockLines(block: string): string[] {
  return block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !JUNK_LINES.has(normalizeLine(line)))
    .filter((line) => !/^\d+$/.test(line))
    .filter((line) => !/^\d+\s+notifications?$/i.test(line))
    .filter((line) => !/^\d+\s+connections?$/i.test(line))
    .filter((line) => !/^page \d+ of \d+$/i.test(line))
    .filter((line) => !/^linkedin corporation © \d{4}$/i.test(line))
    .filter((line) => !/^you are on the messaging overlay\./i.test(line))
    .filter((line) => !/^navigating to my network$/i.test(line))
    .filter((line) => !/^[·\s-]*[123](?:st|nd|rd)$/i.test(line))
    .filter((line) => !/\bprofile picture\b/i.test(line))
    .filter((line) => !/^© copyright/i.test(line));
}

function findExistingDuplicate(
  contact: ParsedContactInput,
  existingByName: Map<string, Contact[]>
): Contact | undefined {
  const matches = existingByName.get(normalizeName(contact.name)) ?? [];
  if (!matches.length) return undefined;
  const normalizedCompany = normalizeCompany(contact.company);
  return matches.find((match) => normalizeCompany(match.company) === normalizedCompany) ?? matches[0];
}

function duplicateKey(name: string, company?: string): string {
  return `${normalizeName(name)}::${normalizeCompany(company)}`;
}

function normalizeName(value: string): string {
  return normalizeLine(value)
    .replace(/,#open_to_work/gi, "")
    .replace(/#open_to_work/gi, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompany(value?: string): string {
  return normalizeLine(value ?? "")
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b\.?/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLine(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function isInitials(value: string): boolean {
  return /^[a-z]{1,3}$/i.test(value) || /^[a-z][.-]$/i.test(value);
}

function looksLikeName(value: string): boolean {
  const normalized = normalizeLine(value);
  if (JUNK_LINES.has(normalized) || isIndustryLine(value)) return false;
  return /\p{L}/u.test(value) && value.length <= 90;
}

function looksLikeSignalLine(value: string): boolean {
  return /\p{L}/u.test(value) && !isPlaceholderLine(value) && !/^connected on\b/i.test(value);
}

function isPlaceholderLine(value: string): boolean {
  const normalized = value.replace(/[\u200e\u200f\u200b-\u200d\ufeff]/g, "").trim();
  return !normalized || /^[-–—]+$/.test(normalized);
}

function parseLinkedInConnectedOn(value?: string): string | undefined {
  const match = value?.match(/^connected on\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/i);
  if (!match) return undefined;
  const monthIndex = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december"
  ].indexOf(match[1]?.toLowerCase() ?? "");
  if (monthIndex < 0) return undefined;
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, monthIndex, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== monthIndex || date.getUTCDate() !== day) {
    return undefined;
  }
  return date.toISOString().slice(0, 10);
}

function isIndustryLine(value: string): boolean {
  const normalized = normalizeLine(value);
  return INDUSTRY_HINTS.some((hint) => normalized.includes(hint)) && !/@| at | ex-|founder|manager|leader|student/i.test(value);
}

function extractCompanyFromHeadline(headline: string): string | undefined {
  const atMatch = headline.match(/(?:@| at )\s*([^|]+)/i);
  if (atMatch?.[1]) return atMatch[1].trim();
  const parts = headline.split("|").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : undefined;
}
