import React, { act } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockFetchApplicationHistory = jest.fn();

jest.mock("./hook/useZohoInit", () => ({
  useZohoInit: () => ({
    module: "Applications",
    recordId: "matter-1",
    initZoho: true,
  }),
}));

jest.mock("./zohoApi", () => ({
  zohoApi: {
    record: {
      fetchApplicationHistory: (...args) =>
        mockFetchApplicationHistory(...args),
    },
  },
}));

jest.mock("./services/picklistConfigService", () => ({
  fetchPicklistConfig: jest.fn().mockResolvedValue({
    _source: "custom_module",
  }),
  getTypeOptionsFromConfig: jest.fn().mockReturnValue([]),
}));

jest.mock("./GlobalState", () => ({
  setCurrentGlobalContact: jest.fn(),
}));

jest.mock("./components/organisms/Table", () => ({
  Table: ({ rows = [] }) => (
    <div>
      {rows.length === 0
        ? "No data available"
        : rows.map((row) => <div key={row.id}>{row.id}</div>)}
    </div>
  ),
}));

jest.mock("./components/organisms/Dialog", () => ({
  Dialog: ({ openDialog, onRecordAdded, title }) =>
    openDialog ? (
      <button
        type="button"
        onClick={() =>
          onRecordAdded({
            id: "history-new",
            Participants: [],
            Date: "2026-09-28T08:54:00+09:30",
            History_Type: "Communication & Meetings",
            History_Result: "Call",
            Duration_Min: "0",
            Regarding: "",
            History_Details: "test",
            Owner: { full_name: "Admin" },
          })
        }
      >
        Complete {title}
      </button>
    ) : null,
}));

beforeEach(() => {
  mockFetchApplicationHistory.mockReset().mockResolvedValue([]);
  window.ZOHO = {
    CRM: {
      API: {
        getAllUsers: jest.fn().mockResolvedValue({ users: [] }),
        getRecord: jest.fn().mockResolvedValue({
          data: [{ id: "matter-1", Name: "1" }],
        }),
      },
      CONFIG: {
        getCurrentUser: jest.fn().mockResolvedValue({
          users: [{ id: "user-1", full_name: "Admin" }],
        }),
      },
    },
  };
});

afterEach(() => {
  delete window.ZOHO;
});

test("keeps a newly created history record visible while Zoho indexes it", async () => {
  const App = require("./App").default;
  render(<App />);

  await screen.findByText("No data available");
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Complete Create" })
  );

  await screen.findByText("history-new");
  await act(async () => {
    await Promise.resolve();
  });

  expect(screen.getByText("history-new")).not.toBeNull();
  expect(mockFetchApplicationHistory).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(screen.queryByText("No data available")).toBeNull()
  );
});
