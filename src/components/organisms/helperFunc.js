

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


export const getRegardingOptions = (type) => {
  switch (type) {
    case "Call":
      return [
        "2nd Followup", 
        "3rd Followup", 
        "4th Followup", 
        "5th Followup", 
        "Cold call", 
        "Confirm appointment", 
        "Discuss legal points", 
        "Follow up", 
        "New Client", 
        "Nomination and Visa Lodgement", 
        "Payment Made?", 
        "Returning call", 
        "Schedule a meeting"
      ];
    case "Meeting":
      return [
        "Hourly Consult $220", 
        "Initial Consultation Fee $165.00", 
        "No appointments today (check with Mark)", 
        "No Appointments Tonight", 
        "No clients or appointments 4.00-5.00pm"
      ];
    case "To-Do":
      return [
        "Assemble catalogs", 
        "DEADLINE REMINDER", 
        "Deadline to lodge app", 
        "Deadline to provide additional docu", 
        "Deadline to respond", 
        "DEADLINE TODAY - Email received", 
        "Make travel arrangements", 
        "Send contract", 
        "Send follow-up letter", 
        "Send literature", 
        "Send proposal", 
        "Send quote", 
        "Send SMS reminder"
      ];
    case "Appointment":
      return [
        "Appointment", 
        "Call", 
        "Dentist Appointment", 
        "Doctor Appointment", 
        "Eye Doctor Appointment", 
        "Make Appointment", 
        "Meeting", 
        "Parent-Teacher Conference", 
        "Shopping", 
        "Time Off", 
        "Workout"
      ];
    default:
      return ["General"]; // Default category
  }
};
