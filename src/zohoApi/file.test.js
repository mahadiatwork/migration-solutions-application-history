import { file, parseAttachmentListResponse } from "./file";

jest.mock("axios", () => ({ request: jest.fn() }));

const pageResponse = (data, moreRecords, page) => ({
  details: {
    statusCode: 200,
    statusMessage: JSON.stringify({
      data,
      info: { page, per_page: 200, more_records: moreRecords },
    }),
  },
});

const attachment = (id) => ({ id, File_Name: `${id}.pdf` });

let invoke;
beforeEach(() => {
  invoke = jest.fn();
  window.ZOHO = { CRM: { CONNECTION: { invoke } } };
});

afterEach(() => {
  delete window.ZOHO;
});

test("strict attachment reads accept a CRM list or explicit no-content response", () => {
  expect(parseAttachmentListResponse({
    details: { statusCode: 200, statusMessage: JSON.stringify({ data: [{ File_Name: "letter.pdf" }] }) },
  }, true)).toEqual({ data: [{ File_Name: "letter.pdf" }], error: null });
  expect(parseAttachmentListResponse({ details: { statusCode: 204, statusMessage: "" } }, true))
    .toEqual({ data: [], error: null });
});

test("strict attachment reads reject malformed or failed responses", () => {
  expect(parseAttachmentListResponse({ details: { statusCode: 200, statusMessage: "not JSON" } }, true).error)
    .toMatch(/readable attachment list/);
  expect(parseAttachmentListResponse({
    details: { statusCode: 403, statusMessage: JSON.stringify({ code: "NO_PERMISSION", message: "Denied" }) },
  }, true).error).toBe("Denied");
});

test("strict attachment parser exposes pagination and accepts code 200", () => {
  expect(parseAttachmentListResponse({
    details: { statusMessage: JSON.stringify({ code: "200", data: [{ File_Name: "one.pdf" }] }) },
  }, true)).toEqual({ data: [{ File_Name: "one.pdf" }], error: null });
  expect(parseAttachmentListResponse({
    details: { statusMessage: JSON.stringify({ data: [{ File_Name: "one.pdf" }], info: { more_records: true } }) },
  }, true)).toMatchObject({
    data: [{ File_Name: "one.pdf" }],
    info: { more_records: true },
    error: null,
  });
});

test("strict attachment parser rejects an SDK error inside the data array", () => {
  expect(parseAttachmentListResponse({
    data: [{ code: "AUTHORIZATION_FAILED", message: "Attachment access denied" }],
  }, true)).toEqual({ data: null, error: "Attachment access denied" });
});

test("strict attachment reads use the active CRM environment", async () => {
  const getRelatedRecords = jest.fn().mockResolvedValue({
    data: [attachment("sandbox-attachment")],
    info: { page: 1, per_page: 200, more_records: false },
  });
  window.ZOHO.CRM.API = { getRelatedRecords };

  const result = await file.getAttachments({
    module: "Applications_History",
    recordId: "sandbox-history",
    strict: true,
  });

  expect(result).toEqual({
    data: [attachment("sandbox-attachment")],
    error: null,
  });
  expect(getRelatedRecords).toHaveBeenCalledWith({
    Entity: "Applications_History",
    RecordID: "sandbox-history",
    RelatedList: "Attachments",
    page: 1,
    per_page: 200,
  });
  expect(invoke).not.toHaveBeenCalled();
});

test("strict active-environment reads collect every attachment page", async () => {
  const firstPage = Array.from(
    { length: 200 },
    (_, index) => attachment(`sdk-${index}`)
  );
  const getRelatedRecords = jest
    .fn()
    .mockResolvedValueOnce({
      data: firstPage,
      info: { page: 1, per_page: 200, more_records: true },
    })
    .mockResolvedValueOnce({
      data: [attachment("sdk-200")],
      info: { page: 2, per_page: 200, more_records: false },
    });
  window.ZOHO.CRM.API = { getRelatedRecords };

  const result = await file.getAttachments({
    module: "Applications_History",
    recordId: "sandbox-history",
    strict: true,
  });

  expect(result.error).toBeNull();
  expect(result.data).toHaveLength(201);
  expect(getRelatedRecords).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ page: 2, RecordID: "sandbox-history" })
  );
  expect(invoke).not.toHaveBeenCalled();
});

test("strict active-environment reads accept explicit no content", async () => {
  const getRelatedRecords = jest.fn().mockResolvedValue({
    statusText: "No Content",
  });
  window.ZOHO.CRM.API = { getRelatedRecords };

  await expect(file.getAttachments({
    module: "Applications_History",
    recordId: "sandbox-history",
    strict: true,
  })).resolves.toEqual({ data: [], error: null });
  expect(invoke).not.toHaveBeenCalled();
});

test("strict active-environment errors do not fall back to another CRM connection", async () => {
  const getRelatedRecords = jest.fn().mockResolvedValue({
    data: [{ code: "INVALID_DATA", message: "Record is not available" }],
  });
  window.ZOHO.CRM.API = { getRelatedRecords };

  await expect(file.getAttachments({
    module: "Applications_History",
    recordId: "sandbox-history",
    strict: true,
  })).resolves.toEqual({ data: null, error: "Record is not available" });
  expect(invoke).not.toHaveBeenCalled();
});

test("strict active-environment request failures do not fall back to another CRM connection", async () => {
  const getRelatedRecords = jest
    .fn()
    .mockRejectedValue(new Error("Active CRM attachment read failed"));
  window.ZOHO.CRM.API = { getRelatedRecords };

  await expect(file.getAttachments({
    module: "Applications_History",
    recordId: "sandbox-history",
    strict: true,
  })).resolves.toEqual({
    data: null,
    error: "Active CRM attachment read failed",
  });
  expect(invoke).not.toHaveBeenCalled();
});

test("strict reads fail closed when the active CRM API is unavailable", async () => {
  await expect(file.getAttachments({
    module: "Applications_History",
    recordId: "sandbox-history",
    strict: true,
  })).resolves.toEqual({
    data: null,
    error: "The active CRM attachment API is unavailable.",
  });
  expect(invoke).not.toHaveBeenCalled();
});

test("non-strict display reads retain the legacy connection fallback", async () => {
  invoke.mockResolvedValue(pageResponse([attachment("legacy")], false, 1));

  await expect(file.getAttachments({
    module: "Applications_History",
    recordId: "history-1",
  })).resolves.toEqual({ data: [attachment("legacy")], error: null });
  expect(invoke).toHaveBeenCalledTimes(1);
});

test("strict attachment reads reject a full page without pagination info", async () => {
  const getRelatedRecords = jest.fn().mockResolvedValue({
    data: Array.from({ length: 200 }, (_, index) => attachment(`a-${index}`)),
  });
  window.ZOHO.CRM.API = { getRelatedRecords };
  const result = await file.getAttachments({ module: "History1", recordId: "history-1", strict: true });
  expect(result.data).toBeNull();
  expect(result.error).toMatch(/omitted pagination details/);
  expect(getRelatedRecords).toHaveBeenCalledTimes(1);
});

test("strict attachment reads reject a malformed second page without returning the first", async () => {
  const getRelatedRecords = jest
    .fn()
    .mockResolvedValueOnce({
      data: [attachment("a-1")],
      info: { page: 1, more_records: true },
    })
    .mockResolvedValueOnce({ details: { statusCode: 200, statusMessage: "not JSON" } });
  window.ZOHO.CRM.API = { getRelatedRecords };
  const result = await file.getAttachments({ module: "History1", recordId: "history-1", strict: true });
  expect(result.data).toBeNull();
  expect(result.error).toMatch(/readable attachment list/);
});

test("strict attachment reads reject a CRM error on a later page", async () => {
  const getRelatedRecords = jest
    .fn()
    .mockResolvedValueOnce({
      data: [attachment("a-1")],
      info: { page: 1, more_records: true },
    })
    .mockResolvedValueOnce({
      code: "AUTHORIZATION_FAILED",
      message: "Attachment access denied",
    });
  window.ZOHO.CRM.API = { getRelatedRecords };
  const result = await file.getAttachments({ module: "History1", recordId: "history-1", strict: true });
  expect(result.data).toBeNull();
  expect(result.error).toBe("Attachment access denied");
});

test("strict attachment reads reject repeated records across pages", async () => {
  const getRelatedRecords = jest
    .fn()
    .mockResolvedValueOnce({
      data: [attachment("same")],
      info: { page: 1, more_records: true },
    })
    .mockResolvedValueOnce({
      data: [attachment("same")],
      info: { page: 2, more_records: false },
    });
  window.ZOHO.CRM.API = { getRelatedRecords };
  const result = await file.getAttachments({ module: "History1", recordId: "history-1", strict: true });
  expect(result.data).toBeNull();
  expect(result.error).toMatch(/repeated attachment IDs/);
});

test("strict attachment reads normalize a string pagination flag", async () => {
  const getRelatedRecords = jest
    .fn()
    .mockResolvedValueOnce({
      data: [attachment("a-1")],
      info: { page: 1, more_records: "true" },
    })
    .mockResolvedValueOnce({
      data: [attachment("a-2")],
      info: { page: 2, more_records: "false" },
    });
  window.ZOHO.CRM.API = { getRelatedRecords };

  const result = await file.getAttachments({
    module: "History1",
    recordId: "history-1",
    strict: true,
  });

  expect(result).toEqual({
    data: [attachment("a-1"), attachment("a-2")],
    error: null,
  });
  expect(getRelatedRecords).toHaveBeenCalledTimes(2);
});

test("strict attachment reads stop at the page limit", async () => {
  const getRelatedRecords = jest.fn().mockImplementation(async ({ page }) => {
    const rows = Array.from({ length: 200 }, (_, index) => attachment(`p${page}-${index}`));
    return { data: rows, info: { page, more_records: true } };
  });
  window.ZOHO.CRM.API = { getRelatedRecords };
  const result = await file.getAttachments({ module: "History1", recordId: "history-1", strict: true });
  expect(result.data).toBeNull();
  expect(result.error).toMatch(/page limit/);
  expect(getRelatedRecords).toHaveBeenCalledTimes(100);
});
