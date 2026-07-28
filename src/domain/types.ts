export type AirtableRecordId = string;

export type AssignmentStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "graded"
  | "missing";

export type AssignmentCategory =
  | "reading"
  | "problem_set"
  | "paper"
  | "quiz"
  | "exam"
  | "project"
  | "discussion"
  | "other";

export type CourseStatus = "not_started" | "in_progress" | "completed";

export interface GradeCategory {
  id: AirtableRecordId;
  courseId: AirtableRecordId;
  name: string;
  weightPercent: number;
  calculationType?: "required" | "extra_credit";
  maxExtraCreditPercent?: number;
}

export interface GradePolicy {
  courseId: AirtableRecordId;
  categories: GradeCategory[];
  usesWeightedCategories: boolean;
}

export interface GeneralEducationRequirement {
  id: AirtableRecordId;
  category: string;
}

export interface Course {
  id: AirtableRecordId;
  name: string;
  status?: CourseStatus;
  quarterTaken?: string;
  grade?: string;
  majorRequirements?: string[];
  geRequirementUsedIds?: AirtableRecordId[];
  geRequirementsUsed?: GeneralEducationRequirement[];
  creditHours?: number;
  gradePolicy?: GradePolicy;
}

export interface Assignment {
  id: AirtableRecordId;
  title: string;
  courseId?: AirtableRecordId;
  dueAt?: string;
  status: AssignmentStatus;
  category: AssignmentCategory;
  categoryId?: AirtableRecordId;
  pointsEarned?: number;
  pointsPossible?: number;
  typeLabel?: string;
  weekLabel?: string;
  notes?: string;
  hiddenFromList?: boolean;
  createdAt?: string;
}

export interface AssignmentUpdate {
  title?: string;
  courseId?: AirtableRecordId | null;
  dueAt?: string | null;
  status?: "submitted" | "not_started";
  categoryId?: AirtableRecordId | null;
  pointsEarned?: number | null;
  pointsPossible?: number | null;
  weekLabel?: string | null;
  hiddenFromList?: boolean;
}

export interface GradeCategoryUpdate {
  courseId?: AirtableRecordId | null;
  name?: string;
  weightPercent?: number;
  calculationType?: "required" | "extra_credit";
  maxExtraCreditPercent?: number | null;
}

export interface InboxItem {
  id: AirtableRecordId;
  text: string;
  createdAt: string;
  processed: boolean;
}

export type HabitStatus = "active" | "archived";

export interface Habit {
  id: AirtableRecordId;
  name: string;
  targetDaysPerWeek: number;
  status: HabitStatus;
  createdAt: string;
  sortOrder?: number;
}

export interface HabitCheckIn {
  id: AirtableRecordId;
  habitId: AirtableRecordId;
  date: string;
  createdAt: string;
}

export interface HabitTotal {
  habitId: AirtableRecordId;
  completedSessions: number;
}

export interface HabitWeek {
  habits: Habit[];
  checkIns: HabitCheckIn[];
  totals: HabitTotal[];
  weekStart: string;
  weekEnd: string;
}

export interface HabitUpdate {
  name?: string;
  targetDaysPerWeek?: number;
  status?: HabitStatus;
  sortOrder?: number;
}

export type CompetencyStatus = "current" | "dormant" | "someday" | "archived";

export interface Competency {
  id: AirtableRecordId;
  name: string;
  category?: string;
  status: CompetencyStatus;
  vision?: string;
  description?: string;
  sortOrder?: number;
  createdAt: string;
}

export interface CompetencyFocus {
  id: AirtableRecordId;
  competencyId: AirtableRecordId;
  title: string;
  startedAt: string;
  endedAt?: string;
  notes?: string;
  endReason?: string;
  createdAt: string;
}

export interface CompetencyOverview {
  competency: Competency;
  currentFocus?: CompetencyFocus;
  historicalFocuses: CompetencyFocus[];
}

export interface CompetencyUpdate {
  name?: string;
  category?: string | null;
  status?: CompetencyStatus;
  vision?: string | null;
  description?: string | null;
  sortOrder?: number;
}

export interface CompetencyFocusUpdate {
  title?: string;
  startedAt?: string;
  endedAt?: string;
  notes?: string | null;
  endReason?: string | null;
}

export type ContactWorkflow =
  | "School"
  | "CodeLab Outreach"
  | "180DC Outreach"
  | "Personal Networking"
  | "Friends/Family"
  | "Birthdays"
  | "Community"
  | "Recruiting/Talent"
  | "Needs Cleanup";

export type ContactProspectType =
  | "Decision Maker"
  | "Technical Leader"
  | "Product"
  | "Operator"
  | "Student/Talent"
  | "Community/Connector"
  | "Low Signal"
  | "Skip";

export type ContactPriority = "High" | "Medium" | "Low" | "Skip" | "Needs Review";

export type ContactStudentStatus = "Student" | "Recent Grad" | "Not Student" | "Unknown";

export type ContactReviewStatus = "Auto Parsed" | "Needs Review" | "Reviewed" | "Do Not Contact";

export type ContactVerificationStatus = "Unverified" | "Needs Review" | "Verified" | "Rejected";

export type ContactRelationshipRisk =
  | "Cold Practice"
  | "Warm Light"
  | "Warm Sensitive"
  | "Big Ask Later"
  | "Avoid / Need Context";

export type ContactOutreachReadiness =
  | "Practice Candidate"
  | "Research First"
  | "Ready to DM"
  | "Ask Family Context"
  | "Hold";

export type ContactResearchStatus =
  | "Not Started"
  | "Queued"
  | "Researched"
  | "Needs More Sources";

export interface ContactEvidenceUpdate {
  linkedInUrl?: string | null;
  identityStatus?: ContactVerificationStatus;
  organizationMatchStatus?: ContactVerificationStatus;
  evidenceNotes?: string | null;
  notes?: string | null;
  outreachStatus?: string | null;
  lastContacted?: string | null;
  nextFollowUp?: string | null;
  relationshipRisk?: ContactRelationshipRisk | null;
  outreachReadiness?: ContactOutreachReadiness | null;
  relationshipContext?: string | null;
  researchStatus?: ContactResearchStatus | null;
  researchDossier?: string | null;
  researchSourceUrls?: string | null;
  lastResearchedAt?: string | null;
}

export interface Contact {
  id: AirtableRecordId;
  name: string;
  email?: string;
  role?: string;
  headline?: string;
  company?: string;
  notes?: string;
  linkedInUrl?: string;
  linkedInConnectedOn?: string;
  identityStatus?: ContactVerificationStatus;
  organizationMatchStatus?: ContactVerificationStatus;
  evidenceNotes?: string;
  lastReviewedAt?: string;
  source?: string;
  sourceEvent?: string;
  searchTerm?: string;
  contactSegment?: string;
  connectionDegree?: string;
  priority?: ContactPriority;
  prospectType?: ContactProspectType;
  seniority?: string;
  studentStatus?: ContactStudentStatus;
  projectPotential?: string;
  reviewStatus?: ContactReviewStatus;
  functionTags: string[];
  workflows: ContactWorkflow[];
  autoWorkflowTags: ContactWorkflow[];
  relationshipType?: string;
  personalPriority?: string;
  relationshipRisk?: ContactRelationshipRisk;
  outreachReadiness?: ContactOutreachReadiness;
  relationshipContext?: string;
  researchStatus?: ContactResearchStatus;
  researchDossier?: string;
  researchSourceUrls?: string;
  lastResearchedAt?: string;
  birthday?: string;
  lastContacted?: string;
  nextFollowUp?: string;
  courseIds: AirtableRecordId[];
  organizationIds: AirtableRecordId[];
  interactionIds: AirtableRecordId[];
  outreachOpportunityIds: AirtableRecordId[];
  importantDateIds: AirtableRecordId[];
  duplicateGroup?: string;
  duplicateKey?: string;
  codeLabFitReason?: string;
  potentialProjectAngles?: string;
  generatedReachOutReason?: string;
  generatedProjectIdeas?: string;
  generatedDiscoveryPrompts?: string;
  generatedCodeLabScore?: number;
  generatedTechRelevanceScore?: number;
  generatedAuthorityScore?: number;
  generatedProjectSourceScore?: number;
  generatedWarmPathScore?: number;
  generatedScoreReason?: string;
  generatedClientFitUpdatedAt?: string;
  generatedClientFitVersion?: string;
  outreachStatus?: string;
  createdAt?: string;
}
