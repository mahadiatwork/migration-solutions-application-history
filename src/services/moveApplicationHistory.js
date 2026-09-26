import { zohoApi } from "../zohoApi";

const SOURCE_MODULE = "Applications_History";
const TARGET_MODULE = "History1";
const SOURCE_CONTACT_LIST = "Contacts4";
const TARGET_CONTACT_LIST = "Contacts3";
const PAGE_SIZE = 200;
const ATTACHMENT_CHECK_DELAYS_MS = [0, 250, 750, 1500];

const recordId = (value) => value?.id ?? value?.Id ?? value?.ID ?? null;

const successItem = (response, action) => {
  const item = response?.data?.[0];
  if (item?.code !== "SUCCESS") {
    throw new Error(item?.message || `${action} failed in CRM.`);
  }
  return item;
};

const readRecord = async (api, entity, id) => {
  const response = await api.getRecord({ Entity: entity, RecordID: id });
  const record = response?.data?.[0];
  if (!record?.id || String(record.id) !== String(id)) {
    throw new Error(`Could not verify ${entity} record ${id}.`);
  }
  return record;
};

const readRelated = async (api, entity, id, relatedList) => {
  const records = [];
  for (let page = 1; page <= 100; page += 1) {
    const response = await api.getRelatedRecords({
      Entity: entity,
      RecordID: id,
      RelatedList: relatedList,
      page,
      per_page: PAGE_SIZE,
    });
    if (response?.statusText?.toLowerCase() === "nocontent") break;
    if (!Array.isArray(response?.data)) {
      throw new Error(`Could not read ${relatedList} for ${entity} record ${id}.`);
    }
    records.push(...response.data);
    if (page === 100 && (response.data.length === PAGE_SIZE || response?.info?.more_records)) {
      throw new Error(`Too many ${relatedList} records for ${entity} record ${id}; the move was stopped.`);
    }
    if (response.data.length < PAGE_SIZE && !response?.info?.more_records) break;
  }
  return records;
};

const sourceContactId = (link) => recordId(link.Contact) || recordId(link.Contact_Details);

const contactCounts = (links) => {
  const counts = new Map();
  links.forEach((link) => {
    if (!sourceContactId(link)) {
      throw new Error("CRM returned a Contact link without its Contact ID during source restoration.");
    }
    const id = String(sourceContactId(link));
    counts.set(id, (counts.get(id) || 0) + 1);
  });
  return counts;
};

const restoreSourceLinks = async (api, sourceId, originalLinks) => {
  const expected = contactCounts(originalLinks);
  const current = contactCounts(await readRelated(api, SOURCE_MODULE, sourceId, SOURCE_CONTACT_LIST));
  for (const [contactId, count] of expected) {
    for (let missing = count - (current.get(contactId) || 0); missing > 0; missing -= 1) {
      successItem(await api.insertRecord({
        Entity: "Application_Hstory",
        APIData: {
          Contact: { id: contactId },
          Application_Hstory: { id: sourceId },
        },
        Trigger: ["workflow"],
      }), `Restore source Contact ${contactId}`);
    }
  }
  const restored = contactCounts(await readRelated(api, SOURCE_MODULE, sourceId, SOURCE_CONTACT_LIST));
  if ([...expected].some(([contactId, count]) => restored.get(contactId) !== count)) {
    throw new Error("Could not verify all source Contact links after restoration.");
  }
};

const checkedAttachments = async (listAttachments, module, id) => {
  const response = await listAttachments({ module, recordId: id, strict: true });
  if (response?.error || !Array.isArray(response?.data)) {
    throw new Error(`Could not verify attachments for ${module} record ${id}.`);
  }
  return response.data;
};

const attachmentCounts = (attachments) => {
  const counts = new Map();
  attachments.forEach((attachment) => {
    const name = attachment?.File_Name || attachment?.file_name || attachment?.name;
    if (!name) throw new Error("CRM returned an attachment without a file name.");
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return counts;
};

const attachmentsMatch = (source, target) => {
  if (source.length !== target.length) return false;
  const sourceCounts = attachmentCounts(source);
  const targetCounts = attachmentCounts(target);
  return [...sourceCounts].every(([name, count]) => targetCounts.get(name) === count);
};

const sameValue = (expected, actual) =>
  String(expected ?? "") === String(actual ?? "");

const sameDate = (expected, actual) => {
  if (!expected && !actual) return true;
  const expectedTime = Date.parse(expected);
  const actualTime = Date.parse(actual);
  if (Number.isFinite(expectedTime) && Number.isFinite(actualTime)) {
    return expectedTime === actualTime;
  }
  return sameValue(expected, actual);
};

const buildHistoryPayload = (source, destination, destinationId, destinationName) => {
  const sourceStakeholder = recordId(source.Stakeholder);
  return {
    Name: source.Name || destinationName || "History",
    History_Details_Plain: source.History_Details ?? "",
    History_Result: source.History_Result ?? null,
    History_Type: source.History_Type ?? null,
    Regarding: source.Regarding ?? null,
    Duration: source.Duration_Min == null ? null : String(source.Duration_Min),
    Date: source.Date ?? null,
    Billing_Type: source.Billing_Type ?? "Billable",
    Stakeholder: destination === "stakeholder"
      ? { id: String(destinationId) }
      : sourceStakeholder ? { id: String(sourceStakeholder) } : null,
    ...(recordId(source.Owner) ? { Owner: { id: String(recordId(source.Owner)) } } : {}),
    // A return to main History must not retain a Matter or its cached fields.
    Matter: null,
    Matter_No: null,
    Current_Stage: null,
    Matter_Progress: null,
  };
};

const assertTarget = (target, payload, destination, destinationId) => {
  for (const field of ["Matter", "Matter_No", "Current_Stage", "Matter_Progress"]) {
    const value = target[field];
    if (value != null && value !== "" && !(Array.isArray(value) && value.length === 0)) {
      throw new Error(`The new History record still contains ${field}.`);
    }
  }
  if (destination === "stakeholder" && String(recordId(target.Stakeholder)) !== String(destinationId)) {
    throw new Error("The new History record is not linked to the selected Stakeholder.");
  }
  if (destination === "contact" && String(recordId(target.Stakeholder) ?? "") !==
    String(recordId(payload.Stakeholder) ?? "")) {
    throw new Error("The new History record has a different Stakeholder.");
  }
  if (payload.Owner && String(recordId(target.Owner)) !== String(recordId(payload.Owner))) {
    throw new Error("The new History record has a different owner.");
  }
  if (payload.History_Details_Plain !== (target.History_Details_Plain ?? "")) {
    throw new Error("The new History record is missing its details.");
  }
  for (const field of ["Name", "History_Type", "History_Result", "Regarding", "Duration"]) {
    if (!sameValue(payload[field], target[field])) {
      throw new Error(`The new History record has a different ${field}.`);
    }
  }
  if (!sameDate(payload.Date, target.Date)) {
    throw new Error("The new History record has a different Date.");
  }
  if (payload.Billing_Type !== (target.Billing_Type ?? null)) {
    throw new Error("The new History record has a different Billing Type.");
  }
};

export class HistoryMoveError extends Error {
  constructor(message, sourceId, targetId = null, sourceDeleted = false, rolledBack = false) {
    super(message);
    this.name = "HistoryMoveError";
    this.sourceId = sourceId;
    this.targetId = targetId;
    this.sourceDeleted = sourceDeleted;
    this.rolledBack = rolledBack;
  }
}

/** Create and verify main History before removing the Application History entry. */
export async function moveApplicationHistoryToMain({
  ZOHO,
  sourceId,
  destination,
  destinationId,
  destinationName,
  listAttachments = zohoApi.file.getAttachments,
}) {
  if (!sourceId || !destinationId || !["contact", "stakeholder"].includes(destination)) {
    throw new Error("Select a valid History destination.");
  }

  const api = ZOHO.CRM.API;
  let targetId = null;
  let sourceDeleted = false;
  let sourceDeletionAttempted = false;
  let sourceMutationStarted = false;
  let linkIdMissing = false;
  const newLinkIds = [];
  let sourceLinks = [];
  try {
    const source = await readRecord(api, SOURCE_MODULE, sourceId);
    sourceLinks = await readRelated(api, SOURCE_MODULE, sourceId, SOURCE_CONTACT_LIST);
    const malformedLink = sourceLinks.find((link) =>
      !recordId(link) || !sourceContactId(link)
    );
    if (malformedLink) {
      throw new Error("CRM returned an Application History Contact link without its record or Contact ID.");
    }
    const sourceAttachments = await checkedAttachments(listAttachments, SOURCE_MODULE, sourceId);
    const contactIds = new Set(
      sourceLinks.map(sourceContactId)
        .filter(Boolean).map(String)
    );
    if (destination === "contact") contactIds.add(String(destinationId));

    const payload = buildHistoryPayload(source, destination, destinationId, destinationName);
    const created = successItem(await api.insertRecord({
      Entity: TARGET_MODULE,
      APIData: payload,
      Trigger: ["workflow"],
    }), "Create main History");
    targetId = recordId(created.details);
    if (!targetId) throw new Error("CRM did not return the new History record ID.");

    assertTarget(await readRecord(api, TARGET_MODULE, targetId), payload, destination, destinationId);

    for (const contactId of contactIds) {
      const link = successItem(await api.insertRecord({
        Entity: "History_X_Contacts",
        APIData: {
          Contact_History_Info: { id: targetId },
          Contact_Details: { id: contactId },
        },
        Trigger: ["workflow"],
      }), `Link Contact ${contactId}`);
      const linkId = recordId(link.details);
      if (!linkId) {
        linkIdMissing = true;
        throw new Error(`CRM did not return the new Contact link ID for ${contactId}.`);
      }
      newLinkIds.push(linkId);
    }
    const targetLinks = await readRelated(api, TARGET_MODULE, targetId, TARGET_CONTACT_LIST);
    const verifiedIds = new Set(targetLinks.map((link) => recordId(link.Contact_Details)).filter(Boolean).map(String));
    if (targetLinks.length !== contactIds.size || verifiedIds.size !== contactIds.size ||
      [...contactIds].some((id) => !verifiedIds.has(id))) {
      throw new Error("The new History record has different Contact links than expected.");
    }

    if (sourceAttachments.length > 0) {
      await ZOHO.CRM.FUNCTIONS.execute("copy_attachment_form_contact_history_to_applicatio", {
        arguments: JSON.stringify({
          fromModule: SOURCE_MODULE,
          toModule: TARGET_MODULE,
          fromID: sourceId,
          ToID: targetId,
        }),
      });
      let attachmentsVerified = false;
      for (const delayMs of ATTACHMENT_CHECK_DELAYS_MS) {
        if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
        const targetAttachments = await checkedAttachments(listAttachments, TARGET_MODULE, targetId);
        if (attachmentsMatch(sourceAttachments, targetAttachments)) {
          attachmentsVerified = true;
          break;
        }
      }
      if (!attachmentsVerified) {
        throw new Error("Attachments were not fully copied to the new History record.");
      }
    }

    for (const link of sourceLinks) {
      sourceMutationStarted = true;
      successItem(await api.deleteRecord({ Entity: "Application_Hstory", RecordID: link.id }),
        `Delete source Contact link ${link.id}`);
    }
    sourceDeletionAttempted = true;
    successItem(await api.deleteRecord({ Entity: SOURCE_MODULE, RecordID: sourceId }), "Delete Application History");
    sourceDeleted = true;
    return { sourceId, targetId, destination };
  } catch (error) {
    let sourceIntegrityError = null;
    if ((sourceMutationStarted || sourceDeletionAttempted) && !sourceDeleted) {
      try {
        await readRecord(api, SOURCE_MODULE, sourceId);
      } catch (verificationError) {
        sourceIntegrityError = new Error("Could not confirm whether the source still exists.");
      }
      if (!sourceIntegrityError) {
        try {
          await restoreSourceLinks(api, sourceId, sourceLinks);
        } catch (restoreError) {
          sourceIntegrityError = restoreError;
        }
      }
    }

    let rolledBack = false;
    let rollbackError = null;
    if (targetId && !sourceDeleted && !sourceIntegrityError) {
      try {
        const rollbackLinkIds = new Set(newLinkIds.map(String));
        const targetLinks = await readRelated(api, TARGET_MODULE, targetId, TARGET_CONTACT_LIST);
        for (const link of targetLinks) {
          if (!recordId(link)) throw new Error("Could not identify a Contact link during rollback.");
          rollbackLinkIds.add(String(recordId(link)));
        }
        if (linkIdMissing && targetLinks.length === 0) {
          throw new Error("Could not confirm the new Contact link during rollback.");
        }
        for (const linkId of rollbackLinkIds) {
          successItem(await api.deleteRecord({ Entity: "History_X_Contacts", RecordID: linkId }),
            `Roll back Contact link ${linkId}`);
        }
        successItem(await api.deleteRecord({ Entity: TARGET_MODULE, RecordID: targetId }),
          "Roll back new History");
        rolledBack = true;
      } catch (failure) {
        rollbackError = failure;
      }
    }
    const ids = targetId
      ? ` Source ${sourceId}; new History ${targetId}.`
      : ` Source ${sourceId}.`;
    const rollbackStatus = rolledBack
      ? " The new History record was removed; the source remains."
      : rollbackError
        ? ` Rollback failed: ${rollbackError.message || "unknown error"}.`
        : sourceIntegrityError
          ? ` Source status or links could not be confirmed: ${sourceIntegrityError.message}. Keep the new History record until both IDs are checked in CRM.`
        : "";
    throw new HistoryMoveError(`${error.message || "Move failed."}${ids}${rollbackStatus}`,
      sourceId, targetId, sourceDeleted, rolledBack);
  }
}
