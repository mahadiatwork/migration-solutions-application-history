const loadRecordApi = ({ getRelatedRecords, invoke } = {}) => {
  jest.resetModules();
  window.ZOHO = {
    CRM: {
      API: {
        getRelatedRecords: getRelatedRecords || jest.fn(),
      },
      CONNECTION: {
        invoke: invoke || jest.fn(),
      },
    },
  };
  return require("./record");
};

afterEach(() => {
  jest.restoreAllMocks();
  delete window.ZOHO;
});

test("loads every related-list page from the active CRM environment", async () => {
  const getRelatedRecords = jest
    .fn()
    .mockResolvedValueOnce({
      data: [{ id: "history-1" }, { id: "history-2" }],
      info: { more_records: true },
    })
    .mockResolvedValueOnce({
      data: [{ id: "history-3" }],
      info: { more_records: false },
    });
  const { getRecordsFromRelatedList } = loadRecordApi({ getRelatedRecords });

  const result = await getRecordsFromRelatedList({
    module: "Applications",
    recordId: "matter-1",
    RelatedListAPI: "Application_History",
    perPage: 2,
    maxRecords: 10,
  });

  expect(result).toEqual({
    data: [
      { id: "history-1" },
      { id: "history-2" },
      { id: "history-3" },
    ],
    error: null,
  });
  expect(getRelatedRecords).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ page: 1, per_page: 2 })
  );
  expect(getRelatedRecords).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ page: 2, per_page: 2 })
  );
});

test("keeps a stable page size when the record limit ends mid-page", async () => {
  const getRelatedRecords = jest
    .fn()
    .mockResolvedValueOnce({
      data: [{ id: "history-1" }, { id: "history-2" }],
      info: { more_records: true },
    })
    .mockResolvedValueOnce({
      data: [{ id: "history-3" }, { id: "history-4" }],
      info: { more_records: true },
    });
  const { getRecordsFromRelatedList } = loadRecordApi({ getRelatedRecords });

  const result = await getRecordsFromRelatedList({
    module: "Applications",
    recordId: "matter-1",
    RelatedListAPI: "Application_History",
    perPage: 2,
    maxRecords: 3,
  });

  expect(result.data).toEqual([
    { id: "history-1" },
    { id: "history-2" },
    { id: "history-3" },
  ]);
  expect(getRelatedRecords).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ page: 2, per_page: 2 })
  );
});

test("prefers the current-environment related list over the OAuth connection", async () => {
  const getRelatedRecords = jest.fn().mockResolvedValue({
    data: [{ id: "sandbox-history" }],
    info: { more_records: false },
  });
  const invoke = jest.fn();
  const { fetchApplicationHistory } = loadRecordApi({
    getRelatedRecords,
    invoke,
  });

  await expect(
    fetchApplicationHistory("Applications", "sandbox-matter")
  ).resolves.toEqual([{ id: "sandbox-history" }]);
  expect(invoke).not.toHaveBeenCalled();
});

test("falls back to COQL when the related-list API fails", async () => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  const getRelatedRecords = jest
    .fn()
    .mockRejectedValue(new Error("related list unavailable"));
  const invoke = jest.fn().mockResolvedValue({
    details: {
      statusMessage: JSON.stringify({ data: [{ id: "coql-history" }] }),
    },
  });
  const { fetchApplicationHistory } = loadRecordApi({
    getRelatedRecords,
    invoke,
  });

  await expect(
    fetchApplicationHistory("Applications", "matter-1")
  ).resolves.toEqual([{ id: "coql-history" }]);
  expect(invoke).toHaveBeenCalledTimes(1);
});

test("throws on a COQL error payload instead of treating it as an empty list", async () => {
  const invoke = jest.fn().mockResolvedValue({
    details: {
      statusMessage: JSON.stringify({
        status: "error",
        code: "INVALID_QUERY",
        message: "invalid field",
      }),
    },
  });
  const { fetchApplicationHistoryViaCoqlV8 } = loadRecordApi({ invoke });

  await expect(
    fetchApplicationHistoryViaCoqlV8("matter-1")
  ).rejects.toThrow("INVALID_QUERY: invalid field");
});
