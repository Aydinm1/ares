import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCodeLabProjectSourcingFit,
  buildContactIntelligence,
  buildPracticeOutreachFit
} from "../src/contacts/intelligence.js";
import type { Contact } from "../src/domain/types.js";

function contact(overrides: Partial<Contact>): Contact {
  return {
    id: "recContact000000",
    name: "Test Contact",
    functionTags: [],
    workflows: [],
    autoWorkflowTags: [],
    courseIds: [],
    organizationIds: [],
    interactionIds: [],
    outreachOpportunityIds: [],
    importantDateIds: [],
    ...overrides
  };
}

test("product leaders get product and onboarding project ideas", () => {
  const intelligence = buildContactIntelligence(contact({
    name: "Azaan Amlani-Kurji",
    company: "Mastercard",
    headline: "Product @ Mastercard",
    prospectType: "Product",
    priority: "High",
    studentStatus: "Not Student",
    identityStatus: "Needs Review",
    organizationMatchStatus: "Needs Review",
    functionTags: ["Product", "Finance"]
  }));

  assert.match(intelligence.reachOutReason, /product/i);
  assert.equal(intelligence.reasonSignals.some((signal) => signal.includes("Mastercard")), true);
  assert.equal(
    intelligence.projectIdeas.some((idea) => /onboarding|product/i.test(idea.title)),
    true
  );
  assert.equal(intelligence.discoveryPrompts[0]?.includes("product"), true);
  assert.ok(intelligence.score.overall >= 6.5);
});

test("technical AI contacts get automation and tooling project ideas", () => {
  const intelligence = buildContactIntelligence(contact({
    name: "Soha Allauddin",
    company: "Meta",
    headline: "AI Project Manager @ Meta",
    prospectType: "Technical Leader",
    priority: "High",
    studentStatus: "Not Student",
    identityStatus: "Needs Review",
    organizationMatchStatus: "Needs Review",
    functionTags: ["AI/ML", "Engineering", "Operations"]
  }));

  assert.equal(
    intelligence.projectIdeas.some((idea) => /AI-assisted/i.test(idea.title)),
    true
  );
  assert.equal(
    intelligence.projectIdeas.some((idea) => /developer|operations/i.test(idea.title)),
    true
  );
  assert.ok(intelligence.score.techRelevance >= 8);
});

test("healthcare operators get operations and reporting-style ideas", () => {
  const intelligence = buildContactIntelligence(contact({
    name: "Saba Rawjani",
    headline: "Sr. Product Manager @ Rightway | Columbia MBA/MPH",
    prospectType: "Operator",
    priority: "Medium",
    studentStatus: "Not Student",
    functionTags: ["Healthcare", "Operations"]
  }));

  assert.equal(
    intelligence.projectIdeas.some((idea) => /Healthcare operations/i.test(idea.title)),
    true
  );
  assert.equal(
    intelligence.projectIdeas.some((idea) => /handoff/i.test(idea.title)),
    true
  );
});

test("skip and low-signal contacts produce a deprioritized rationale", () => {
  const intelligence = buildContactIntelligence(contact({
    name: "Low Signal",
    prospectType: "Skip",
    priority: "Skip",
    reviewStatus: "Do Not Contact"
  }));

  assert.equal(intelligence.lowSignal, true);
  assert.deepEqual(intelligence.projectIdeas, []);
  assert.match(intelligence.reachOutReason, /low priority|do not prioritize/i);
  assert.ok(intelligence.score.overall <= 3.5);
});

test("explicit Airtable fit reason and project angles are preserved", () => {
  const intelligence = buildContactIntelligence(contact({
    codeLabFitReason: "Runs product operations for a fintech team with likely workflow automation needs.",
    potentialProjectAngles: "- CRM cleanup\n- Customer onboarding dashboard",
    priority: "High",
    prospectType: "Product",
    studentStatus: "Not Student",
    functionTags: ["Product"]
  }));

  assert.equal(
    intelligence.reachOutReason,
    "Runs product operations for a fintech team with likely workflow automation needs."
  );
  assert.deepEqual(intelligence.capturedProjectAngles, [
    "CRM cleanup",
    "Customer onboarding dashboard"
  ]);
  assert.ok(intelligence.projectIdeas.length > 0);
  assert.ok(intelligence.score.projectSource >= 6);
});

test("head of engineering tech leaders outrank chief of staff investors", () => {
  const farhanStyle = buildContactIntelligence(contact({
    name: "Farhan Thawar",
    company: "Shopify",
    headline: "Head of Engineering at Shopify",
    prospectType: "Technical Leader",
    priority: "High",
    studentStatus: "Not Student",
    identityStatus: "Verified",
    organizationMatchStatus: "Verified",
    linkedInUrl: "https://www.linkedin.com/in/farhan-thawar",
    functionTags: ["Engineering", "AI/ML"]
  }));
  const aahadStyle = buildContactIntelligence(contact({
    name: "Aahad Patel",
    headline: "Chief of Staff + Investor",
    company: "Venture Capital and Private Equity Principals",
    prospectType: "Decision Maker",
    priority: "High",
    studentStatus: "Not Student",
    identityStatus: "Needs Review",
    organizationMatchStatus: "Needs Review",
    functionTags: []
  }));

  assert.ok(farhanStyle.score.overall >= 9);
  assert.ok(aahadStyle.score.overall >= 6);
  assert.ok(aahadStyle.score.overall < 8);
  assert.ok(farhanStyle.score.overall - aahadStyle.score.overall >= 1.5);
  assert.ok(farhanStyle.score.techRelevance > aahadStyle.score.techRelevance);
});

test("unverified senior-looking records can clear 7 but remain below verified leaders", () => {
  const intelligence = buildContactIntelligence(contact({
    name: "Unverified Exec",
    company: "Major Tech Company",
    headline: "VP of Engineering",
    prospectType: "Technical Leader",
    priority: "High",
    studentStatus: "Not Student",
    functionTags: ["Engineering", "AI/ML"]
  }));

  assert.ok(intelligence.score.overall > 7);
  assert.ok(intelligence.score.overall < 8);
  assert.match(intelligence.score.reason, /Evidence cap applied/i);
  assert.match(intelligence.reachOutReason, /hypothesis/i);
});

test("credible building profiles score solidly but not like named tech leaders", () => {
  const intelligence = buildContactIntelligence(contact({
    name: "Abid Ladhani",
    headline: "Building something new | Prev. Coinbase, Wealthsimple",
    prospectType: "Decision Maker",
    priority: "High",
    studentStatus: "Not Student",
    identityStatus: "Needs Review",
    organizationMatchStatus: "Needs Review",
    functionTags: ["Product", "Finance"]
  }));

  assert.ok(intelligence.score.overall >= 6.5);
  assert.ok(intelligence.score.overall < 7);
});

test("students are capped below strong outreach scores", () => {
  const intelligence = buildContactIntelligence(contact({
    name: "Strong Student",
    headline: "Computer Engineering Student at Georgia Tech | AI Intern",
    prospectType: "Student/Talent",
    priority: "High",
    studentStatus: "Student",
    functionTags: ["Engineering", "AI/ML"]
  }));

  assert.ok(intelligence.score.overall <= 4.4);
});

test("intern profiles are treated as student talent even if prospect type is stale", () => {
  const intelligence = buildContactIntelligence(contact({
    name: "Akash Anand",
    headline: "MLE Intern @ PayPal | Data Science & Econ @ UC Davis",
    prospectType: "Technical Leader",
    priority: "High",
    studentStatus: "Not Student",
    functionTags: ["Engineering", "AI/ML", "Data"]
  }));

  assert.ok(intelligence.score.overall <= 4.4);
  assert.ok(intelligence.score.authority <= 5);
  assert.match(intelligence.score.reason, /Technical Leader/);
});

test("fresh graduate product ICs do not rank like senior product sources", () => {
  const intelligence = buildContactIntelligence(contact({
    name: "Curtis Chen",
    headline: "Inc. AI Product @ Salesforce | Prev @ Amazon; just graduated and about to start fresh at Salesforce",
    company: "Salesforce",
    prospectType: "Product",
    priority: "High",
    studentStatus: "Recent Grad",
    projectPotential: "Strong",
    identityStatus: "Unverified",
    organizationMatchStatus: "Unverified",
    functionTags: ["AI/ML", "Product"],
    workflows: ["Personal Networking", "CodeLab Outreach"]
  }));

  assert.ok(intelligence.score.overall <= 6.2);
  assert.ok(intelligence.score.projectSource <= 6);
  assert.ok(intelligence.score.authority <= 4);
});

test("close warm AI executive contacts rank high from access and domain signal", () => {
  const intelligence = buildContactIntelligence(contact({
    name: "JAYANT KUMAWAT",
    headline: "AI Solutions and Platform Lead at PepsiCo | Building Scalable AI Solutions | MIT Alumini | AI Business Fellow @ Perplexity | Technology Executive",
    company: "PepsiCo",
    notes: "Current AI Solutions and Platform Lead drives strategy, architecture, and delivery of enterprise-scale AI and ML platforms across global divisions. Manages $10M+ budgets, leads cross-functional global teams, scales AI adoption, oversees the full AI lifecycle, and architects cloud-native AI solutions on Azure, AWS, GCP, Kubernetes, Terraform, and MLOps.",
    prospectType: "Technical Leader",
    priority: "High",
    studentStatus: "Not Student",
    projectPotential: "Strong",
    relationshipType: "Friend",
    personalPriority: "High",
    identityStatus: "Verified",
    organizationMatchStatus: "Verified",
    functionTags: ["AI/ML", "Engineering", "Operations"]
  }));

  assert.ok(intelligence.score.overall >= 8.5);
  assert.ok(intelligence.score.authority >= 7);
  assert.ok(intelligence.score.warmPath >= 8);
  assert.equal(
    intelligence.projectIdeas.some((idea) => /AI-assisted/i.test(idea.title)),
    true
  );
});

test("CodeLab sourcing separates sponsors from famous-company scouts", () => {
  const sponsor = buildCodeLabProjectSourcingFit(contact({
    name: "Kaiz Alarakyia",
    headline: "Senior Product Manager @ Google DeepMind | Founder @ First90",
    company: "Google DeepMind",
    prospectType: "Product",
    studentStatus: "Not Student",
    functionTags: ["Product", "AI/ML"],
    workflows: ["CodeLab Outreach", "Community"]
  }));
  const scout = buildCodeLabProjectSourcingFit(contact({
    name: "Curtis Chen",
    headline: "Incoming AI Product @ Salesforce | Recent graduate | Prev @ Amazon",
    company: "Salesforce",
    studentStatus: "Recent Grad",
    functionTags: ["AI/ML", "Product"],
    workflows: ["Personal Networking"]
  }));

  assert.equal(sponsor.role, "Sponsor");
  assert.equal(sponsor.suggestedAsk, "DM First");
  assert.ok(sponsor.technicalLanes.includes("AI/Data Systems"));
  assert.equal(scout.role, "Scout");
  assert.equal(scout.suggestedAsk, "Ask for Intro");
  assert.ok(sponsor.score > scout.score);
});

test("CodeLab sourcing respects personal risk vetoes", () => {
  const intelligence = buildCodeLabProjectSourcingFit(contact({
    name: "Sensitive Contact",
    headline: "Founder and CTO at Robotics Studio",
    company: "Robotics Studio",
    prospectType: "Decision Maker",
    studentStatus: "Not Student",
    personalPriority: "Awkward",
    functionTags: ["Engineering"],
    workflows: ["CodeLab Outreach", "Community"]
  }));

  assert.equal(intelligence.personalRisk, "Awkward");
  assert.equal(intelligence.role, "Skip");
  assert.equal(intelligence.suggestedAsk, "Avoid");
});

test("CodeLab sourcing ranks senior technical sponsors above scouts and routers", () => {
  const farhan = buildCodeLabProjectSourcingFit(contact({
    name: "Farhan Thawar",
    headline: "VP and Head of Engineering at Shopify | Leads 3000 engineers",
    company: "Shopify",
    prospectType: "Technical Leader",
    studentStatus: "Not Student",
    functionTags: ["Engineering"],
    workflows: ["CodeLab Outreach", "Community"]
  }));
  const connexion = buildCodeLabProjectSourcingFit(contact({
    name: "Mohammad Adnan",
    headline: "Chief Technology Officer at Connexion Mobility | OnTRAC fleet telemetry and dealership mobility SaaS",
    company: "Connexion Mobility",
    prospectType: "Technical Leader",
    studentStatus: "Not Student",
    functionTags: ["Engineering", "Data", "Operations"],
    workflows: ["CodeLab Outreach", "Community"]
  }));
  const hemisphere = buildCodeLabProjectSourcingFit(contact({
    name: "Alim Kanji",
    headline: "Engineering Manager at Hemisphere GNSS, a CNH Industrial Company | navigation algorithms and embedded systems",
    company: "Hemisphere GNSS",
    prospectType: "Technical Leader",
    studentStatus: "Not Student",
    functionTags: ["Engineering"],
    workflows: ["CodeLab Outreach", "Community"]
  }));
  const curtis = buildCodeLabProjectSourcingFit(contact({
    name: "Curtis Chen",
    headline: "Incoming AI Product @ Salesforce | Recent graduate | Prev @ Amazon",
    company: "Salesforce",
    studentStatus: "Recent Grad",
    functionTags: ["AI/ML", "Product"],
    workflows: ["Personal Networking"]
  }));

  assert.equal(farhan.role, "Sponsor");
  assert.equal(connexion.role, "Sponsor");
  assert.equal(hemisphere.role, "Router");
  assert.equal(curtis.role, "Scout");
  assert.ok(farhan.score > curtis.score);
  assert.ok(connexion.score > curtis.score);
  assert.ok(hemisphere.technicalLanes.includes("Hardware/Systems"));
});

test("CodeLab sourcing treats prestige sales and creative pipeline leads as routers", () => {
  const nurez = buildCodeLabProjectSourcingFit(contact({
    name: "Nurez Abji",
    headline: "Microsoft Senior Sales Brand Manager at CDW | Azure Local and healthcare IT",
    company: "CDW",
    prospectType: "Operator",
    studentStatus: "Not Student",
    functionTags: ["Sales/Partnerships", "Product"],
    workflows: ["CodeLab Outreach", "Community"]
  }));
  const farhez = buildCodeLabProjectSourcingFit(contact({
    name: "Farhez Rayani",
    headline: "CG/VFX Supervisor and Lighting Director of Photography | Pixar, Unity, Nintendo Metroid Prime 4, real-time games pipeline",
    company: "Waterproof Studios",
    prospectType: "Technical Leader",
    studentStatus: "Not Student",
    functionTags: ["Engineering", "Product"],
    workflows: ["CodeLab Outreach", "Community"]
  }));

  assert.equal(nurez.role, "Router");
  assert.equal(nurez.suggestedAsk, "Ask for Intro");
  assert.equal(farhez.role, "Router");
  assert.equal(farhez.projectBar, "Strong Technical");
  assert.ok(farhez.technicalLanes.includes("Games/Interactive"));
});

test("practice outreach includes safe cold and warm-light technical contacts", () => {
  const cold = buildPracticeOutreachFit(contact({
    name: "Cold CTO",
    headline: "CTO at Fleet Telemetry SaaS | vehicle data, automation, cloud platform",
    prospectType: "Technical Leader",
    studentStatus: "Not Student",
    relationshipRisk: "Cold Practice",
    outreachReadiness: "Practice Candidate",
    functionTags: ["Engineering", "Data"]
  }));
  const warmLight = buildPracticeOutreachFit(contact({
    name: "Warm Product Operator",
    headline: "Product Operations Lead at Healthcare IT platform",
    prospectType: "Product",
    studentStatus: "Not Student",
    relationshipRisk: "Warm Light",
    outreachReadiness: "Practice Candidate",
    functionTags: ["Product", "Operations", "Healthcare"],
    workflows: ["Community"]
  }));

  assert.equal(cold.eligible, true);
  assert.equal(warmLight.eligible, true);
  assert.ok(cold.score >= 7);
  assert.ok(warmLight.score >= 7);
});

test("practice outreach excludes sensitive, family, and recent-grad contacts even when project fit is strong", () => {
  const sensitive = buildPracticeOutreachFit(contact({
    name: "Farhez Rayani",
    headline: "Lighting Director @ WaterProof Studios | Pixar, Disney, Nintendo pipeline",
    prospectType: "Technical Leader",
    studentStatus: "Not Student",
    relationshipRisk: "Warm Sensitive",
    outreachReadiness: "Ask Family Context",
    relationshipContext: "Dad knows him and I met him as a little kid.",
    functionTags: ["Engineering", "Product"],
    workflows: ["Community"]
  }));
  const family = buildPracticeOutreachFit(contact({
    name: "Jay",
    headline: "CTO and AI product leader",
    prospectType: "Technical Leader",
    studentStatus: "Not Student",
    relationshipRisk: "Big Ask Later",
    outreachReadiness: "Hold",
    relationshipType: "Family",
    functionTags: ["Engineering", "AI/ML"]
  }));
  const recentGrad = buildPracticeOutreachFit(contact({
    name: "Recent Grad",
    headline: "Incoming AI Product @ Salesforce | Prev @ Amazon",
    prospectType: "Product",
    studentStatus: "Recent Grad",
    relationshipRisk: "Cold Practice",
    outreachReadiness: "Practice Candidate",
    functionTags: ["AI/ML", "Product"]
  }));

  assert.equal(sensitive.eligible, false);
  assert.match(sensitive.reasons.join(" "), /Warm sensitive/);
  assert.equal(family.eligible, false);
  assert.match(family.reasons.join(" "), /later|Hold/i);
  assert.equal(recentGrad.eligible, false);
  assert.match(recentGrad.reasons.join(" "), /recent-grad/i);
});
