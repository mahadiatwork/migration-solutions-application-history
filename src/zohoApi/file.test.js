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

test("strict attachment reads collect every page", async () => {
  const firstPage = Array.from({ length: 200 }, (_, index) => attachment(`a-${index}`));
  invoke.mockResolvedValueOnce(pageResponse(firstPage, true, 1));
  invoke.mockResolvedValueOnce(pageResponse([attachment("a-200")], false, 2));

  const result = await file.getAttachments({
    module: "Applications_History",
    recordId: "history-1",
    strict: true,
  });
  expect(result.error).toBeNull();
  expect(result.data).toHaveLength(201);
  expect(result.data[200].id).toBe("a-200");
  expect(invoke).toHaveBeenCalledTimes(2);
  expect(invoke.mock.calls[0][1].url).toContain("page=1&per_page=200");
  expect(invoke.mock.calls[1][1].url).toContain("page=2&per_page=200");
});

test("strict attachment reads reject a full page without pagination info", async () => {
  invoke.mockResolvedValue({
    details: { statusCode: 200, statusMessage: JSON.stringify({
      data: Array.from({ length: 200 }, (_, index) => attachment(`a-${index}`)),
    }) },
  });
  const result = await file.getAttachments({ module: "History1", recordId: "history-1", strict: true });
  expect(result.data).toBeNull();
  expect(result.error).toMatch(/omitted pagination details/);
  expect(invoke).toHaveBeenCalledTimes(1);
});

test("strict attachment reads reject a malformed second page without returning the first", async () => {
  invoke.mockResolvedValueOnce(pageResponse([attachment("a-1")], true, 1));
  invoke.mockResolvedValueOnce({ details: { statusCode: 200, statusMessage: "not JSON" } });
  const result = await file.getAttachments({ module: "History1", recordId: "history-1", strict: true });
  expect(result.data).toBeNull();
  expect(result.error).toMatch(/readable attachment list/);
});

test("strict attachment reads reject a CRM error on a later page", async () => {
  invoke.mockResolvedValueOnce(pageResponse([attachment("a-1")], true, 1));
  invoke.mockResolvedValueOnce({
    details: {
      statusCode: 403,
      statusMessage: JSON.stringify({ code: "AUTHORIZATION_FAILED", message: "Attachment access denied" }),
    },
  });
  const result = await file.getAttachments({ module: "History1", recordId: "history-1", strict: true });
  expect(result.data).toBeNull();
  expect(result.error).toBe("Attachment access denied");
});

test("strict attachment reads reject repeated records across pages", async () => {
  invoke.mockResolvedValueOnce(pageResponse([attachment("same")], true, 1));
  invoke.mockResolvedValueOnce(pageResponse([attachment("same")], false, 2));
  const result = await file.getAttachments({ module: "History1", recordId: "history-1", strict: true });
  expect(result.data).toBeNull();
  expect(result.error).toMatch(/repeated attachment IDs/);
});

test("strict attachment reads stop at the page limit", async () => {
  invoke.mockImplementation(async (_, request) => {
    const page = Number(new URL(request.url).searchParams.get("page"));
    const rows = Array.from({ length: 200 }, (_, index) => attachment(`p${page}-${index}`));
    return pageResponse(rows, true, page);
  });
  const result = await file.getAttachments({ module: "History1", recordId: "history-1", strict: true });
  expect(result.data).toBeNull();
  expect(result.error).toMatch(/page limit/);
  expect(invoke).toHaveBeenCalledTimes(100);
});
