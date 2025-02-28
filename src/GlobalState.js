let globalCurrentContact = null;

const setCurrentGlobalContact = (contact) => {
  if (!globalCurrentContact) {
    globalCurrentContact = Object.freeze(contact); // Freeze the object to make it immutable
  } else {
    console.warn("currentContact is already set and cannot be changed.");
  }
};

const getCurrentContact = () => globalCurrentContact;

export { setCurrentGlobalContact, getCurrentContact };
