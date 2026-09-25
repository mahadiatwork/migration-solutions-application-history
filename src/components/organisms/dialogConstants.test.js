import {
  DEFAULT_ACTIVITY_TYPE,
  DEFAULT_CATEGORY,
  durationOptions,
  mandatoryActivityTypes,
  mandatoryCategoryOptions,
  serializeDuration,
} from "./dialogConstants";
import { getResultOptions } from "./helperFunc";
import {
  getDurationOptionsFromConfig,
  getTypeOptionsFromConfig,
} from "../../services/picklistConfigService";

describe("matter history category and duration options", () => {
  test("keeps the five required categories first while preserving configured and legacy choices", () => {
    const options = getTypeOptionsFromConfig({
      _source: "custom_module",
      types: ["Configured category", "Meeting", "Other"],
    });

    expect(options.slice(0, 5)).toEqual(mandatoryCategoryOptions);
    expect(options).toContain("Configured category");
    expect(options).toContain("Meeting");
    expect(options.filter((option) => option === "Other")).toHaveLength(1);
    expect(DEFAULT_CATEGORY).toBe(mandatoryCategoryOptions[0]);
    expect(DEFAULT_ACTIVITY_TYPE).toBe(
      mandatoryActivityTypes[DEFAULT_CATEGORY][0]
    );
  });

  test("includes required and configured Activity Types and preserves historical values on edit", () => {
    const config = {
      _source: "custom_module",
      results: { [DEFAULT_CATEGORY]: ["Configured activity", "Call"] },
    };

    expect(getResultOptions(DEFAULT_CATEGORY, config, "Old activity")).toEqual([
      "Call",
      "Email",
      "Meeting",
      "Consultation",
      "Configured activity",
      "Old activity",
    ]);
    expect(getResultOptions("Other", config)).toEqual(
      mandatoryActivityTypes.Other
    );
    expect(getResultOptions("Meeting", config, "Meeting Held")).toEqual([
      "Meeting Held",
    ]);
  });

  test("includes zero and every five-minute choice through 240 while retaining configured extras", () => {
    const options = getDurationOptionsFromConfig({ durations: [60, "0", 300] });

    expect(durationOptions).toHaveLength(49);
    expect(durationOptions[0]).toBe(0);
    expect(durationOptions[48]).toBe(240);
    expect(options).toEqual([...durationOptions, 300]);
    expect(serializeDuration(0)).toBe("0");
    expect(serializeDuration(null)).toBeNull();
  });
});
