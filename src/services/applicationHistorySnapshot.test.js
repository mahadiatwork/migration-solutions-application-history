import {
  buildApplicationHistoryMoveSummary,
  buildApplicationHistorySummary,
  hasSavedMatterSummary,
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

  test("editing preserves the saved historical Matter number", () => {
    const displayedSummary = matterSummaryForEdit(
      { ...matter, Name: "A12" },
      {
        Matter_No: "BB1",
        Current_Stage: "3. Preparation",
        Matter_Progress: ["Drafting"],
        Billing_Type: "Write-Off",
      }
    );

    expect(displayedSummary).toEqual({
      matterNo: "BB1",
      currentStage: "3. Preparation",
      matterProgress: "Drafting",
      billingType: "Write-Off",
    });
    expect(
      buildApplicationHistorySummary(displayedSummary, "multiselectpicklist")
    ).toMatchObject({ Matter_No: "BB1" });
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
    expect(hasSavedMatterSummary({})).toBe(false);
    expect(hasSavedMatterSummary({ Matter_No: "MAT-1001" })).toBe(true);
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

  test("does not override a complete CRM summary when the form fields are unchanged", () => {
    expect(
      buildApplicationHistoryMoveSummary(
        {
          currentStage: "6. Preparation",
          matterProgress: "Ready for lodgement",
        },
        "multiselectpicklist",
        { currentStage: false, matterProgress: false }
      )
    ).toEqual({});
  });

  test("moves source Matter fallback values shown for a legacy History", () => {
    const legacyHistory = {
      Current_Stage: "-None-",
      Matter_Progress: ["-None-"],
    };
    const displayedSummary = matterSummaryForEdit(matter, legacyHistory);
    const usesSourceMatterSummary = !hasSavedMatterSummary(legacyHistory);

    expect(usesSourceMatterSummary).toBe(true);

    expect(
      buildApplicationHistoryMoveSummary(
        displayedSummary,
        "multiselectpicklist",
        {
          currentStage: usesSourceMatterSummary,
          matterProgress: usesSourceMatterSummary,
        }
      )
    ).toEqual({
      Current_Stage: "2. Consultation/Strategy & Eligibility",
      Matter_Progress: ["Consultation confirmed"],
    });
  });

  test("includes only the summary fields explicitly edited in the form", () => {
    const formData = {
      currentStage: "6. Preparation",
      matterProgress: "Ready for lodgement",
    };

    expect(
      buildApplicationHistoryMoveSummary(
        formData,
        "multiselectpicklist",
        { currentStage: true, matterProgress: false }
      )
    ).toEqual({ Current_Stage: "6. Preparation" });
    expect(
      buildApplicationHistoryMoveSummary(
        formData,
        "multiselectpicklist",
        { currentStage: false, matterProgress: true }
      )
    ).toEqual({ Matter_Progress: ["Ready for lodgement"] });
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
