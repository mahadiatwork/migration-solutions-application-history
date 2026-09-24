/**
 * Result and Regarding options.
 *
 * When a Widget_Picklist_Config config object is passed, those lists are used.
 * Hard-coded lists are the fallback if CRM cannot be read.
 */

export const getResultOptions = (type, config) => {
  if (config?.results) {
    const typeResults = config.results[type];
    if (typeResults && typeResults.length > 0) {
      return typeResults;
    }
    const defaultResults = config.results["_default"];
    if (defaultResults && defaultResults.length > 0) {
      return defaultResults;
    }
  }

  switch (type) {
    case "Meeting":
      return ["Meeting Held", "Meeting Not Held"]; // Wrap in an array
    case "To-Do":
      return ["To-do Done", "To-do Not Done"];
    case "Appointment":
      return ["Appointment Completed", "Appointment Not Completed"];
    case "Boardroom":
      return ["Boardroom - Completed", "Boardroom - Not Completed"];
    case "Call Billing":
      return ["Call Billing - Completed", "Call Billing - Not Completed"];
    case "Email Billing":
      return ["Email Billing - Completed", "Email Billing - Not Completed"];
    case "Initial Consultation":
      return ["Initial Consultation - Completed", "Initial Consultation - Not Completed"];
    case "Call":
      return ["Call Attempted", "Call Completed", "Call Left Message", "Call Received"];
    case "Mail":
      return ["Mail - Completed", "Mail - Not Completed"];
    case "Meeting Billing":
      return ["Meeting Billing - Completed", "Meeting Billing - Not Completed"];
    case "Personal Activity":
      return [
        "Personal Activity - Completed",
        "Personal Activity - Not Completed",
        "Note",
        "Mail Received",
        "Mail Sent",
        "Email Received",
        "Courier Sent",
        "Email Sent",
        "Payment Received",
      ];
    case "To Do Billing":
      return ["To Do Billing - Completed", "To Do Billing - Not Completed"];
    case "Vacation":
      return ["Vacation - Completed", "Vacation - Not Completed", "Vacation Cancelled"];
    case "Room 1":
    case "Room 2":
    case "Room 3":
      return [`${type} - Completed`, `${type} - Not Completed`]; // Wrap in an array
    case "Other":
      return ["Attachment", "E-mail Attachment", "E-mail Auto Attached", "E-mail Sent"];
    default:
      return ["Note"]; // Wrap default return in an array
  }
};

/**
 * Resolve the Stakeholder lookup from the current Matter record.
 * Zoho can expose the same labelled field under different API names.
 */
export const resolveModuleStakeholder = (moduleData) => {
  const stakeholder = [
    moduleData?.Stakeholder_1,
    moduleData?.Stake_Holder,
    moduleData?.Stakeholder,
  ].find((candidate) => candidate?.id);

  if (!stakeholder) return null;

  return {
    id: stakeholder.id,
    name: stakeholder.name || stakeholder.Account_Name || "",
  };
};

export const getRegardingOptions = (type, existingValue, config) => {
  if (config?.regarding) {
    const typeRegarding = config.regarding[type];
    const defaultRegarding = config.regarding["_default"];
    const source =
      typeRegarding && typeRegarding.length > 0
        ? typeRegarding
        : defaultRegarding && defaultRegarding.length > 0
          ? defaultRegarding
          : null;

    if (source) {
      let options = [...source];
      const safeValue = typeof existingValue === "string" ? existingValue : "";
      if (safeValue.trim() !== "" && !options.includes(safeValue)) {
        options = [safeValue, ...options];
      }
      return options;
    }
  }

  const options = {
    Call: [
      "2nd Followup", "3rd Followup", "4th Followup", "5th Followup",
      "Cold call", "Confirm appointment", "Discuss legal points", "Follow up",
      "New Client", "Nomination and Visa Lodgement", "Payment Made?",
      "Returning call", "Schedule a meeting",
    ],
    Meeting: [
      "Hourly Consult $220", "Initial Consultation Fee $165.00",
      "No appointments today (check with Mark)", "No Appointments Tonight",
      "No clients or appointments 4.00-5.00pm",
    ],
    "To-Do": [
      "Assemble catalogs", "DEADLINE REMINDER", "Deadline to lodge app",
      "Deadline to provide additional docu", "Deadline to respond",
      "DEADLINE TODAY - Email received", "Make travel arrangements",
      "Send contract", "Send follow-up letter", "Send literature",
      "Send proposal", "Send quote", "Send SMS reminder",
    ],
    Appointment: [
      "Appointment", "Call", "Dentist Appointment", "Doctor Appointment",
      "Eye Doctor Appointment", "Make Appointment", "Meeting",
      "Parent-Teacher Conference", "Shopping", "Time Off", "Workout",
    ],
  };

  let predefinedOptions = options[type] || ["General"];

  const safeValue = typeof existingValue === "string" ? existingValue : "";
  if (safeValue.trim() !== "" && !predefinedOptions.includes(safeValue)) {
    predefinedOptions = [safeValue, ...predefinedOptions];
  }

  return predefinedOptions;
};
