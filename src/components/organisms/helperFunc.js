export const getResultOptions = (type) => {
  switch (type) {
    case "Meeting":
      return ["Meeting Held"]; // Wrap in an array
    case "To-Do":
      return ["To-do Done"];
    case "Appointment":
      return ["Appointment Completed"];
    case "Boardroom":
      return ["Boardroom - Completed"];
    case "Call Billing":
      return ["Call Billing - Completed"];
    case "Email Billing":
      return ["Email Billing - Completed"];
    case "Initial Consultation":
      return ["Initial Consultation - Completed"];
    case "Call":
      return ["Call Attempted"];
    case "Mail":
      return ["Mail - Completed"];
    case "Meeting Billing":
      return ["Meeting Billing - Completed"];
    case "Personal Activity":
      return ["Personal Activity - Completed"];
    case "To Do Billing":
      return ["To Do Billing - Completed"];
    case "Vacation":
      return ["Vacation - Completed"];
    case "Room 1":
    case "Room 2":
    case "Room 3":
      return [`${type} - Completed`]; // Wrap in an array
    case "Other":
      return ["Attachment"];
    default:
      return ["Note"]; // Wrap default return in an array
  }
};
