import {
  extractMatterDependencyMetadata,
  extractMatterLayoutMetadata,
  getApplicationHistoryProgressFieldType,
  getInvokeError,
  getProgressOptions,
  getStageOptions,
  mergeMatterMetadata,
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
      "Collecting",
      "Lodged",
      "Historic progress",
    ]);
  });

  test("uses all progress values when dependency rules are unavailable", () => {
    const metadata = {
      stages: ["Open", "Closed"],
      progress: ["Collecting", "Lodged"],
      progressByStage: {},
      dependencyError: "OAUTH_SCOPE_MISMATCH: invalid oauth scope",
    };

    expect(getProgressOptions(metadata, "Open")).toEqual([
      "Collecting",
      "Lodged",
    ]);
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
      expect(getProgressOptions(metadata, "Open")).toEqual([
        "Collecting",
        "Lodged",
      ]);
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
