// Source Matters still expose several legacy API values. Application History
// uses the current labels shown in the CRM UI, so form state and saved snapshots
// must stay in this canonical value set.
export const MATTER_PICKLIST_VALUE_ALIASES = {
  "1. Intake & Engagement": "1. Enquiry",
  "2. Strategy & Eligibility": "2. Consultation/Strategy & Eligibility",
  "3. Document Collection": "5. Document Collection",
  "4. Preparation": "6. Preparation",
  "6. Post-Lodgement / Processing": "7. Lodgement & Processing",
  "7. Decision": "8. Decision",
  "Internal QA review": "Pre-submission review",
  "QA feedback received, updates in progress":
    "Review feedback received, updates in progress",
};

export const canonicalizeMatterPicklistValue = (value) => {
  if (value == null) return "";
  const normalized = String(value).trim();
  return MATTER_PICKLIST_VALUE_ALIASES[normalized] || normalized;
};
