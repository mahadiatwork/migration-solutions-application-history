import { zohoApi } from "../zohoApi";
import { serializeMatterProgress } from "./applicationHistorySnapshot";
import { canonicalizeMatterPicklistValue } from "./matterPicklistValues";

const SOURCE_MODULE = "Applications_History";
const TARGET_MODULE = "History1";
const SOURCE_CONTACT_LIST = "Contacts4";
const TARGET_CONTACT_LIST = "Contacts3";
const MATTERS_MODULE = "Applications";
const MATTER_CONTACT_LIST = "Applications";
const APPLICATION_HISTORY_CONTACT_MODULE = "Application_Hstory";
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

const targetContactId = (link) =>
  recordId(link.Contact_Details) || recordId(link.Contact);

const contactCounts = (links) => {
  const counts = new Map();
  links.forEach((link) => {
    if (!sourceContactId(link)) {
      throw new Error("CRM returned a Contact link without its Contact ID.");
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
    const reason = response?.error ? ` ${response.error}` : "";
    throw new Error(`Could not verify attachments for ${module} record ${id}.${reason}`);
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
  // Billing_Type is inactive on some History layouts, so Zoho can omit it from
  // readback even after accepting it in the create payload. Validate it whenever
  // the API exposes the field, while preserving the value for compatible layouts.
  if (
    Object.prototype.hasOwnProperty.call(target, "Billing_Type") &&
    payload.Billing_Type !== (target.Billing_Type ?? null)
  ) {
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
          Stakeholder: payload.Stakeholder,
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
    const verifiedIds = new Set(targetLinks.map(targetContactId).filter(Boolean).map(String));
    if (targetLinks.length !== contactIds.size || verifiedIds.size !== contactIds.size ||
      [...contactIds].some((id) => !verifiedIds.has(id))) {
      throw new Error("The new History record has different Contact links than expected.");
    }
    const expectedStakeholderId = recordId(payload.Stakeholder);
    for (const link of targetLinks) {
      const verifiedLink =
        expectedStakeholderId &&
        !Object.prototype.hasOwnProperty.call(link, "Stakeholder")
          ? await readRecord(api, "History_X_Contacts", recordId(link))
          : link;
      if (
        String(recordId(verifiedLink.Stakeholder) ?? "") !==
        String(expectedStakeholderId ?? "")
      ) {
        throw new Error("The new History Contact links have a different Stakeholder.");
      }
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

const normalizeMatterValue = (value) => {
  const first = Array.isArray(value) ? value[0] : value;
  if (first == null) return "";
  if (typeof first === "object") {
    return canonicalizeMatterPicklistValue(
      first.display_value ??
        first.actual_value ??
        first.value ??
        first.name ??
        ""
    );
  }
  return canonicalizeMatterPicklistValue(first);
};

const destinationStakeholder = (matter, contact) =>
  [
    matter?.Stakeholder_1,
    matter?.Stakeholder_Auto,
    matter?.Stake_Holder,
    matter?.Stakeholder,
    contact?.Account_Name,
  ].find((candidate) => recordId(candidate)) || null;

const preservedHistoryContent = (source) => {
  const payload = {};
  [
    "History_Details",
    "History_Result",
    "History_Type",
    "Regarding",
    "Duration_Min",
    "Date",
    "Billing_Type",
  ].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(source || {}, field)) {
      payload[field] = source[field] ?? null;
    }
  });
  if (recordId(source?.Owner)) {
    payload.Owner = { id: String(recordId(source.Owner)) };
  }
  return payload;
};

const updatedHistoryName = (source, matter) => {
  const existingName = String(source?.Name || "").trim();
  const oldMatterNo = String(
    source?.Matter_No || source?.Application?.name || ""
  ).trim();
  const newMatterNo = String(matter?.Name || "").trim();
  if (!newMatterNo) return existingName || "History";
  if (oldMatterNo && existingName.startsWith(`${oldMatterNo} - `)) {
    return `${newMatterNo}${existingName.slice(oldMatterNo.length)}`;
  }
  return existingName || newMatterNo;
};

export const buildMatterMovePayload = (source, matter, contact) => {
  if (!source?.id || !matter?.id) {
    throw new Error("The source History and destination Matter are required.");
  }
  const stakeholder = destinationStakeholder(matter, contact);
  return {
    id: String(source.id),
    ...preservedHistoryContent(source),
    Name: updatedHistoryName(source, matter),
    Application: { id: String(matter.id) },
    Matter_No: matter.Name ?? null,
    Current_Stage: normalizeMatterValue(matter.Current_Stage) || null,
    Matter_Progress: serializeMatterProgress(
      matter.Matter_Progress,
      "multiselectpicklist"
    ),
    Stakeholder: stakeholder ? { id: String(recordId(stakeholder)) } : null,
  };
};

const originalMatterPayload = (source) => ({
  id: String(source.id),
  ...preservedHistoryContent(source),
  Name: source.Name ?? null,
  Application: recordId(source.Application)
    ? { id: String(recordId(source.Application)) }
    : null,
  Matter_No: source.Matter_No ?? null,
  Current_Stage: source.Current_Stage ?? null,
  Matter_Progress: source.Matter_Progress ?? null,
  Stakeholder: recordId(source.Stakeholder)
    ? { id: String(recordId(source.Stakeholder)) }
    : null,
});

const sameMatterPayload = (record, payload) =>
  String(recordId(record.Application) ?? "") ===
    String(recordId(payload.Application) ?? "") &&
  sameValue(record.Name, payload.Name) &&
  sameValue(record.Matter_No, payload.Matter_No) &&
  normalizeMatterValue(record.Current_Stage) ===
    normalizeMatterValue(payload.Current_Stage) &&
  normalizeMatterValue(record.Matter_Progress) ===
    normalizeMatterValue(payload.Matter_Progress) &&
  String(recordId(record.Stakeholder) ?? "") ===
    String(recordId(payload.Stakeholder) ?? "") &&
  [
    "History_Details",
    "History_Result",
    "History_Type",
    "Regarding",
    "Duration_Min",
    "Billing_Type",
  ].every(
    (field) =>
      !Object.prototype.hasOwnProperty.call(payload, field) ||
      sameValue(record[field], payload[field])
  ) &&
  (!Object.prototype.hasOwnProperty.call(payload, "Date") ||
    sameDate(record.Date, payload.Date)) &&
  (!payload.Owner ||
    String(recordId(record.Owner) ?? "") === String(recordId(payload.Owner)));

const assertMatterDestination = (
  target,
  payload,
  destinationMatterId
) => {
  if (!sameMatterPayload(target, payload)) {
    throw new Error("The History did not retain the selected Matter details.");
  }
  if (String(recordId(target.Application)) !== String(destinationMatterId)) {
    throw new Error("The History is not linked to the selected Matter.");
  }
};

const verifyMatterDestinationWithRetry = async (
  api,
  sourceId,
  payload,
  destinationMatterId,
  delay
) => {
  let lastError;
  for (const delayMs of ATTACHMENT_CHECK_DELAYS_MS) {
    if (delayMs) await delay(delayMs);
    try {
      const target = await readRecord(api, SOURCE_MODULE, sourceId);
      assertMatterDestination(target, payload, destinationMatterId);
      return target;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

const contactLinkIds = (links) =>
  new Set(links.map((link) => targetContactId(link)).filter(Boolean).map(String));

const sameContactCounts = (left, right) =>
  left.size === right.size &&
  [...left].every(([contactId, count]) => right.get(contactId) === count);

const containsContactCounts = (actual, expected) =>
  [...expected].every(
    ([contactId, count]) => (actual.get(contactId) || 0) >= count
  );

const verifyApplicationHistoryContactLinksWithRetry = async (
  api,
  sourceId,
  expectedCounts,
  delay
) => {
  let lastError;
  for (const delayMs of ATTACHMENT_CHECK_DELAYS_MS) {
    if (delayMs) await delay(delayMs);
    try {
      const links = await readRelated(
        api,
        SOURCE_MODULE,
        sourceId,
        SOURCE_CONTACT_LIST
      );
      if (links.some((link) => !recordId(link) || !targetContactId(link))) {
        throw new Error("CRM returned an incomplete History Contact link.");
      }
      if (!sameContactCounts(contactCounts(links), expectedCounts)) {
        throw new Error("The History did not retain the expected Contact links.");
      }
      return links;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

const readLinksBeforeDestinationInsert = async (
  api,
  sourceId,
  destinationContactId,
  delay
) => {
  let links = [];
  for (const delayMs of ATTACHMENT_CHECK_DELAYS_MS) {
    if (delayMs) await delay(delayMs);
    links = await readRelated(
      api,
      SOURCE_MODULE,
      sourceId,
      SOURCE_CONTACT_LIST
    );
    if (links.some((link) => !recordId(link) || !targetContactId(link))) {
      throw new Error("CRM returned an incomplete History Contact link.");
    }
    if (contactLinkIds(links).has(String(destinationContactId))) return links;
  }
  return links;
};

const restoreApplicationHistoryContactLinks = async (
  api,
  sourceId,
  originalLinks
) => {
  const expectedCounts = contactCounts(originalLinks);
  const originalByRecordId = new Map(
    originalLinks.map((link) => [
      String(recordId(link)),
      String(targetContactId(link)),
    ])
  );
  const currentLinks = await readRelated(
    api,
    SOURCE_MODULE,
    sourceId,
    SOURCE_CONTACT_LIST
  );

  for (const link of currentLinks) {
    const linkId = recordId(link);
    const contactId = targetContactId(link);
    if (!linkId || !contactId) {
      throw new Error("CRM returned an incomplete History Contact link during rollback.");
    }
    if (
      originalByRecordId.has(String(linkId)) &&
      originalByRecordId.get(String(linkId)) !== String(contactId)
    ) {
      successItem(await api.deleteRecord({
        Entity: APPLICATION_HISTORY_CONTACT_MODULE,
        RecordID: String(linkId),
      }), `Remove changed Contact link ${linkId}`);
    }
  }

  const retainedCounts = contactCounts(await readRelated(
    api,
    SOURCE_MODULE,
    sourceId,
    SOURCE_CONTACT_LIST
  ));
  for (const [contactId, expectedCount] of expectedCounts) {
    for (
      let missing = expectedCount - (retainedCounts.get(contactId) || 0);
      missing > 0;
      missing -= 1
    ) {
      successItem(await api.insertRecord({
        Entity: APPLICATION_HISTORY_CONTACT_MODULE,
        APIData: {
          Application_Hstory: { id: String(sourceId) },
          Contact: { id: String(contactId) },
        },
        Trigger: ["workflow"],
      }), `Restore Contact ${contactId}`);
    }
  }

  const restored = await readRelated(
    api,
    SOURCE_MODULE,
    sourceId,
    SOURCE_CONTACT_LIST
  );
  if (restored.some((link) => !recordId(link) || !targetContactId(link))) {
    throw new Error("CRM returned an incomplete restored History Contact link.");
  }
  const restoredCounts = contactCounts(restored);
  if (!containsContactCounts(restoredCounts, expectedCounts)) {
    throw new Error("Could not restore the original History Contact links.");
  }
  if (!sameContactCounts(restoredCounts, expectedCounts)) {
    throw new Error(
      "Unexpected History Contact links remain; none were removed automatically."
    );
  }
};

const updateApplicationHistory = async (api, sourceId, payload, action) =>
  successItem(await api.updateRecord({
    Entity: SOURCE_MODULE,
    RecordID: sourceId,
    APIData: payload,
    Trigger: ["workflow"],
  }), action);

/** Load every Matter shown in the selected Contact's Applications related list. */
export async function fetchContactMatters({
  ZOHO,
  contactId,
  excludeMatterId = null,
}) {
  if (!ZOHO?.CRM?.API || !contactId) {
    throw new Error("Select a valid Contact before loading Matters.");
  }
  const matters = [];
  const seen = new Set();
  const fields = [
    "id",
    "Name",
    "Type_of_Application",
    "Current_Stage",
    "Matter_Progress",
    "Stakeholder_1",
    "Stakeholder_Auto",
    "Stake_Holder",
    "Contact_Name",
    "Modified_Time",
  ].join(",");

  for (let page = 1; page <= 100; page += 1) {
    const response = await ZOHO.CRM.API.getRelatedRecords({
      Entity: "Contacts",
      RecordID: contactId,
      RelatedList: MATTER_CONTACT_LIST,
      page,
      per_page: PAGE_SIZE,
      fields,
    });
    if (response?.statusText?.toLowerCase() === "nocontent") break;
    if (!Array.isArray(response?.data)) {
      throw new Error("CRM did not return the selected Contact's Matters.");
    }
    for (const matter of response.data) {
      const id = recordId(matter);
      if (!id || seen.has(String(id))) continue;
      seen.add(String(id));
      if (excludeMatterId && String(id) === String(excludeMatterId)) continue;
      matters.push(matter);
    }
    const moreRecords = response?.info?.more_records === true;
    if (
      response?.info?.more_records === false ||
      (!moreRecords && response.data.length < PAGE_SIZE)
    ) break;
    if (page === 100) {
      throw new Error("This Contact has too many Matters to display safely.");
    }
  }

  return matters.sort((left, right) =>
    String(left?.Name || "").localeCompare(String(right?.Name || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

/**
 * Reassign an Applications_History record to another Matter in place.
 * Keeping the record ID preserves its attachments while the update and any new
 * Contact link are verified and rolled back together on failure.
 */
export async function moveApplicationHistoryToMatter({
  ZOHO,
  sourceId,
  destinationMatterId,
  destinationContactId,
  delay = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  if (!ZOHO?.CRM?.API || !sourceId || !destinationMatterId || !destinationContactId) {
    throw new Error("Select a valid Contact and Matter destination.");
  }

  const api = ZOHO.CRM.API;
  const source = await readRecord(api, SOURCE_MODULE, sourceId);
  const sourceMatterId = recordId(source.Application);
  if (!sourceMatterId) {
    throw new Error("The source History is not linked to a Matter.");
  }
  if (String(sourceMatterId) === String(destinationMatterId)) {
    throw new Error("Select a different Matter from the current one.");
  }

  const matter = await readRecord(api, MATTERS_MODULE, destinationMatterId);
  if (String(recordId(matter.Contact_Name) ?? "") !== String(destinationContactId)) {
    throw new Error("The selected Matter is no longer associated with this Contact.");
  }
  const contact = await readRecord(api, "Contacts", destinationContactId);
  const payload = buildMatterMovePayload(source, matter, contact);
  const rollbackPayload = originalMatterPayload(source);
  const originalLinks = await readRelated(
    api,
    SOURCE_MODULE,
    sourceId,
    SOURCE_CONTACT_LIST
  );
  if (originalLinks.some((link) => !recordId(link) || !targetContactId(link))) {
    throw new Error("CRM returned an incomplete History Contact link.");
  }
  const expectedContactCounts = contactCounts(originalLinks);
  if (!expectedContactCounts.has(String(destinationContactId))) {
    expectedContactCounts.set(String(destinationContactId), 1);
  }

  let updateAttempted = false;
  let updateSucceeded = false;
  let linkInsertSucceeded = false;
  let createdLinkId = null;
  try {
    updateAttempted = true;
    await updateApplicationHistory(
      api,
      sourceId,
      payload,
      "Move History to Matter"
    );
    updateSucceeded = true;
    await verifyMatterDestinationWithRetry(
      api,
      sourceId,
      payload,
      destinationMatterId,
      delay
    );

    const linksAfterUpdate = await readLinksBeforeDestinationInsert(
      api,
      sourceId,
      destinationContactId,
      delay
    );
    if (!contactLinkIds(linksAfterUpdate).has(String(destinationContactId))) {
      const inserted = successItem(await api.insertRecord({
        Entity: APPLICATION_HISTORY_CONTACT_MODULE,
        APIData: {
          Application_Hstory: { id: String(sourceId) },
          Contact: { id: String(destinationContactId) },
        },
        Trigger: ["workflow"],
      }), `Link Contact ${destinationContactId}`);
      linkInsertSucceeded = true;
      createdLinkId = recordId(inserted.details);
    }

    await verifyApplicationHistoryContactLinksWithRetry(
      api,
      sourceId,
      expectedContactCounts,
      delay
    );
    await verifyMatterDestinationWithRetry(
      api,
      sourceId,
      payload,
      destinationMatterId,
      delay
    );

    return {
      sourceId: String(sourceId),
      targetId: String(sourceId),
      destination: "matter",
      matterId: String(destinationMatterId),
      contactId: String(destinationContactId),
    };
  } catch (error) {
    const rollbackErrors = [];
    const rollbackLinkIds = new Set(createdLinkId ? [String(createdLinkId)] : []);
    if (linkInsertSucceeded && !createdLinkId) {
      rollbackErrors.push(
        "CRM did not return the new Contact link ID, so no ambiguous link was removed automatically"
      );
    }
    for (const linkId of rollbackLinkIds) {
      try {
        successItem(await api.deleteRecord({
          Entity: APPLICATION_HISTORY_CONTACT_MODULE,
          RecordID: linkId,
        }), "Remove destination Contact link");
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError.message);
      }
    }
    if (updateAttempted) {
      try {
        const current = await readRecord(api, SOURCE_MODULE, sourceId);
        if (updateSucceeded || !sameMatterPayload(current, rollbackPayload)) {
          await updateApplicationHistory(
            api,
            sourceId,
            rollbackPayload,
            "Restore original Matter"
          );
          await verifyMatterDestinationWithRetry(
            api,
            sourceId,
            rollbackPayload,
            sourceMatterId,
            delay
          );
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError.message);
      }
      try {
        await restoreApplicationHistoryContactLinks(
          api,
          sourceId,
          originalLinks
        );
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError.message);
      }
    }
    const suffix = rollbackErrors.length
      ? ` Rollback needs attention: ${rollbackErrors.join("; ")}.`
      : " The History remains on its original Matter.";
    throw new Error(`${error.message || "Matter move failed."}${suffix}`);
  }
}
