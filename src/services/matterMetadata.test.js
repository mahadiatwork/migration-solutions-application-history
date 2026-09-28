import {
  extractMatterDependencyMetadata,
  extractMatterLayoutMetadata,
  FALLBACK_MATTER_PROGRESS_BY_STAGE,
  getFallbackProgressOptions,
  getApplicationHistoryProgressFieldType,
  getInvokeError,
  getProgressOptions,
  getStageOptions,
  hasValidatedFallbackSignature,
  mergeMatterMetadata,
  normalizePicklistValue,
} from "./matterMetadata";

const layoutResponse = {
  layouts: [
    {
      id: "layout-1",
      sections: [
        {
          fields: [
            {
              api_name: "Current_Stage",
              pick_list_values: [
                {
                  actual_value: "Open",
                  type: "used",
                  maps: [
                    { actual_value: "Collecting", type: "used" },
                    { actual_value: "Hidden progress", type: "unused" },
                  ],
                },
                { actual_value: "Closed", type: "used", maps: [] },
                { actual_value: "Retired stage", type: "unused", maps: [] },
              ],
            },
            {
              api_name: "Matter_Progress",
              pick_list_values: [
                { actual_value: "Collecting", type: "used" },
                { actual_value: "Lodged", type: "used" },
                { actual_value: "Hidden progress", type: "unused" },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("Application History Matter metadata", () => {
  test("selects the source Matter layout and excludes inactive options", () => {
    const metadata = extractMatterLayoutMetadata(layoutResponse, {
      $layout_id: { id: "layout-1" },
    });
    expect(metadata).toEqual({
      layoutId: "layout-1",
      stages: ["Open", "Closed"],
      progress: ["Collecting", "Lodged"],
      progressByStage: { Open: ["Collecting"], Closed: [] },
    });
  });

  test("uses CRM display values and canonicalizes legacy source values", () => {
    const response = {
      layouts: [{
        id: "layout-1",
        fields: [
          {
            api_name: "Current_Stage",
            pick_list_values: [
              { actual_value: "-None-", display_value: "-None-", type: "used", maps: [] },
              {
                actual_value: "4. Preparation",
                display_value: "6. Preparation",
                type: "used",
                maps: [{
                  actual_value: "Internal QA review",
                  display_value: "Pre-submission review",
                  type: "used",
                }],
              },
            ],
          },
          {
            api_name: "Matter_Progress",
            pick_list_values: [{
              actual_value: "Internal QA review",
              display_value: "Pre-submission review",
              type: "used",
            }],
          },
        ],
      }],
    };

    const metadata = extractMatterLayoutMetadata(response);
    expect(metadata.stages).toEqual(["6. Preparation"]);
    expect(metadata.progress).toEqual(["Pre-submission review"]);
    expect(metadata.progressByStage).toEqual({
      "6. Preparation": ["Pre-submission review"],
    });
    expect(normalizePicklistValue("7. Decision")).toBe("8. Decision");
    expect(getProgressOptions(metadata, "6. Preparation")).toEqual([
      "Pre-submission review",
    ]);
  });

  test("does not interpret empty layout maps as a restrictive dependency", () => {
    const response = JSON.parse(JSON.stringify(layoutResponse));
    response.layouts[0].sections[0].fields[0].pick_list_values[0].maps = [];
    expect(extractMatterLayoutMetadata(response).progressByStage).toEqual({});
  });

  test("uses the v8 dependency and limits progress to the selected stage", () => {
    const response = {
      details: {
        statusMessage: JSON.stringify({
          map_dependency: [
            {
              active: true,
              parent: { api_name: "Current_Stage" },
              child: { api_name: "Matter_Progress" },
              pick_list_values: [
                {
                  actual_value: "Open",
                  type: "used",
                  maps: [
                    { actual_value: "Collecting", type: "used" },
                    { actual_value: "Retired", type: "unused" },
                  ],
                },
                { actual_value: "Closed", type: "used", maps: [] },
              ],
            },
          ],
        }),
      },
    };
    const metadata = mergeMatterMetadata(
      extractMatterLayoutMetadata(layoutResponse),
      extractMatterDependencyMetadata(response)
    );
    expect(getProgressOptions(metadata, "Open")).toEqual(["Collecting"]);
    expect(getProgressOptions(metadata, "Closed")).toEqual([]);
    expect(getProgressOptions(metadata, "Unknown stage")).toEqual([]);
  });

  test("keeps authoritative empty dependency maps restrictive", () => {
    const metadata = extractMatterDependencyMetadata({
      map_dependency: [{
        active: true,
        parent: { api_name: "Current_Stage" },
        child: { api_name: "Matter_Progress" },
        pick_list_values: [
          { actual_value: "Open", maps: [] },
          { actual_value: "Closed", maps: [] },
        ],
      }],
    });

    expect(metadata.progressByStage).toEqual({ Open: [], Closed: [] });
    expect(getProgressOptions(metadata, "Open")).toEqual([]);
  });

  test("keeps stored historical values visible during edit", () => {
    const metadata = extractMatterLayoutMetadata(layoutResponse);
    expect(getStageOptions(metadata, "Historic stage")).toEqual([
      "Open",
      "Closed",
      "Historic stage",
    ]);
    expect(getProgressOptions(metadata, "Closed", "Historic progress")).toEqual([
      "Historic progress",
    ]);
    expect(getProgressOptions(metadata, "", "Historic progress")).toEqual([
      "Historic progress",
    ]);
  });

  test("uses the approved stage mapping when dependency rules are unavailable", () => {
    const allProgress = Object.values(FALLBACK_MATTER_PROGRESS_BY_STAGE).flat();
    const metadata = {
      stages: Object.keys(FALLBACK_MATTER_PROGRESS_BY_STAGE),
      progress: allProgress,
      progressByStage: {},
      dependencyError: "OAUTH_SCOPE_MISMATCH: invalid oauth scope",
    };

    expect(getProgressOptions(metadata, "4. File Allocation")).toEqual([
      "File ready for allocation",
      "Assigned to advisor",
      "Awaiting work commencement",
    ]);
    expect(getProgressOptions(metadata, "Open")).toEqual([]);
    expect(getProgressOptions(metadata, "")).toEqual([]);
    expect(hasValidatedFallbackSignature(metadata)).toBe(true);
    expect(hasValidatedFallbackSignature({
      ...metadata,
      progress: metadata.progress.slice(1),
    })).toBe(false);
  });

  test("live dependency rules override the validated fallback", () => {
    const metadata = {
      stages: Object.keys(FALLBACK_MATTER_PROGRESS_BY_STAGE),
      progress: Object.values(FALLBACK_MATTER_PROGRESS_BY_STAGE).flat(),
      progressByStage: { "4. File Allocation": ["Live configured value"] },
      dependencyError: "A stale fetch error that should not override live rules",
    };

    expect(getProgressOptions(metadata, "4. File Allocation")).toEqual([
      "Live configured value",
    ]);
  });

  test("fallback covers all active Matter Progress values and legacy stage names", () => {
    const allProgress = Object.values(FALLBACK_MATTER_PROGRESS_BY_STAGE).flat();
    expect(allProgress).toHaveLength(62);
    expect(new Set(allProgress)).toHaveProperty("size", 62);
    expect(getFallbackProgressOptions("1. Intake & Engagement"))
      .toEqual(FALLBACK_MATTER_PROGRESS_BY_STAGE["1. Enquiry"]);
    expect(getFallbackProgressOptions("6. Post-Lodgement / Processing"))
      .toEqual(FALLBACK_MATTER_PROGRESS_BY_STAGE["7. Lodgement & Processing"]);
    expect(getFallbackProgressOptions("7. Decision"))
      .toEqual(FALLBACK_MATTER_PROGRESS_BY_STAGE["8. Decision"]);
  });

  test("surfaces connection scope errors", () => {
    expect(
      getInvokeError({
        details: {
          statusMessage: JSON.stringify({
            code: "OAUTH_SCOPE_MISMATCH",
            message: "invalid oauth scope",
            status: "error",
          }),
        },
      })
    ).toEqual({
      code: "OAUTH_SCOPE_MISMATCH",
      message: "invalid oauth scope",
    });
  });

  test("uses layout dependency rules without requesting a separate scope", async () => {
    const previousZoho = window.ZOHO;
    const invoke = jest.fn();
    window.ZOHO = {
      CRM: {
        META: { getLayouts: jest.fn().mockResolvedValue(layoutResponse) },
        CONNECTION: { invoke },
      },
    };
    try {
      let fetchMatterPicklistMetadata;
      jest.isolateModules(() => {
        ({ fetchMatterPicklistMetadata } = require("./matterMetadata"));
      });

      const metadata = await fetchMatterPicklistMetadata({
        $layout_id: { id: "layout-1" },
      });
      expect(metadata.progressByStage).toEqual({
        Open: ["Collecting"],
        Closed: [],
      });
      expect(metadata.dependencyError).toBeNull();
      expect(invoke).not.toHaveBeenCalled();
    } finally {
      window.ZOHO = previousZoho;
    }
  });

  test("requests authoritative rules when any stage lacks an explicit map", async () => {
    const previousZoho = window.ZOHO;
    const response = JSON.parse(JSON.stringify(layoutResponse));
    delete response.layouts[0].sections[0].fields[0].pick_list_values[1].maps;
    const invoke = jest.fn().mockResolvedValue({
      map_dependency: [
        {
          active: true,
          parent: { api_name: "Current_Stage" },
          child: { api_name: "Matter_Progress" },
          pick_list_values: [
            { actual_value: "Open", maps: [{ actual_value: "Authoritative" }] },
            { actual_value: "Closed", maps: [{ actual_value: "Archived" }] },
          ],
        },
      ],
    });
    window.ZOHO = {
      CRM: {
        META: { getLayouts: jest.fn().mockResolvedValue(response) },
        CONNECTION: { invoke },
      },
    };
    try {
      let fetchMatterPicklistMetadata;
      jest.isolateModules(() => {
        ({ fetchMatterPicklistMetadata } = require("./matterMetadata"));
      });

      const metadata = await fetchMatterPicklistMetadata({
        $layout_id: { id: "layout-1" },
      });
      expect(invoke).toHaveBeenCalledTimes(1);
      expect(metadata.progressByStage).toEqual({
        Open: ["Authoritative"],
        Closed: ["Archived"],
      });
      expect(metadata.dependencyError).toBeNull();
    } finally {
      window.ZOHO = previousZoho;
    }
  });

  test("fetches dependency detail when the summary omits mapped values", async () => {
    const previousZoho = window.ZOHO;
    const response = JSON.parse(JSON.stringify(layoutResponse));
    delete response.layouts[0].sections[0].fields[0].pick_list_values[1].maps;
    const dependency = {
      active: true,
      parent: { api_name: "Current_Stage" },
      child: { api_name: "Matter_Progress" },
    };
    const invoke = jest.fn()
      .mockResolvedValueOnce({
        map_dependency: [{ ...dependency, id: "dependency-1", pick_list_values: [] }],
      })
      .mockResolvedValueOnce({
        map_dependency: [{
          ...dependency,
          id: "dependency-1",
          pick_list_values: [
            { actual_value: "Open", maps: [{ actual_value: "Detailed value" }] },
            { actual_value: "Closed", maps: [] },
          ],
        }],
      });
    window.ZOHO = {
      CRM: {
        META: { getLayouts: jest.fn().mockResolvedValue(response) },
        CONNECTION: { invoke },
      },
    };
    try {
      let fetchMatterPicklistMetadata;
      jest.isolateModules(() => {
        ({ fetchMatterPicklistMetadata } = require("./matterMetadata"));
      });

      const metadata = await fetchMatterPicklistMetadata({
        $layout_id: { id: "layout-1" },
      });
      expect(invoke).toHaveBeenCalledTimes(2);
      expect(metadata.progressByStage).toEqual({
        Open: ["Detailed value"],
        Closed: [],
      });
      expect(metadata.dependencyError).toBeNull();
    } finally {
      window.ZOHO = previousZoho;
    }
  });

  test("reports a missing dependency scope when layout rules are absent", async () => {
    const previousZoho = window.ZOHO;
    const response = JSON.parse(JSON.stringify(layoutResponse));
    response.layouts[0].sections[0].fields[0].pick_list_values[0].maps = [];
    const invoke = jest.fn().mockResolvedValue({
      details: {
        statusMessage: JSON.stringify({
          code: "OAUTH_SCOPE_MISMATCH",
          message: "invalid oauth scope",
          status: "error",
        }),
      },
    });
    window.ZOHO = {
      CRM: {
        META: { getLayouts: jest.fn().mockResolvedValue(response) },
        CONNECTION: { invoke },
      },
    };
    try {
      let fetchMatterPicklistMetadata;
      jest.isolateModules(() => {
        ({ fetchMatterPicklistMetadata } = require("./matterMetadata"));
      });

      const metadata = await fetchMatterPicklistMetadata({
        $layout_id: { id: "layout-1" },
      });
      expect(metadata.progressByStage).toEqual({});
      expect(metadata.dependencyError).toBe(
        "OAUTH_SCOPE_MISMATCH: invalid oauth scope"
      );
      expect(getProgressOptions(metadata, "Open")).toEqual([]);
      expect(invoke).toHaveBeenCalledTimes(1);
    } finally {
      window.ZOHO = previousZoho;
    }
  });

  test("reads the target History field type from Zoho metadata wrappers", () => {
    expect(
      getApplicationHistoryProgressFieldType({
        details: {
          statusMessage: JSON.stringify({
            fields: [
              { api_name: "Current_Stage", data_type: "picklist" },
              { api_name: "Matter_Progress", data_type: "multiselectpicklist" },
            ],
          }),
        },
      })
    ).toBe("multiselectpicklist");
  });
});
