import { moveApplicationHistoryToMain } from "./moveApplicationHistory";

jest.mock("../zohoApi", () => ({ zohoApi: { file: { getAttachments: jest.fn() } } }));

const success = (id) => ({ data: [{ code: "SUCCESS", details: { id } }] });

const makeCrm = ({
  contacts = ["contact-1"],
  attachments = [],
  failJunction = false,
  failDelete = false,
  failCopy = false,
  targetMatter = null,
  targetOverride = {},
  sourceLinksOverride = null,
  missingTargetLinkId = false,
  failSourceLinkRestore = false,
  failSourceJunctionDelete = false,
  ambiguousSourceDelete = false,
  sourceBillingType = "Non-Billable",
} = {}) => {
  const source = {
    id: "application-history-1",
    Name: "Original History",
    History_Details: "Original details",
    History_Result: "Meeting Held",
    History_Type: "Meeting",
    Regarding: "Consultation",
    Duration_Min: 30,
    Billing_Type: sourceBillingType,
    Date: "2026-09-01T10:00:00+10:00",
    Owner: { id: "owner-1" },
    Stakeholder: { id: "stakeholder-1" },
    Application: { id: "matter-1" },
  };
  const sourceLinks = sourceLinksOverride ||
    contacts.map((id, index) => ({ id: `source-link-${index}`, Contact: { id } }));
  const state = {
    payload: null,
    targetContacts: [],
    sourceLinks: [...sourceLinks],
    copied: false,
    deleted: false,
    rolledBack: false,
    parentDeletionAttempted: false,
  };
  const api = {
    getRecord: jest.fn(async ({ Entity, RecordID }) => {
      if (Entity === "Applications_History" && ambiguousSourceDelete && state.parentDeletionAttempted) {
        throw new Error("Source read unavailable");
      }
      return { data: [Entity === "Applications_History"
        ? source
        : Entity === "Application_Hstory"
          ? { id: RecordID }
          : { id: "main-history-1", ...state.payload, Matter: targetMatter, ...targetOverride }] };
    }),
    getRelatedRecords: jest.fn(async ({ Entity }) => ({
      data: Entity === "Applications_History"
        ? state.sourceLinks
        : state.targetContacts.map((id, index) => ({ id: `target-link-${index + 1}`, Contact_Details: { id } })),
    })),
    insertRecord: jest.fn(async ({ Entity, APIData }) => {
      if (Entity === "History1") {
        state.payload = APIData;
        return success("main-history-1");
      }
      if (Entity === "Application_Hstory") {
        if (failSourceLinkRestore) return { data: [{ code: "INVALID_DATA", message: "Restore denied" }] };
        state.sourceLinks.push({
          id: `restored-link-${state.sourceLinks.length + 1}`,
          Contact: { id: APIData.Contact.id },
        });
        return success(`restored-link-${state.sourceLinks.length}`);
      }
      if (failJunction) return { data: [{ code: "INVALID_DATA", message: "Junction rejected" }] };
      state.targetContacts.push(APIData.Contact_Details.id);
      return missingTargetLinkId
        ? { data: [{ code: "SUCCESS", details: {} }] }
        : success(`target-link-${state.targetContacts.length}`);
    }),
    deleteRecord: jest.fn(async ({ Entity, RecordID }) => {
      if (Entity === "Application_Hstory") {
        if (failSourceJunctionDelete) return { data: [{ code: "INVALID_DATA", message: "Link delete denied" }] };
        state.sourceLinks = state.sourceLinks.filter((link) => link.id !== RecordID);
      }
      if (Entity === "Applications_History") {
        state.parentDeletionAttempted = true;
        if (failDelete || ambiguousSourceDelete) return { data: [{ code: "INVALID_DATA", message: "Delete denied" }] };
        state.deleted = true;
      }
      if (Entity === "History1") state.rolledBack = true;
      return success("deleted");
    }),
  };
  const ZOHO = {
    CRM: {
      API: api,
      FUNCTIONS: {
        execute: jest.fn(async () => {
          if (failCopy) throw new Error("Copy function failed");
          state.copied = true;
          return { code: "SUCCESS" };
        }),
      },
    },
  };
  const listAttachments = jest.fn(async ({ module }) => ({
    data: module === "Applications_History" || state.copied ? attachments : [],
    error: null,
  }));
  return { ZOHO, api, state, listAttachments };
};

test("moves to Contact History with no Matter fields and all intended Contacts", async () => {
  const crm = makeCrm({ contacts: ["contact-1"], attachments: [{ File_Name: "letter.pdf" }] });
  const result = await moveApplicationHistoryToMain({
    ZOHO: crm.ZOHO,
    sourceId: "application-history-1",
    destination: "contact",
    destinationId: "contact-2",
    destinationName: "New Contact",
    listAttachments: crm.listAttachments,
  });

  expect(result.targetId).toBe("main-history-1");
  expect(crm.state.deleted).toBe(true);
  expect(crm.state.targetContacts).toEqual(["contact-1", "contact-2"]);
  expect(crm.state.payload).toMatchObject({
    Name: "Original History",
    History_Details_Plain: "Original details",
    Duration: "30",
    Owner: { id: "owner-1" },
    Stakeholder: { id: "stakeholder-1" },
    Matter: null,
    Matter_No: null,
    Current_Stage: null,
    Matter_Progress: null,
    Billing_Type: "Non-Billable",
  });
  expect(crm.ZOHO.CRM.FUNCTIONS.execute).toHaveBeenCalledTimes(1);
  expect(crm.listAttachments).toHaveBeenCalledWith({
    module: "Applications_History",
    recordId: "application-history-1",
    strict: true,
  });
  expect(crm.api.deleteRecord).toHaveBeenCalledWith({
    Entity: "Applications_History",
    RecordID: "application-history-1",
  });
});

test("moves directly to Stakeholder History without requiring a Contact", async () => {
  const crm = makeCrm({ contacts: [] });
  await moveApplicationHistoryToMain({
    ZOHO: crm.ZOHO,
    sourceId: "application-history-1",
    destination: "stakeholder",
    destinationId: "stakeholder-2",
    destinationName: "New Stakeholder",
    listAttachments: crm.listAttachments,
  });

  expect(crm.state.payload.Stakeholder).toEqual({ id: "stakeholder-2" });
  expect(crm.state.targetContacts).toEqual([]);
  expect(crm.state.deleted).toBe(true);
});

test("uses the widget's Billable default for a legacy record without Billing Type", async () => {
  const crm = makeCrm({ contacts: [], sourceBillingType: null });
  await moveApplicationHistoryToMain({
    ZOHO: crm.ZOHO,
    sourceId: "application-history-1",
    destination: "stakeholder",
    destinationId: "stakeholder-2",
    listAttachments: crm.listAttachments,
  });
  expect(crm.state.payload.Billing_Type).toBe("Billable");
});

test("retains participant links when moving to another Stakeholder", async () => {
  const crm = makeCrm({ contacts: ["contact-1", "contact-2"] });
  await moveApplicationHistoryToMain({
    ZOHO: crm.ZOHO,
    sourceId: "application-history-1",
    destination: "stakeholder",
    destinationId: "stakeholder-2",
    listAttachments: crm.listAttachments,
  });
  expect(crm.state.targetContacts).toEqual(["contact-1", "contact-2"]);
});

test("rolls back if CRM fills the old Matter on the new History record", async () => {
  const crm = makeCrm({ targetMatter: { id: "matter-1" } });
  await expect(moveApplicationHistoryToMain({
    ZOHO: crm.ZOHO,
    sourceId: "application-history-1",
    destination: "stakeholder",
    destinationId: "stakeholder-2",
    listAttachments: crm.listAttachments,
  })).rejects.toMatchObject({ rolledBack: true, sourceDeleted: false });
  expect(crm.state.deleted).toBe(false);
});

test.each([
  ["History_Type", "Call"],
  ["History_Result", "Wrong result"],
  ["Regarding", "Wrong regarding"],
  ["Duration", "90"],
  ["Date", "2026-09-02T10:00:00+10:00"],
  ["Stakeholder", { id: "wrong-stakeholder" }],
])("rolls back a Contact move when %s changes in the new record", async (field, value) => {
  const crm = makeCrm({ targetOverride: { [field]: value } });
  await expect(moveApplicationHistoryToMain({
    ZOHO: crm.ZOHO,
    sourceId: "application-history-1",
    destination: "contact",
    destinationId: "contact-2",
    listAttachments: crm.listAttachments,
  })).rejects.toMatchObject({ rolledBack: true, sourceDeleted: false });
  expect(crm.state.deleted).toBe(false);
});

test("accepts a normalized CRM date representing the same instant", async () => {
  const crm = makeCrm({ contacts: [], targetOverride: { Date: "2026-09-01T00:00:00Z" } });
  await moveApplicationHistoryToMain({
    ZOHO: crm.ZOHO,
    sourceId: "application-history-1",
    destination: "stakeholder",
    destinationId: "stakeholder-2",
    listAttachments: crm.listAttachments,
  });
  expect(crm.state.deleted).toBe(true);
});

test("rejects an unexpected Contact link on the new History record", async () => {
  const crm = makeCrm();
  crm.state.targetContacts.push("unexpected-contact");
  await expect(moveApplicationHistoryToMain({
    ZOHO: crm.ZOHO,
    sourceId: "application-history-1",
    destination: "contact",
    destinationId: "contact-2",
    listAttachments: crm.listAttachments,
  })).rejects.toMatchObject({ rolledBack: true, sourceDeleted: false });
  expect(crm.state.deleted).toBe(false);
});

test("requires a new Contact junction ID so a failed move can clean it up", async () => {
  const crm = makeCrm({ missingTargetLinkId: true });
  await expect(moveApplicationHistoryToMain({
    ZOHO: crm.ZOHO,
    sourceId: "application-history-1",
    destination: "contact",
    destinationId: "contact-2",
    listAttachments: crm.listAttachments,
  })).rejects.toMatchObject({ rolledBack: true, sourceDeleted: false });
  expect(crm.api.deleteRecord).toHaveBeenCalledWith({
    Entity: "History_X_Contacts",
    RecordID: "target-link-1",
  });
});

test("does not create a target when source attachments cannot be read", async () => {
  const crm = makeCrm();
  crm.listAttachments.mockResolvedValue({ data: null, error: "Attachment request failed" });
  await expect(moveApplicationHistoryToMain({
    ZOHO: crm.ZOHO,
    sourceId: "application-history-1",
    destination: "contact",
    destinationId: "contact-2",
    listAttachments: crm.listAttachments,
  })).rejects.toMatchObject({ targetId: null, sourceDeleted: false });
  expect(crm.api.insertRecord).not.toHaveBeenCalled();
  expect(crm.api.deleteRecord).not.toHaveBeenCalled();
});

test("stops when a source Contact junction is missing its Contact ID", async () => {
  const crm = makeCrm({ sourceLinksOverride: [{ id: "source-link-1", Contact: null }] });
  await expect(moveApplicationHistoryToMain({
    ZOHO: crm.ZOHO,
    sourceId: "application-history-1",
    destination: "stakeholder",
    destinationId: "stakeholder-2",
    listAttachments: crm.listAttachments,
  })).rejects.toMatchObject({ targetId: null, sourceDeleted: false });
  expect(crm.api.insertRecord).not.toHaveBeenCalled();
});

test("stops if the Contact related list exceeds the supported page cap", async () => {
  const crm = makeCrm();
  const fullPage = Array.from({ length: 200 }, (_, index) => ({
    id: `source-link-${index}`,
    Contact: { id: `contact-${index}` },
  }));
  crm.api.getRelatedRecords.mockResolvedValue({ data: fullPage, info: { more_records: true } });
  await expect(moveApplicationHistoryToMain({
    ZOHO: crm.ZOHO,
    sourceId: "application-history-1",
    destination: "contact",
    destinationId: "contact-2",
    listAttachments: crm.listAttachments,
  })).rejects.toMatchObject({ targetId: null, sourceDeleted: false });
  expect(crm.api.getRelatedRecords).toHaveBeenCalledTimes(100);
  expect(crm.api.insertRecord).not.toHaveBeenCalled();
});

test("waits for copied attachments to appear before deleting the source", async () => {
  const crm = makeCrm({ contacts: [], attachments: [{ File_Name: "letter.pdf" }] });
  let targetReads = 0;
  crm.listAttachments.mockImplementation(async ({ module }) => {
    if (module === "Applications_History") return { data: [{ File_Name: "letter.pdf" }], error: null };
    targetReads += 1;
    return { data: targetReads === 1 ? [] : [{ File_Name: "letter.pdf" }], error: null };
  });
  await moveApplicationHistoryToMain({
    ZOHO: crm.ZOHO,
    sourceId: "application-history-1",
    destination: "stakeholder",
    destinationId: "stakeholder-2",
    listAttachments: crm.listAttachments,
  });
  expect(targetReads).toBe(2);
  expect(crm.state.deleted).toBe(true);
});

test.each([
  ["Contact link", { failJunction: true }],
  ["attachment copy", { attachments: [{ File_Name: "letter.pdf" }], failCopy: true }],
  ["source deletion", { failDelete: true }],
])("reports partial failure when %s fails and never reports success", async (_, options) => {
  const crm = makeCrm(options);
  await expect(moveApplicationHistoryToMain({
    ZOHO: crm.ZOHO,
    sourceId: "application-history-1",
    destination: "contact",
    destinationId: "contact-2",
    listAttachments: crm.listAttachments,
  })).rejects.toMatchObject({
    name: "HistoryMoveError",
    sourceId: "application-history-1",
    targetId: "main-history-1",
    sourceDeleted: false,
    rolledBack: true,
  });
  expect(crm.state.deleted).toBe(false);
  expect(crm.state.rolledBack).toBe(true);
});

test("restores source Contact links when deleting the parent fails", async () => {
  const crm = makeCrm({ contacts: ["contact-1", "contact-2"], failDelete: true });
  await expect(moveApplicationHistoryToMain({
    ZOHO: crm.ZOHO,
    sourceId: "application-history-1",
    destination: "stakeholder",
    destinationId: "stakeholder-2",
    listAttachments: crm.listAttachments,
  })).rejects.toMatchObject({
    name: "HistoryMoveError",
    sourceDeleted: false,
    rolledBack: true,
    targetId: "main-history-1",
  });
  expect(crm.state.sourceLinks.map((link) => link.Contact.id).sort())
    .toEqual(["contact-1", "contact-2"]);
  expect(crm.api.insertRecord).toHaveBeenCalledWith(expect.objectContaining({
    Entity: "Application_Hstory",
  }));
  expect(crm.state.rolledBack).toBe(true);
});

test("retains the target when source Contact links cannot be restored", async () => {
  const crm = makeCrm({ failDelete: true, failSourceLinkRestore: true });
  await expect(moveApplicationHistoryToMain({
    ZOHO: crm.ZOHO,
    sourceId: "application-history-1",
    destination: "stakeholder",
    destinationId: "stakeholder-2",
    listAttachments: crm.listAttachments,
  })).rejects.toMatchObject({
    sourceDeleted: false,
    rolledBack: false,
    targetId: "main-history-1",
  });
  expect(crm.state.rolledBack).toBe(false);
});

test("retains the target when parent deletion outcome cannot be confirmed", async () => {
  const crm = makeCrm({ ambiguousSourceDelete: true });
  await expect(moveApplicationHistoryToMain({
    ZOHO: crm.ZOHO,
    sourceId: "application-history-1",
    destination: "stakeholder",
    destinationId: "stakeholder-2",
    listAttachments: crm.listAttachments,
  })).rejects.toMatchObject({
    sourceDeleted: false,
    rolledBack: false,
    targetId: "main-history-1",
  });
  expect(crm.state.rolledBack).toBe(false);
});

test("stops before deleting the source parent if a Contact link cannot be deleted", async () => {
  const crm = makeCrm({ failSourceJunctionDelete: true });
  await expect(moveApplicationHistoryToMain({
    ZOHO: crm.ZOHO,
    sourceId: "application-history-1",
    destination: "stakeholder",
    destinationId: "stakeholder-2",
    listAttachments: crm.listAttachments,
  })).rejects.toMatchObject({ rolledBack: true, sourceDeleted: false });
  expect(crm.state.parentDeletionAttempted).toBe(false);
});
