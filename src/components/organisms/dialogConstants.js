/**
 * Matter history picklist defaults. CRM configuration can add or override
 * options while these required categories remain available at the top.
 */

export const DEFAULT_CATEGORY = "Communication & Meetings";
export const DEFAULT_ACTIVITY_TYPE = "Call";
export const DEFAULT_BILLING_TYPE = "Billable";

export const billingTypeOptions = ["Billable", "Non-Billable", "Write-Off"];

export const mandatoryActivityTypes = {
  "Communication & Meetings": ["Call", "Email", "Meeting", "Consultation"],
  "Assessment & Analysis": [
    "Assessment",
    "Research",
    "Strategy & Problem Solving",
    "Evidence & Risk Analysis",
  ],
  "Technical casework": [
    "Document Collection/Management",
    "Document Review",
    "Drafting/Preparation",
    "Review/Checking",
    "Amendments",
    "Lodgement/Submission",
    "RFI",
  ],
  Administration: [
    "Matter Administration",
    "CRM/File Management",
    "Allocation/Handover",
    "Billing/Payment",
    "Closure/Archiving",
  ],
  Other: [
    "Training",
    "Business Development",
    "Internal Project/Process Improvement",
    "Internal Meeting",
    "General Management",
    "Other",
  ],
};

export const mandatoryCategoryOptions = Object.keys(mandatoryActivityTypes);

// Required duration choices: 0, 5, 10, ... 240 minutes.
export const durationOptions = Array.from({ length: 49 }, (_, i) => i * 5);

const legacyTypeOptions = [
  "Meeting",
  "To-Do",
  "Appointment",
  "Boardroom",
  "Call Billing",
  "Email Billing",
  "Initial Consultation",
  "Call",
  "Mail",
  "Meeting Billing",
  "Personal Activity",
  "Room 1",
  "Room 2",
  "Room 3",
  "To Do Billing",
  "Vacation",
  "Other",
];

export const mergeOrderedUnique = (...optionLists) => {
  const seen = new Set();
  const merged = [];

  optionLists.flat().forEach((option) => {
    if (option == null) return;
    const value = String(option).trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    merged.push(value);
  });

  return merged;
};

export const mergeCategoryOptions = (configuredOptions = []) =>
  mergeOrderedUnique(
    mandatoryCategoryOptions,
    configuredOptions,
    legacyTypeOptions
  );

export const mergeDurationOptions = (configuredOptions = []) => {
  const required = [...durationOptions];
  const seen = new Set(required);
  const extras = [];

  configuredOptions.forEach((option) => {
    if (option == null || option === "") return;
    const value = Number(option);
    if (!Number.isFinite(value) || seen.has(value)) return;
    seen.add(value);
    extras.push(value);
  });

  return [...required, ...extras];
};

export const serializeDuration = (value) =>
  value === null || value === undefined || value === "" ? null : String(value);

export const typeOptions = mergeCategoryOptions();

export const resultMapping = {
  Meeting: "Meeting Held",
  "To-Do": "To-do Done",
  Appointment: "Appointment Completed",
  Boardroom: "Boardroom - Completed",
  "Call Billing": "Call Billing - Completed",
  "Email Billing": "Mail - Completed",
  "Initial Consultation": "Initial Consultation - Completed",
  Call: "Call Completed",
  Mail: "Mail Sent",
  "Meeting Billing": "Meeting Billing - Completed",
  "Personal Activity": "Personal Activity - Completed",
  "Room 1": "Room 1 - Completed",
  "Room 2": "Room 2 - Completed",
  "Room 3": "Room 3 - Completed",
  "To Do Billing": "To Do Billing - Completed",
  Vacation: "Vacation - Completed",
  Other: mandatoryActivityTypes.Other[0],
  ...Object.fromEntries(
    Object.entries(mandatoryActivityTypes).map(([category, activities]) => [
      category,
      activities[0],
    ])
  ),
};

export const activityTypeToCategory = Object.fromEntries(
  Object.entries(mandatoryActivityTypes).flatMap(([category, activities]) =>
    activities.map((activity) => [activity, category])
  )
);

export const typeMapping = {
  ...Object.fromEntries(
    Object.entries(resultMapping).map(([type, result]) => [result, type])
  ),
  ...activityTypeToCategory,
};
