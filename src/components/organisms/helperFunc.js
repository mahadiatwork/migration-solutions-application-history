

export const getResultOptions = (type) => {
  switch (type) {
    case "Meeting":
      return ["Meeting Held", "Meeting Not Held"]; // Wrap in an array
    case "To-Do":
      return ["To-do Done", "To-do Not Done"];
    case "Appointment":
      return ["Appointment Completed", "Appointment Not Completed"];
    case "Boardroom":
      return ["Boardroom - Completed","Boardroom - Not Completed"];
    case "Call Billing":
      return ["Call Billing - Completed", "Call Billing - Not Completed"];
    case "Email Billing":
      return ["Email Billing - Completed", "Email Billing - Not Completed"];
    case "Initial Consultation":
      return ["Initial Consultation - Completed", "Initial Consultation - Not Completed"];
    case "Call":
      return ["Call Attempted","Call Completed", "Call Left Message", "Call Received"];
    case "Mail":
      return ["Mail - Completed", "Mail - Not Completed"];
    case "Meeting Billing":
      return ["Meeting Billing - Completed", "Meeting Billing - Not Completed"];
    case "Personal Activity":
      return ["Personal Activity - Completed", "Personal Activity - Not Completed", "Note", "Mail Received", "Mail Sent", "Email Received", "Courier Sent", "Email Sent", "Payment Received"];
    case "To Do Billing":
      return ["To Do Billing - Completed","To Do Billing - Not Completed"];
    case "Vacation":
      return ["Vacation - Completed", "Vacation - Not Completed", "Vacation Cancelled"];
    case "Room 1":
    case "Room 2":
    case "Room 3":
      return [`${type} - Completed`,`${type} - Not Completed`]; // Wrap in an array
    case "Other":
      return ["Attachment", "E-mail Attachment", "E-mail Auto Attached", "E-mail Sent"];
    default:
      return ["Note"]; // Wrap default return in an array
  }
};
