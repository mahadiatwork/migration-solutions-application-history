import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import StakeholderMoveDialog from "./StakeholderMoveDialog";

const mockFetchStakeholderMatters = jest.fn();
const mockMoveApplicationHistoryToMain = jest.fn();
const mockMoveApplicationHistoryToStakeholderMatter = jest.fn();

jest.mock("../../services/moveApplicationHistory", () => ({
  fetchStakeholderMatters: (...args) => mockFetchStakeholderMatters(...args),
  moveApplicationHistoryToMain: (...args) => mockMoveApplicationHistoryToMain(...args),
  moveApplicationHistoryToStakeholderMatter: (...args) =>
    mockMoveApplicationHistoryToStakeholderMatter(...args),
}));

const matters = [
  {
    id: "matter-current",
    Name: "1",
    Current_Stage: "1. Enquiry",
    Matter_Progress: ["Enquiry received"],
    Stakeholder_Auto: { id: "stakeholder-1", name: "The Cheesecake Shop" },
  },
  {
    id: "matter-2",
    Name: "2",
    Current_Stage: "2. Consultation/Strategy & Eligibility",
    Matter_Progress: ["Consultation scheduled"],
    Stakeholder_Auto: { id: "stakeholder-1", name: "The Cheesecake Shop" },
  },
];

const renderDialog = (overrides = {}) => {
  const props = {
    open: true,
    onClose: jest.fn(),
    ZOHO: { CRM: { API: { searchRecord: jest.fn() } } },
    selectedRowData: { id: "history-1" },
    suggestedStakeholder: { id: "stakeholder-1", name: "The Cheesecake Shop" },
    sourceMatterId: "matter-current",
    historySummary: {
      Current_Stage: "1. Enquiry",
      Matter_Progress: "Awaiting Advisor response",
    },
    matterSummaryReady: true,
    onRecordMoved: jest.fn(),
    ...overrides,
  };
  render(<StakeholderMoveDialog {...props} />);
  return props;
};

describe("StakeholderMoveDialog destinations", () => {
  beforeEach(() => {
    mockFetchStakeholderMatters.mockReset().mockResolvedValue(matters);
    mockMoveApplicationHistoryToMain.mockReset().mockResolvedValue({});
    mockMoveApplicationHistoryToStakeholderMatter.mockReset().mockResolvedValue({});
  });

  test("loads the selected Stakeholder's Matters and moves to a different Matter", async () => {
    const { ZOHO, historySummary, onClose, onRecordMoved } = renderDialog();

    fireEvent.click(
      screen.getByRole("radio", { name: "Select Stakeholder The Cheesecake Shop" })
    );
    fireEvent.click(screen.getByRole("button", { name: "View Stakeholder Matters" }));

    await waitFor(() => {
      expect(mockFetchStakeholderMatters).toHaveBeenCalledWith({
        ZOHO,
        stakeholderId: "stakeholder-1",
      });
    });
    expect(await screen.findByText(/1 \(Current Matter\)/)).not.toBeNull();
    expect(screen.getByRole("radio", { name: "Select Matter 1" }).disabled).toBe(true);
    expect(screen.getByText("Consultation scheduled")).not.toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Select Matter 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Move to Selected Matter" }));

    await waitFor(() => {
      expect(mockMoveApplicationHistoryToStakeholderMatter).toHaveBeenCalledWith({
        ZOHO,
        sourceId: "history-1",
        destinationMatterId: "matter-2",
        destinationStakeholderId: "stakeholder-1",
        historySummary,
      });
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onRecordMoved).toHaveBeenCalledWith("history-1");
    expect(mockMoveApplicationHistoryToMain).not.toHaveBeenCalled();
  });

  test("keeps Stakeholder History as an explicit destination", async () => {
    const { ZOHO, onClose, onRecordMoved } = renderDialog();

    fireEvent.click(
      screen.getByRole("radio", { name: "Select Stakeholder The Cheesecake Shop" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Move to Stakeholder History" }));

    await waitFor(() => {
      expect(mockMoveApplicationHistoryToMain).toHaveBeenCalledWith({
        ZOHO,
        sourceId: "history-1",
        destination: "stakeholder",
        destinationId: "stakeholder-1",
        destinationName: "The Cheesecake Shop",
      });
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onRecordMoved).toHaveBeenCalledWith("history-1");
    expect(mockMoveApplicationHistoryToStakeholderMatter).not.toHaveBeenCalled();
  });

  test("clears loaded Matters when a new Stakeholder search starts", async () => {
    const ZOHO = {
      CRM: {
        API: {
          searchRecord: jest.fn().mockResolvedValue({
            data: [{ id: "stakeholder-2", Account_Name: "New Stakeholder" }],
          }),
        },
      },
    };
    renderDialog({ ZOHO });

    fireEvent.click(
      screen.getByRole("radio", { name: "Select Stakeholder The Cheesecake Shop" })
    );
    fireEvent.click(screen.getByRole("button", { name: "View Stakeholder Matters" }));
    await screen.findByText("Select Target Matter:");

    fireEvent.change(screen.getByLabelText("Search Stakeholders"), {
      target: { value: "New" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(screen.queryByText("Select Target Matter:")).toBeNull();
    expect(screen.queryByText("The Cheesecake Shop")).toBeNull();
    expect(screen.getByRole("button", { name: "Move to Selected Matter" }).disabled).toBe(true);
    expect(await screen.findByText("New Stakeholder")).not.toBeNull();
    expect(ZOHO.CRM.API.searchRecord).toHaveBeenCalledWith({
      Entity: "Accounts",
      Type: "word",
      Query: "New",
    });
  });

  test("allows a direct Stakeholder History move when the Stakeholder has no Matters", async () => {
    mockFetchStakeholderMatters.mockResolvedValue([]);
    renderDialog();

    fireEvent.click(
      screen.getByRole("radio", { name: "Select Stakeholder The Cheesecake Shop" })
    );
    fireEvent.click(screen.getByRole("button", { name: "View Stakeholder Matters" }));

    expect(
      await screen.findByText(
        "This Stakeholder has no Matters. You can still move the History to Stakeholder History."
      )
    ).not.toBeNull();
    expect(screen.getByRole("button", { name: "Move to Stakeholder History" }).disabled)
      .toBe(false);
    expect(screen.getByRole("button", { name: "Move to Selected Matter" }).disabled)
      .toBe(true);
  });
});
