import test from "node:test";
import assert from "node:assert/strict";
import { parseContactBlocks, previewContactIntake } from "../src/contacts/intake.js";
import type { Contact } from "../src/domain/types.js";

function existingContact(overrides: Partial<Contact>): Contact {
  return {
    id: "recExisting00000",
    name: "Existing Contact",
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

test("parses IPN-style contact cards into classified contacts", () => {
  const contacts = parseContactBlocks(`
AV
Anum Valliani

3x AI & SaaS Product Leader | Founder @OptionV Energy

Climate Technology Product Manufacturing

Underscore VC

menu icon
FH
Farhana Hirji

Product Manager and Product Owner

IT Services and IT Consulting

Genesys

menu icon
`);

  assert.equal(contacts.length, 2);
  assert.equal(contacts[0]?.name, "Anum Valliani");
  assert.equal(contacts[0]?.company, "Underscore VC");
  assert.equal(contacts[0]?.prospectType, "Product");
  assert.equal(contacts[0]?.functionTags.includes("AI/ML"), true);
  assert.equal(contacts[1]?.company, "Genesys");
});

test("parses LinkedIn-style repeated-name cards and degree lines", () => {
  const contacts = parseContactBlocks(`
Ali Bawani
Ali Bawani
 2nd degree connection
· 2nd
Account Executive, Corporate | Sprout Social

Message
`);

  assert.equal(contacts.length, 1);
  assert.equal(contacts[0]?.name, "Ali Bawani");
  assert.equal(contacts[0]?.connectionDegree, "2nd");
  assert.equal(contacts[0]?.company, "Sprout Social");
});

test("skips LinkedIn profile-picture and connected-date artifacts", () => {
  const contacts = parseContactBlocks(`
Jack Carey’s profile picture
Jack Carey
Connected on June 9, 2025
Product Manager | Automation

Message
`);

  assert.equal(contacts.length, 1);
  assert.equal(contacts[0]?.name, "Jack Carey");
  assert.equal(contacts[0]?.headline, "Product Manager | Automation");
  assert.equal(contacts[0]?.company, "Automation");
  assert.equal(contacts[0]?.linkedInConnectedOn, "2025-06-09");
  assert.equal(contacts[0]?.source, "LinkedIn connections paste");
});

test("parses LinkedIn name-only cards with placeholder headlines", () => {
  const contacts = parseContactBlocks(`
Nicholas Olson’s profile picture
Nicholas Olson

--

Connected on July 20, 2026

Message

John Murphy’s profile picture
John Murphy

—

Connected on October 31, 2025

Message

Ken Nguyen’s profile picture
Ken Nguyen

‎

Connected on February 12, 2026

Message
`);

  assert.equal(contacts.length, 3);
  assert.equal(contacts[0]?.name, "Nicholas Olson");
  assert.equal(contacts[0]?.headline, undefined);
  assert.equal(contacts[0]?.linkedInConnectedOn, "2026-07-20");
  assert.equal(contacts[1]?.name, "John Murphy");
  assert.equal(contacts[1]?.linkedInConnectedOn, "2025-10-31");
  assert.equal(contacts[2]?.name, "Ken Nguyen");
  assert.equal(contacts[2]?.linkedInConnectedOn, "2026-02-12");
});

test("preview marks existing contacts and duplicate paste rows", () => {
  const preview = previewContactIntake(`
NN
noureen nanjee

Product Manager @ Google

Technology, Information and Internet

Google

menu icon
NN
Noureen Nanjee

Product Manager @ Google

Technology, Information and Internet

Google

menu icon
`, [
    existingContact({
      id: "recGoogle0000000",
      name: "Noureen Nanjee",
      company: "Google"
    })
  ]);

  assert.equal(preview.parsedCount, 1);
  assert.equal(preview.duplicateCount, 1);
  assert.equal(preview.contacts[0]?.duplicateOfId, "recGoogle0000000");
});

test("classifies intern school profiles as student talent", () => {
  const contacts = parseContactBlocks(`
Akash Anand’s profile picture
Akash Anand

MLE Intern @ PayPal | Data Science & Econ @ UC Davis

Connected on January 12, 2026

Message
`);

  assert.equal(contacts.length, 1);
  assert.equal(contacts[0]?.studentStatus, "Student");
  assert.equal(contacts[0]?.prospectType, "Student/Talent");
  assert.equal(contacts[0]?.priority, "Low");
});

test("can parse LinkedIn connections as personal networking contacts", () => {
  const contacts = parseContactBlocks(`
Aaron Zhuo’s profile picture
Aaron Zhuo

Product Analytics Manager @ Visa | Behavioral Science → AI | Berkeley Haas MBA | Co-founder @ yfint

Message
`, {
    targetWorkflows: ["Personal Networking"],
    sourceOverride: "LinkedIn connections paste"
  });

  assert.equal(contacts.length, 1);
  assert.equal(contacts[0]?.name, "Aaron Zhuo");
  assert.equal(contacts[0]?.source, "LinkedIn connections paste");
  assert.deepEqual(contacts[0]?.workflows, ["Personal Networking"]);
  assert.equal(contacts[0]?.company, "Visa");
  assert.equal(contacts[0]?.functionTags.includes("Product"), true);
  assert.equal(contacts[0]?.functionTags.includes("AI/ML"), true);
});

test("can parse lead queue snippets for CodeLab sourcing", () => {
  const contacts = parseContactBlocks(`
Nurez Abji
Microsoft Senior Sales Brand Manager at CDW | Azure Local and healthcare IT

CDW

menu icon
Farhez Rayani
CG/VFX Supervisor and Lighting Director of Photography | Pixar, Unity, Nintendo Metroid Prime 4, real-time games pipeline

Waterproof Studios
`, {
    targetWorkflows: ["CodeLab Outreach", "Community"],
    sourceOverride: "Lead Queue Research"
  });

  assert.equal(contacts.length, 2);
  assert.equal(contacts[0]?.source, "Lead Queue Research");
  assert.deepEqual(contacts[0]?.workflows, ["CodeLab Outreach", "Community"]);
  assert.equal(contacts[0]?.functionTags.includes("Sales/Partnerships"), true);
  assert.equal(contacts[1]?.functionTags.includes("Engineering"), true);
  assert.equal(contacts[1]?.priority, "High");
});

test("ignores LinkedIn connection page chrome around first and last contacts", () => {
  const contacts = parseContactBlocks(`
0 notifications

Home
My Network
Jobs
Messaging
6
Notifications

Me

For Business
Learning
683 connections
Sort by:
First name
Search with filters

Aahil Gangani
FP&A and Capital Markets @ NinjaHoldings | Boston University Alum
Message

Zubair Talib
Founder & Chief AI Officer · AI transformation and AI teams
Message
About
Accessibility
Help Center
Privacy & Terms
Ad Choices
Advertising
Business Services
Get the LinkedIn app
More
LinkedIn Corporation © 2026

Status is online
Messaging
You are on the messaging overlay. Press enter to open the list of conversations.
Compose message
Navigating to My Network
`, {
    targetWorkflows: ["Personal Networking"],
    sourceOverride: "LinkedIn connections paste"
  });

  assert.equal(contacts.length, 2);
  assert.equal(contacts[0]?.name, "Aahil Gangani");
  assert.equal(contacts[0]?.company, "NinjaHoldings");
  assert.equal(contacts[1]?.name, "Zubair Talib");
  assert.equal(contacts[1]?.headline, "Founder & Chief AI Officer · AI transformation and AI teams");
});
