import {
  buildApplicationHistorySummary,
  inferMatterProgressFieldType,
  matterSummaryForEdit,
  matterSummaryFromSource,
  mergeApplicationHistoryRows,
} from "./applicationHistorySnapshot";

describe("Application History Matter summary", () => {
  const matter = {
    Name: "MAT-1001",
    Current_Stage: "2. Strategy & Eligibility",
    Matter_Progress: ["Consultation confirmed"],
  };

  test("new history defaults from its Matter with Billable billing", () => {
    expect(matterSummaryFromSource(matter)).toEqual({
      matterNo: "MAT-1001",
      currentStage: "2. Consultation/Strategy & Eligibility",
      matterProgress: "Consultation confirmed",
      billingType: "Billable",
    });
  });

  test("editing preserves saved overrides and keeps the Matter number read only", () => {
    expect(
      matterSummaryForEdit(matter, {
        Matter_No: "old number",
        Current_Stage: "3. Preparation",
        Matter_Progress: ["Drafting"],
        Billing_Type: "Write-Off",
      })
    ).toEqual({
      matterNo: "MAT-1001",
      currentStage: "3. Preparation",
      matterProgress: "Drafting",
      billingType: "Write-Off",
    });
  });

  test("editing preserves an explicitly cleared Stage and Progress", () => {
    expect(
      matterSummaryForEdit(matter, {
        Matter_No: "MAT-1001",
        Current_Stage: null,
        Matter_Progress: null,
      })
    ).toEqual({
      matterNo: "MAT-1001",
      currentStage: "",
      matterProgress: "",
      billingType: "Billable",
    });
    expect(matterSummaryForEdit(matter, {}).currentStage).toBe(
      "2. Consultation/Strategy & Eligibility"
    );
  });

  test("serializes the History fields without changing the source Matter", () => {
    const formData = matterSummaryFromSource(matter);
    expect(buildApplicationHistorySummary(formData, "multiselectpicklist")).toEqual({
      Matter_No: "MAT-1001",
      Current_Stage: "2. Consultation/Strategy & Eligibility",
      Matter_Progress: ["Consultation confirmed"],
      Billing_Type: "Billable",
    });
    expect(buildApplicationHistorySummary(formData, "picklist").Matter_Progress)
      .toBe("Consultation confirmed");
    expect(inferMatterProgressFieldType(null, matter))
      .toBe("multiselectpicklist");
    expect(inferMatterProgressFieldType({ Matter_Progress: "Review" }, matter))
      .toBe("picklist");
    expect(matter.Matter_Progress).toEqual(["Consultation confirmed"]);
  });

  test("normalizes source metadata aliases before saving the History snapshot", () => {
    const summary = matterSummaryFromSource({
      Name: "MAT-1002",
      Current_Stage: {
        actual_value: "4. Preparation",
        display_value: "6. Preparation",
      },
      Matter_Progress: [{
        actual_value: "Internal QA review",
        display_value: "Pre-submission review",
      }],
    });

    expect(summary).toMatchObject({
      currentStage: "6. Preparation",
      matterProgress: "Pre-submission review",
    });
    expect(buildApplicationHistorySummary(summary, "multiselectpicklist"))
      .toMatchObject({
        Current_Stage: "6. Preparation",
        Matter_Progress: ["Pre-submission review"],
      });
  });

  test("a sparse list refresh preserves saved values and explicit clears", () => {
    const previous = [{
      id: "history-1",
      currentStage: "3. Preparation",
      matterProgress: "Drafting",
    }];
    expect(
      mergeApplicationHistoryRows(previous, [{ id: "history-1", details: "New" }])
    ).toEqual([{ ...previous[0], details: "New" }]);
    expect(
      mergeApplicationHistoryRows(previous, [{ id: "history-1", currentStage: "" }])
    ).toEqual([{ ...previous[0], currentStage: "" }]);
  });

  test("a stale related-list response cannot erase a newly created row", () => {
    const optimistic = {
      id: "history-new",
      details: "Created locally",
      _optimistic: true,
    };

    expect(mergeApplicationHistoryRows([optimistic], [])).toEqual([optimistic]);

    expect(
      mergeApplicationHistoryRows([optimistic], [
        { id: "history-new", details: "Returned by Zoho" },
      ])
    ).toEqual([{ id: "history-new", details: "Returned by Zoho" }]);
  });

  test("missing non-optimistic rows are removed by a server refresh", () => {
    expect(
      mergeApplicationHistoryRows([{ id: "history-deleted", details: "Old" }], [])
    ).toEqual([]);
  });
});
