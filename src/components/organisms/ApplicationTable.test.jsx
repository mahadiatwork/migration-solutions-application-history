import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ApplicationDialog from "./ApplicationTable";
import { moveApplicationHistoryToMatter } from "../../services/moveApplicationHistory";

jest.mock("../../services/moveApplicationHistory", () => ({
  moveApplicationHistoryToMatter: jest.fn(),
}));

describe("ApplicationDialog Matter move", () => {
  beforeEach(() => {
    moveApplicationHistoryToMatter.mockResolvedValue({
      sourceId: "history-1",
      targetId: "history-1",
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("uses the verified in-place Matter move and reports completion", async () => {
    const handleClose = jest.fn();
    const onRecordMoved = jest.fn();
    const ZOHO = {
      CRM: {
        API: {
          insertRecord: jest.fn(async () => ({
            data: [{ code: "SUCCESS", details: { id: "legacy-target" } }],
          })),
        },
        FUNCTIONS: { execute: jest.fn(async () => ({ code: "success" })) },
      },
    };

    render(
      <ApplicationDialog
        openApplicationDialog
        handleApplicationDialogClose={handleClose}
        applications={[
          { id: "matter-1", Name: "MAT-1" },
          { id: "matter-2", Name: "MAT-2" },
        ]}
        ZOHO={ZOHO}
        selectedRowData={{ id: "history-1" }}
        currentContact={{ id: "contact-1" }}
        historySummary={{ Current_Stage: "Open", Matter_Progress: "Review" }}
        sourceMatterId="matter-1"
        onRecordMoved={onRecordMoved}
      />
    );

    const matterChoices = screen.getAllByRole("radio");
    expect(matterChoices[0]).toBeDisabled();
    fireEvent.click(matterChoices[1]);
    fireEvent.click(screen.getByRole("button", { name: "Move" }));

    await waitFor(() => {
      expect(moveApplicationHistoryToMatter).toHaveBeenCalledWith({
        ZOHO,
        sourceId: "history-1",
        destinationMatterId: "matter-2",
        destinationContactId: "contact-1",
        historySummary: {
          Current_Stage: "Open",
          Matter_Progress: "Review",
        },
      });
      expect(onRecordMoved).toHaveBeenCalledWith("history-1");
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
    expect(ZOHO.CRM.API.insertRecord).not.toHaveBeenCalled();
  });

  test("keeps the dialog open when the verified Matter move fails", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    moveApplicationHistoryToMatter.mockRejectedValueOnce(
      new Error("The History remains on its original Matter.")
    );
    const handleClose = jest.fn();
    const onRecordMoved = jest.fn();

    render(
      <ApplicationDialog
        openApplicationDialog
        handleApplicationDialogClose={handleClose}
        applications={[{ id: "matter-2", Name: "MAT-2" }]}
        ZOHO={{}}
        selectedRowData={{ id: "history-1" }}
        currentContact={{ id: "contact-1" }}
        sourceMatterId="matter-1"
        onRecordMoved={onRecordMoved}
      />
    );

    fireEvent.click(screen.getByRole("radio"));
    fireEvent.click(screen.getByRole("button", { name: "Move" }));

    expect(
      await screen.findByText("The History remains on its original Matter.")
    ).toBeInTheDocument();
    expect(handleClose).not.toHaveBeenCalled();
    expect(onRecordMoved).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
