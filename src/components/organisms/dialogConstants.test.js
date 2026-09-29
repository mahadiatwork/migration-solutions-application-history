import {
  DEFAULT_ACTIVITY_TYPE,
  DEFAULT_CATEGORY,
  durationOptions,
  getMatterHistoryCreateDefaults,
  mandatoryActivityTypes,
  mandatoryCategoryOptions,
  serializeDuration,
} from "./dialogConstants";
import {
  getRegardingOptions,
  getResultOptions,
} from "./helperFunc";
import {
  getDurationOptionsFromConfig,
  getTypeOptionsFromConfig,
} from "../../services/picklistConfigService";

describe("matter history category and duration options", () => {
  test("uses only configured categories when the custom module is available", () => {
    const options = getTypeOptionsFromConfig({
      _source: "custom_module",
      types: ["Configured category", "Meeting", "Other"],
    });

    expect(options).toEqual(["Configured category", "Meeting", "Other"]);
    expect(DEFAULT_CATEGORY).toBe(mandatoryCategoryOptions[0]);
    expect(DEFAULT_ACTIVITY_TYPE).toBe(
      mandatoryActivityTypes[DEFAULT_CATEGORY][0]
    );
  });

  test("create defaults use the canonical category and activity regardless of option order", () => {
    const config = {
      _source: "custom_module",
      results: {
        Fruit: ["Apple"],
        [DEFAULT_CATEGORY]: ["Email", DEFAULT_ACTIVITY_TYPE],
      },
      regarding: {
        Apple: ["Pear"],
      },
    };

    expect(
      getMatterHistoryCreateDefaults(
        ["Fruit", DEFAULT_CATEGORY],
        (type) => getResultOptions(type, config)
      )
    ).toEqual({
      type: DEFAULT_CATEGORY,
      result: DEFAULT_ACTIVITY_TYPE,
      regarding: "",
    });
  });

  test("create defaults never promote Fruit, Apple, or Pear", () => {
    const config = {
      _source: "custom_module",
      results: { Fruit: ["Apple"] },
      regarding: { Apple: ["Pear"] },
    };
    const getResults = jest.fn((type) => getResultOptions(type, config));

    expect(getMatterHistoryCreateDefaults(["Fruit"], getResults)).toEqual({
      type: "",
      result: "",
      regarding: "",
    });
    expect(getResults).not.toHaveBeenCalled();
  });

  test("create defaults leave activity blank when Call is unavailable", () => {
    expect(
      getMatterHistoryCreateDefaults(
        [DEFAULT_CATEGORY],
        () => ["Apple"]
      )
    ).toEqual({
      type: DEFAULT_CATEGORY,
      result: "",
      regarding: "",
    });
  });

  test("uses exact-parent then default configured results and only preserves an explicitly supplied edit value", () => {
    const config = {
      _source: "custom_module",
      results: {
        [DEFAULT_CATEGORY]: ["Configured activity", "Call"],
        _default: ["Default activity"],
      },
    };

    expect(getResultOptions(DEFAULT_CATEGORY, config)).toEqual([
      "Configured activity",
      "Call",
    ]);
    expect(getResultOptions("Missing", config)).toEqual(["Default activity"]);
    expect(
      getResultOptions(DEFAULT_CATEGORY, {
        _source: "custom_module",
        results: {
          [DEFAULT_CATEGORY]: [],
          _default: ["Must not leak into an explicit empty parent"],
        },
      })
    ).toEqual([]);
    expect(getResultOptions(DEFAULT_CATEGORY, config, "Old activity")).toEqual([
      "Configured activity",
      "Call",
      "Old activity",
    ]);
    expect(
      getResultOptions("Missing", { _source: "custom_module", results: {} })
    ).toEqual([]);
  });

  test("uses only configured durations when the custom module is available", () => {
    const options = getDurationOptionsFromConfig({ durations: [60, "0", 300] });

    expect(durationOptions).toHaveLength(49);
    expect(durationOptions[0]).toBe(0);
    expect(durationOptions[48]).toBe(240);
    expect(options).toEqual(durationOptions);
    expect(
      getDurationOptionsFromConfig({
        _source: "custom_module",
        durations: [60, 0, 300],
      })
    ).toEqual([60, 0, 300]);
    expect(serializeDuration(0)).toBe("0");
    expect(serializeDuration(null)).toBeNull();
  });

  test("uses exact-parent then default configured regarding values and otherwise stays empty", () => {
    const config = {
      _source: "custom_module",
      regarding: {
        Meeting: ["Agenda"],
        _default: ["General configured"],
      },
    };

    expect(getRegardingOptions("Meeting", undefined, config)).toEqual([
      "Agenda",
    ]);
    expect(getRegardingOptions("Call", undefined, config)).toEqual([
      "General configured",
    ]);
    expect(
      getRegardingOptions("Meeting", undefined, {
        _source: "custom_module",
        regarding: {
          Meeting: [],
          _default: ["Must not leak into an explicit empty parent"],
        },
      })
    ).toEqual([]);
    expect(
      getRegardingOptions(
        "Call",
        undefined,
        { _source: "custom_module", regarding: {} }
      )
    ).toEqual([]);
    expect(getRegardingOptions("Meeting", "Old regarding", config)).toEqual([
      "Agenda",
      "Old regarding",
    ]);
  });

  test("removes reserved Custom values while preserving configured Other", () => {
    const config = {
      _source: "custom_module",
      regarding: {
        Call: ["Custom", "Other", "__custom_regarding__"],
      },
    };

    expect(getRegardingOptions("Call", "Custom", config)).toEqual(["Other"]);
  });
});
