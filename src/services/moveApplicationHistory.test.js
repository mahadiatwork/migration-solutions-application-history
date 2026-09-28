import {
  buildMatterMovePayload,
  fetchContactMatters,
  moveApplicationHistoryToMain,
  moveApplicationHistoryToMatter,
} from "./moveApplicationHistory";

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
  targetLinkStakeholder,
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
      if (Entity === "Applications_History") return { data: [source] };
      if (Entity === "Application_Hstory") return { data: [{ id: RecordID }] };
      const target = {
        id: "main-history-1",
        ...state.payload,
        Matter: targetMatter,
        ...targetOverride,
      };
      // History1 does not return unused fields that are absent from its layout.
      if (!Object.prototype.hasOwnProperty.call(targetOverride, "Billing_Type")) {
        delete target.Billing_Type;
      }
      return { data: [target] };
    }),
    getRelatedRecords: jest.fn(async ({ Entity }) => ({
      data: Entity === "Applications_History"
        ? state.sourceLinks
        : state.targetContacts.map((id, index) => ({
          id: `target-link-${index + 1}`,
          Contact_Details: { id },
          Stakeholder: targetLinkStakeholder === undefined
            ? state.payload?.Stakeholder
            : targetLinkStakeholder,
        })),
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
  expect(crm.api.insertRecord).toHaveBeenCalledWith(expect.objectContaining({
    Entity: "History_X_Contacts",
    APIData: expect.objectContaining({
      Stakeholder: { id: "stakeholder-1" },
    }),
  }));
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
  expect(crm.ZOHO.CRM.FUNCTIONS.execute).not.toHaveBeenCalled();
});

test.each([
  [null, "Billable"],
  ["Non-Billable", "Non-Billable"],
])(
  "preserves Billing Type in the create payload when CRM omits it from readback (%s)",
  async (sourceBillingType, expectedBillingType) => {
    const crm = makeCrm({ contacts: [], sourceBillingType });
    await moveApplicationHistoryToMain({
      ZOHO: crm.ZOHO,
      sourceId: "application-history-1",
      destination: "stakeholder",
      destinationId: "stakeholder-2",
      listAttachments: crm.listAttachments,
    });
    expect(crm.state.payload.Billing_Type).toBe(expectedBillingType);
    expect(crm.state.deleted).toBe(true);
  }
);

test("accepts a matching Billing Type when CRM returns the field", async () => {
  const crm = makeCrm({ targetOverride: { Billing_Type: "Non-Billable" } });
  await expect(moveApplicationHistoryToMain({
    ZOHO: crm.ZOHO,
    sourceId: "application-history-1",
    destination: "contact",
    destinationId: "contact-2",
    listAttachments: crm.listAttachments,
  })).resolves.toMatchObject({ targetId: "main-history-1" });
  expect(crm.state.deleted).toBe(true);
});

test.each([null, "", "-None-", "Write-Off"])(
  "rolls back if CRM explicitly returns a different Billing Type (%s)",
  async (targetBillingType) => {
    const crm = makeCrm({ targetOverride: { Billing_Type: targetBillingType } });
    await expect(moveApplicationHistoryToMain({
      ZOHO: crm.ZOHO,
      sourceId: "application-history-1",
      destination: "contact",
      destinationId: "contact-2",
      listAttachments: crm.listAttachments,
    })).rejects.toMatchObject({ rolledBack: true, sourceDeleted: false });
    expect(crm.state.deleted).toBe(false);
  }
);

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

test("rolls back a Contact move when its junction Stakeholder is different", async () => {
  const crm = makeCrm({ targetLinkStakeholder: { id: "wrong-stakeholder" } });
  await expect(moveApplicationHistoryToMain({
    ZOHO: crm.ZOHO,
    sourceId: "application-history-1",
    destination: "contact",
    destinationId: "contact-2",
    listAttachments: crm.listAttachments,
  })).rejects.toMatchObject({ rolledBack: true, sourceDeleted: false });
  expect(crm.state.deleted).toBe(false);
});

const makeMatterMoveCrm = ({
  matterOverrides = {},
  contactOverrides = {},
  initialContacts = ["contact-1"],
  failLink = false,
  mutateLinksOnMove = false,
  workflowAddsDestinationOnMove = false,
  workflowDestinationDelayReads = 0,
  duplicateDestinationOnInsert = false,
  linkVisibilityDelayReads = 0,
  concurrentLinkOnRejectedInsert = false,
  insertReturnsNoId = false,
  mutateHistoryContentOnMove = false,
  verificationOverride = null,
  verificationOverrideAfterReads = 0,
} = {}) => {
  const source = {
    id: "application-history-1",
    Name: "1 - Old Contact",
    Application: { id: "matter-1" },
    Matter_No: "1",
    Current_Stage: "1. Enquiry",
    Matter_Progress: ["Initial information requested"],
    Stakeholder: { id: "stakeholder-old" },
    History_Details: "Original details",
    History_Result: "Call",
    History_Type: "Communication & Meetings",
    Regarding: "Original regarding",
    Duration_Min: "30",
    Date: "2026-09-28T08:54:00+09:30",
    Billing_Type: "Billable",
    Owner: { id: "owner-1", name: "Admin" },
  };
  const matter = {
    id: "matter-2",
    Name: "2A",
    Contact_Name: { id: "contact-2", name: "New Contact" },
    Current_Stage: "6. Preparation",
    Matter_Progress: ["Draft completed"],
    Stakeholder_Auto: { id: "stakeholder-new", name: "New Stakeholder" },
    ...matterOverrides,
  };
  const contact = {
    id: "contact-2",
    Full_Name: "New Contact",
    Account_Name: { id: "contact-stakeholder", name: "Contact Stakeholder" },
    ...contactOverrides,
  };
  const state = {
    history: { ...source },
    destinationReads: 0,
    hiddenLinkId: null,
    hiddenLinkReadsRemaining: 0,
    workflowDestinationReadsRemaining: 0,
    links: initialContacts.map((id, index) => ({
      id: `application-link-${index + 1}`,
      Contact: { id },
    })),
  };
  const api = {
    getRecord: jest.fn(async ({ Entity, RecordID }) => {
      if (Entity === "Applications") return { data: [{ ...matter }] };
      if (Entity === "Contacts") return { data: [{ ...contact }] };
      const history = { ...state.history };
      if (
        verificationOverride &&
        String(history.Application?.id) === String(matter.id)
      ) {
        state.destinationReads += 1;
        if (state.destinationReads > verificationOverrideAfterReads) {
          Object.assign(history, verificationOverride);
        }
      }
      return { data: [{ ...history, id: RecordID }] };
    }),
    getRelatedRecords: jest.fn(async ({ Entity }) => {
      if (
        Entity === "Applications_History" &&
        state.workflowDestinationReadsRemaining > 0
      ) {
        state.workflowDestinationReadsRemaining -= 1;
        if (state.workflowDestinationReadsRemaining === 0) {
          state.links.push({
            id: "delayed-workflow-contact-link",
            Contact: { id: "contact-2" },
          });
        }
      }
      let links = Entity === "Applications_History" ? [...state.links] : [];
      if (state.hiddenLinkReadsRemaining > 0) {
        state.hiddenLinkReadsRemaining -= 1;
        links = links.filter((link) => link.id !== state.hiddenLinkId);
      }
      return { data: links, info: { more_records: false } };
    }),
    updateRecord: jest.fn(async ({ APIData }) => {
      state.history = { ...state.history, ...APIData };
      if (
        mutateLinksOnMove &&
        String(APIData.Application?.id) === String(matter.id) &&
        !state.linksMutated
      ) {
        state.linksMutated = true;
        state.links = state.links.filter(
          (link) => String(link.Contact?.id) !== "contact-1"
        );
      }
      if (
        workflowAddsDestinationOnMove &&
        String(APIData.Application?.id) === String(matter.id) &&
        !state.links.some((link) => String(link.Contact?.id) === "contact-2")
      ) {
        state.links.push({
          id: "workflow-contact-link",
          Contact: { id: "contact-2" },
        });
      }
      if (
        workflowDestinationDelayReads > 0 &&
        String(APIData.Application?.id) === String(matter.id)
      ) {
        state.workflowDestinationReadsRemaining = workflowDestinationDelayReads;
      }
      if (
        mutateHistoryContentOnMove &&
        String(APIData.Application?.id) === String(matter.id)
      ) {
        state.history.History_Details = "Changed by workflow";
      }
      return success("application-history-1");
    }),
    insertRecord: jest.fn(async ({ Entity, APIData }) => {
      if (Entity !== "Application_Hstory") {
        return { data: [{ code: "INVALID_DATA", message: "Unexpected insert" }] };
      }
      if (failLink) {
        if (concurrentLinkOnRejectedInsert) {
          state.links.push({
            id: "concurrent-contact-link",
            Contact: { id: APIData.Contact.id },
          });
        }
        return { data: [{ code: "INVALID_DATA", message: "Contact link rejected" }] };
      }
      const id = `application-link-${state.links.length + 1}`;
      state.links.push({ id, Contact: { id: APIData.Contact.id } });
      if (duplicateDestinationOnInsert) {
        state.links.push({
          id: `${id}-duplicate`,
          Contact: { id: APIData.Contact.id },
        });
      }
      if (linkVisibilityDelayReads > 0) {
        state.hiddenLinkId = id;
        state.hiddenLinkReadsRemaining = linkVisibilityDelayReads;
      }
      return insertReturnsNoId
        ? { data: [{ code: "SUCCESS", details: {} }] }
        : success(id);
    }),
    deleteRecord: jest.fn(async ({ Entity, RecordID }) => {
      if (Entity === "Application_Hstory") {
        state.links = state.links.filter((link) => link.id !== RecordID);
      }
      return success(RecordID);
    }),
  };
  return { ZOHO: { CRM: { API: api } }, api, state, source, matter, contact };
};

describe("Application History to another Matter move", () => {
  test("reassigns the same record, applies the destination snapshot and adds the Contact", async () => {
    const crm = makeMatterMoveCrm();
    await expect(moveApplicationHistoryToMatter({
      ZOHO: crm.ZOHO,
      sourceId: "application-history-1",
      destinationMatterId: "matter-2",
      destinationContactId: "contact-2",
      delay: async () => {},
    })).resolves.toEqual({
      sourceId: "application-history-1",
      targetId: "application-history-1",
      destination: "matter",
      matterId: "matter-2",
      contactId: "contact-2",
    });

    expect(crm.state.history).toMatchObject({
      id: "application-history-1",
      Name: "2A - Old Contact",
      Application: { id: "matter-2" },
      Matter_No: "2A",
      Current_Stage: "6. Preparation",
      Matter_Progress: ["Draft completed"],
      Stakeholder: { id: "stakeholder-new" },
      History_Details: "Original details",
      Owner: { id: "owner-1" },
    });
    expect(crm.state.links.map((link) => link.Contact.id).sort())
      .toEqual(["contact-1", "contact-2"]);
    expect(crm.api.deleteRecord).not.toHaveBeenCalledWith(expect.objectContaining({
      Entity: "Applications_History",
    }));
  });

  test("uses the selected Contact Stakeholder when the Matter has none", () => {
    const crm = makeMatterMoveCrm({
      matterOverrides: { Stakeholder_Auto: null, Stakeholder_1: null },
    });
    expect(buildMatterMovePayload(crm.source, crm.matter, crm.contact).Stakeholder)
      .toEqual({ id: "contact-stakeholder" });
  });

  test("uses the Matter's normal Stakeholder precedence", () => {
    const crm = makeMatterMoveCrm({
      matterOverrides: {
        Stakeholder_1: { id: "stakeholder-manual", name: "Manual Stakeholder" },
        Stakeholder_Auto: { id: "stakeholder-auto", name: "Auto Stakeholder" },
      },
    });
    expect(buildMatterMovePayload(crm.source, crm.matter, crm.contact).Stakeholder)
      .toEqual({ id: "stakeholder-manual" });
  });

  test("uses a legacy Matter Stakeholder before the Contact account", () => {
    const crm = makeMatterMoveCrm({
      matterOverrides: {
        Stakeholder_1: null,
        Stakeholder_Auto: null,
        Stake_Holder: { id: "stakeholder-legacy", name: "Legacy Stakeholder" },
      },
    });
    expect(buildMatterMovePayload(crm.source, crm.matter, crm.contact).Stakeholder)
      .toEqual({ id: "stakeholder-legacy" });
  });

  test("replaces the old Matter prefix using the source lookup name", () => {
    const crm = makeMatterMoveCrm();
    const source = {
      ...crm.source,
      Name: "1 - Old Contact",
      Matter_No: null,
      Application: { id: "matter-1", name: "1" },
    };
    expect(buildMatterMovePayload(source, crm.matter, crm.contact).Name)
      .toBe("2A - Old Contact");
  });

  test("does not duplicate an existing selected Contact link", async () => {
    const crm = makeMatterMoveCrm({ initialContacts: ["contact-1", "contact-2"] });
    await moveApplicationHistoryToMatter({
      ZOHO: crm.ZOHO,
      sourceId: "application-history-1",
      destinationMatterId: "matter-2",
      destinationContactId: "contact-2",
      delay: async () => {},
    });
    expect(crm.api.insertRecord).not.toHaveBeenCalled();
    expect(crm.state.links).toHaveLength(2);
  });

  test("does not duplicate a destination Contact link added by a workflow", async () => {
    const crm = makeMatterMoveCrm({ workflowAddsDestinationOnMove: true });
    await moveApplicationHistoryToMatter({
      ZOHO: crm.ZOHO,
      sourceId: "application-history-1",
      destinationMatterId: "matter-2",
      destinationContactId: "contact-2",
      delay: async () => {},
    });
    expect(crm.api.insertRecord).not.toHaveBeenCalled();
    expect(crm.state.links.map((link) => link.Contact.id).sort())
      .toEqual(["contact-1", "contact-2"]);
  });

  test("waits for a delayed workflow Contact link before inserting one", async () => {
    const crm = makeMatterMoveCrm({ workflowDestinationDelayReads: 2 });
    await moveApplicationHistoryToMatter({
      ZOHO: crm.ZOHO,
      sourceId: "application-history-1",
      destinationMatterId: "matter-2",
      destinationContactId: "contact-2",
      delay: async () => {},
    });
    expect(crm.api.insertRecord).not.toHaveBeenCalled();
    expect(crm.state.links.map((link) => link.Contact.id).sort())
      .toEqual(["contact-1", "contact-2"]);
  });

  test("waits for a newly inserted Contact link to appear", async () => {
    const crm = makeMatterMoveCrm({ linkVisibilityDelayReads: 1 });
    await expect(moveApplicationHistoryToMatter({
      ZOHO: crm.ZOHO,
      sourceId: "application-history-1",
      destinationMatterId: "matter-2",
      destinationContactId: "contact-2",
      delay: async () => {},
    })).resolves.toMatchObject({ destination: "matter" });
    expect(crm.state.links.map((link) => link.Contact.id).sort())
      .toEqual(["contact-1", "contact-2"]);
  });

  test("rejects duplicate destination Contact links", async () => {
    const crm = makeMatterMoveCrm({ duplicateDestinationOnInsert: true });
    await expect(moveApplicationHistoryToMatter({
      ZOHO: crm.ZOHO,
      sourceId: "application-history-1",
      destinationMatterId: "matter-2",
      destinationContactId: "contact-2",
      delay: async () => {},
    })).rejects.toThrow("did not retain the expected Contact links");
    expect(crm.state.history.Application).toEqual({ id: "matter-1" });
  });

  test("restores unchanged History content when a workflow alters it", async () => {
    const crm = makeMatterMoveCrm({ mutateHistoryContentOnMove: true });
    await expect(moveApplicationHistoryToMatter({
      ZOHO: crm.ZOHO,
      sourceId: "application-history-1",
      destinationMatterId: "matter-2",
      destinationContactId: "contact-2",
      delay: async () => {},
    })).rejects.toThrow("did not retain the selected Matter details");
    expect(crm.state.history).toMatchObject({
      Application: { id: "matter-1" },
      History_Details: "Original details",
      History_Result: "Call",
      Regarding: "Original regarding",
      Owner: { id: "owner-1" },
    });
  });

  test("does not delete an ambiguous Contact link when CRM omits its ID", async () => {
    const crm = makeMatterMoveCrm({
      insertReturnsNoId: true,
      verificationOverride: { Matter_No: "WRONG" },
      verificationOverrideAfterReads: 1,
    });
    await expect(moveApplicationHistoryToMatter({
      ZOHO: crm.ZOHO,
      sourceId: "application-history-1",
      destinationMatterId: "matter-2",
      destinationContactId: "contact-2",
      delay: async () => {},
    })).rejects.toThrow("Rollback needs attention");
    expect(crm.state.history.Application).toEqual({ id: "matter-1" });
    expect(crm.state.links.map((link) => link.Contact.id).sort())
      .toEqual(["contact-1", "contact-2"]);
    expect(crm.api.deleteRecord).not.toHaveBeenCalledWith(
      expect.objectContaining({ Entity: "Application_Hstory" })
    );
  });

  test("rejects the current Matter before making any changes", async () => {
    const crm = makeMatterMoveCrm({ matterOverrides: { id: "matter-1" } });
    await expect(moveApplicationHistoryToMatter({
      ZOHO: crm.ZOHO,
      sourceId: "application-history-1",
      destinationMatterId: "matter-1",
      destinationContactId: "contact-2",
      delay: async () => {},
    })).rejects.toThrow("Select a different Matter");
    expect(crm.api.updateRecord).not.toHaveBeenCalled();
    expect(crm.api.insertRecord).not.toHaveBeenCalled();
  });

  test("rejects a Matter that is no longer associated with the selected Contact", async () => {
    const crm = makeMatterMoveCrm({
      matterOverrides: { Contact_Name: { id: "contact-other", name: "Other Contact" } },
    });
    await expect(moveApplicationHistoryToMatter({
      ZOHO: crm.ZOHO,
      sourceId: "application-history-1",
      destinationMatterId: "matter-2",
      destinationContactId: "contact-2",
      delay: async () => {},
    })).rejects.toThrow("no longer associated with this Contact");
    expect(crm.api.updateRecord).not.toHaveBeenCalled();
    expect(crm.api.insertRecord).not.toHaveBeenCalled();
  });

  test("restores the original Matter and removes a new Contact link after verification fails", async () => {
    const crm = makeMatterMoveCrm({
      verificationOverride: { Matter_No: "WRONG" },
      verificationOverrideAfterReads: 1,
    });
    await expect(moveApplicationHistoryToMatter({
      ZOHO: crm.ZOHO,
      sourceId: "application-history-1",
      destinationMatterId: "matter-2",
      destinationContactId: "contact-2",
      delay: async () => {},
    })).rejects.toThrow("History remains on its original Matter");

    expect(crm.state.history).toMatchObject({
      Application: { id: "matter-1" },
      Matter_No: "1",
      Stakeholder: { id: "stakeholder-old" },
    });
    expect(crm.state.links.map((link) => link.Contact.id)).toEqual(["contact-1"]);
  });

  test("restores the original Matter when the selected Contact link is rejected", async () => {
    const crm = makeMatterMoveCrm({ failLink: true });
    await expect(moveApplicationHistoryToMatter({
      ZOHO: crm.ZOHO,
      sourceId: "application-history-1",
      destinationMatterId: "matter-2",
      destinationContactId: "contact-2",
      delay: async () => {},
    })).rejects.toThrow("Contact link rejected");
    expect(crm.state.history.Application).toEqual({ id: "matter-1" });
    expect(crm.state.links.map((link) => link.Contact.id)).toEqual(["contact-1"]);
  });

  test("does not delete a concurrent Contact link after an insert rejection", async () => {
    const crm = makeMatterMoveCrm({
      failLink: true,
      concurrentLinkOnRejectedInsert: true,
    });
    await expect(moveApplicationHistoryToMatter({
      ZOHO: crm.ZOHO,
      sourceId: "application-history-1",
      destinationMatterId: "matter-2",
      destinationContactId: "contact-2",
      delay: async () => {},
    })).rejects.toThrow("Rollback needs attention");
    expect(crm.state.history.Application).toEqual({ id: "matter-1" });
    expect(crm.state.links.map((link) => link.Contact.id).sort())
      .toEqual(["contact-1", "contact-2"]);
    expect(crm.api.deleteRecord).not.toHaveBeenCalledWith(
      expect.objectContaining({ RecordID: "concurrent-contact-link" })
    );
  });

  test("restores original Contact links changed by a Matter workflow", async () => {
    const crm = makeMatterMoveCrm({ mutateLinksOnMove: true });
    await expect(moveApplicationHistoryToMatter({
      ZOHO: crm.ZOHO,
      sourceId: "application-history-1",
      destinationMatterId: "matter-2",
      destinationContactId: "contact-2",
      delay: async () => {},
    })).rejects.toThrow("History remains on its original Matter");
    expect(crm.state.history.Application).toEqual({ id: "matter-1" });
    expect(crm.state.links.map((link) => link.Contact.id)).toEqual(["contact-1"]);
  });
});

describe("Contact Matter lookup", () => {
  test("loads all pages, removes duplicates and excludes the current Matter", async () => {
    const getRelatedRecords = jest
      .fn()
      .mockResolvedValueOnce({
        data: [
          { id: "matter-2", Name: "10" },
          { id: "matter-1", Name: "1" },
        ],
        info: { more_records: true },
      })
      .mockResolvedValueOnce({
        data: [
          { id: "matter-2", Name: "10" },
          { id: "matter-3", Name: "2" },
        ],
        info: { more_records: false },
      });
    const matters = await fetchContactMatters({
      ZOHO: { CRM: { API: { getRelatedRecords } } },
      contactId: "contact-2",
      excludeMatterId: "matter-1",
    });

    expect(matters.map((matter) => matter.id)).toEqual(["matter-3", "matter-2"]);
    expect(getRelatedRecords).toHaveBeenCalledTimes(2);
    expect(getRelatedRecords).toHaveBeenCalledWith(expect.objectContaining({
      Entity: "Contacts",
      RecordID: "contact-2",
      RelatedList: "Applications",
      page: 1,
      per_page: 200,
    }));
  });
});
