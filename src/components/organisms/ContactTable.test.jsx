import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ContactDialog } from "./ContactTable";

const mockFetchContactMatters = jest.fn();
const mockMoveApplicationHistoryToMain = jest.fn();
const mockMoveApplicationHistoryToMatter = jest.fn();

jest.mock("../../services/moveApplicationHistory", () => ({
  fetchContactMatters: (...args) => mockFetchContactMatters(...args),
  moveApplicationHistoryToMain: (...args) => mockMoveApplicationHistoryToMain(...args),
  moveApplicationHistoryToMatter: (...args) => mockMoveApplicationHistoryToMatter(...args),
}));

const contacts = [
  { id: "contact-1", First_Name: "Alice", Last_Name: "Adams", Full_Name: "Alice Adams" },
  { id: "contact-2", First_Name: "Bob", Last_Name: "Brown", Full_Name: "Bob Brown" },
];

const matters = [
  {
    id: "matter-current",
    Name: "1",
    Current_Stage: "1. Enquiry",
    Matter_Progress: ["Enquiry received"],
    Stakeholder_Auto: { id: "account-1", name: "Current Stakeholder" },
  },
  {
    id: "matter-2",
    Name: "2",
    Current_Stage: "2. Consultation/Strategy & Eligibility",
    Matter_Progress: ["Consultation scheduled"],
    Stakeholder_1: { id: "account-2", name: "Destination Stakeholder" },
  },
];

const renderDialog = (overrides = {}) => {
  const props = {
    openContactDialog: true,
    handleContactDialogClose: jest.fn(),
    contacts,
    ZOHO: { CRM: { API: { searchRecord: jest.fn() } } },
    selectedRowData: { id: "history-1" },
    sourceMatterId: "matter-current",
    onRecordMoved: jest.fn(),
    ...overrides,
  };
  render(<ContactDialog {...props} />);
  return props;
};

describe("ContactDialog Matter destinations", () => {
  beforeEach(() => {
    mockFetchContactMatters.mockReset().mockResolvedValue(matters);
    mockMoveApplicationHistoryToMain.mockReset().mockResolvedValue({});
    mockMoveApplicationHistoryToMatter.mockReset().mockResolvedValue({});
  });

  test("loads the selected Contact's Matters and moves to a different Matter", async () => {
    const { ZOHO, onRecordMoved, handleContactDialogClose } = renderDialog();

    fireEvent.click(screen.getByText("Alice"));
    fireEvent.click(screen.getByRole("button", { name: "View Contact Matters" }));

    await waitFor(() => {
      expect(mockFetchContactMatters).toHaveBeenCalledWith({
        ZOHO,
        contactId: "contact-1",
      });
    });
    expect(await screen.findByText(/1 \(Current Matter\)/)).not.toBeNull();
    expect(screen.getByRole("radio", { name: "Select Matter 1" }).disabled).toBe(true);
    expect(screen.getByText("Destination Stakeholder")).not.toBeNull();
    expect(screen.getByText("Consultation scheduled")).not.toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Select Matter 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Move to Selected Matter" }));

    await waitFor(() => {
      expect(mockMoveApplicationHistoryToMatter).toHaveBeenCalledWith({
        ZOHO,
        sourceId: "history-1",
        destinationMatterId: "matter-2",
        destinationContactId: "contact-1",
      });
    });
    await waitFor(() => expect(handleContactDialogClose).toHaveBeenCalled());
    expect(onRecordMoved).toHaveBeenCalledWith("history-1");
  });

  test("clears loaded Matters when another Contact is selected", async () => {
    renderDialog();

    fireEvent.click(screen.getByText("Alice"));
    fireEvent.click(screen.getByRole("button", { name: "View Contact Matters" }));
    await screen.findByText("Select Target Matter:");

    fireEvent.click(screen.getByText("Bob"));

    expect(screen.queryByText("Select Target Matter:")).toBeNull();
    expect(screen.getByRole("button", { name: "Move to Selected Matter" }).disabled).toBe(true);
  });

  test("keeps Contact History as an explicit destination", async () => {
    const { ZOHO, handleContactDialogClose } = renderDialog();

    fireEvent.click(screen.getByText("Alice"));
    fireEvent.click(screen.getByRole("button", { name: "Move to Contact History" }));

    await waitFor(() => {
      expect(mockMoveApplicationHistoryToMain).toHaveBeenCalledWith({
        ZOHO,
        sourceId: "history-1",
        destination: "contact",
        destinationId: "contact-1",
        destinationName: "Alice Adams",
      });
    });
    await waitFor(() => expect(handleContactDialogClose).toHaveBeenCalled());
    expect(mockMoveApplicationHistoryToMatter).not.toHaveBeenCalled();
  });

  test("loads Matters for a Contact found through CRM search", async () => {
    const searchedContact = {
      id: "contact-search",
      First_Name: "Search",
      Last_Name: "Result",
      Full_Name: "Search Result",
      Account_Name: { id: "account-search", name: "Search Stakeholder" },
    };
    const ZOHO = {
      CRM: {
        API: {
          searchRecord: jest.fn().mockResolvedValue({ data: [searchedContact] }),
        },
      },
    };
    renderDialog({ ZOHO });

    fireEvent.click(screen.getByText("Alice"));
    fireEvent.click(screen.getByRole("button", { name: "View Contact Matters" }));
    await screen.findByText("Select Target Matter:");
    fireEvent.click(screen.getByRole("radio", { name: "Select Matter 2" }));
    expect(screen.getByRole("button", { name: "Move to Selected Matter" }).disabled)
      .toBe(false);

    fireEvent.change(screen.getByLabelText("Search Contact"), {
      target: { value: "Search" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(screen.getByRole("button", { name: "Move to Selected Matter" }).disabled)
      .toBe(true);
    expect(screen.queryByText("Select Target Matter:")).toBeNull();
    fireEvent.click(await screen.findByText("Result"));
    expect(screen.queryByText("Alice")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "View Contact Matters" }));

    await waitFor(() => {
      expect(mockFetchContactMatters).toHaveBeenLastCalledWith({
        ZOHO,
        contactId: "contact-search",
      });
    });
    expect(await screen.findByText("Select Target Matter:")).not.toBeNull();
  });

  test("ignores a Contact search response after the dialog is closed", async () => {
    let resolveSearch;
    const searchPromise = new Promise((resolve) => {
      resolveSearch = resolve;
    });
    const ZOHO = {
      CRM: { API: { searchRecord: jest.fn().mockReturnValue(searchPromise) } },
    };
    const { handleContactDialogClose } = renderDialog({ ZOHO });

    fireEvent.change(screen.getByLabelText("Search Contact"), {
      target: { value: "Late" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(screen.queryByText("Alice")).toBeNull();
    expect(screen.getByLabelText("Search Contact").disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Move to Contact History" }).disabled)
      .toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(handleContactDialogClose).toHaveBeenCalled();
    await React.act(async () => {
      resolveSearch({
        data: [{ id: "contact-late", First_Name: "Late", Last_Name: "Result" }],
      });
      await searchPromise;
    });
    expect(screen.queryByText("Late")).toBeNull();
  });
});
