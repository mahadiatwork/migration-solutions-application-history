import { DEFAULT_BILLING_TYPE } from "../components/organisms/dialogConstants";
import {
  APPLICATION_HISTORY_MATTER_FIELDS,
  MATTER_SOURCE_FIELDS,
} from "../config/config";

const normalizeSingleValue = (value) => {
  if (Array.isArray(value)) return normalizeSingleValue(value[0]);
  if (value && typeof value === "object") {
    return String(
      value.actual_value ?? value.display_value ?? value.value ?? value.name ?? ""
    ).trim();
  }
  return value == null ? "" : String(value).trim();
};

export const serializeMatterProgress = (value, dataType) => {
  const selected = normalizeSingleValue(value);
  if (!selected) return null;
  return dataType === "multiselectpicklist" ? [selected] : selected;
};

export const inferMatterProgressFieldType = (history, matter) => {
  const saved = history?.[APPLICATION_HISTORY_MATTER_FIELDS.matterProgress];
  const source = matter?.[MATTER_SOURCE_FIELDS.matterProgress];
  const value = saved != null ? saved : source;
  return Array.isArray(value) ? "multiselectpicklist" : "picklist";
};

/** Keep the Matter's current values separate from the history snapshot. */
export const matterSummaryFromSource = (matter) => ({
  matterNo: normalizeSingleValue(matter?.[MATTER_SOURCE_FIELDS.matterNo]),
  currentStage: normalizeSingleValue(matter?.[MATTER_SOURCE_FIELDS.currentStage]),
  matterProgress: normalizeSingleValue(matter?.[MATTER_SOURCE_FIELDS.matterProgress]),
  billingType: DEFAULT_BILLING_TYPE,
});

/** An existing History record owns any values the user previously changed. */
export const matterSummaryForEdit = (matter, history) => {
  const source = matterSummaryFromSource(matter);
  const fields = APPLICATION_HISTORY_MATTER_FIELDS;
  const savedStage = normalizeSingleValue(history?.[fields.currentStage]);
  const savedProgress = normalizeSingleValue(history?.[fields.matterProgress]);
  const hasSavedSummary = Boolean(
    normalizeSingleValue(history?.[fields.matterNo]) ||
    savedStage ||
    savedProgress
  );
  return {
    matterNo: source.matterNo || normalizeSingleValue(history?.[fields.matterNo]),
    currentStage: hasSavedSummary ? savedStage : source.currentStage,
    matterProgress: hasSavedSummary ? savedProgress : source.matterProgress,
    billingType:
      normalizeSingleValue(history?.[fields.billingType]) || DEFAULT_BILLING_TYPE,
  };
};

export const buildApplicationHistorySummary = (formData, progressFieldType) => {
  const fields = APPLICATION_HISTORY_MATTER_FIELDS;
  return {
    [fields.matterNo]: formData.matterNo || null,
    [fields.currentStage]: formData.currentStage || null,
    [fields.matterProgress]: serializeMatterProgress(
      formData.matterProgress,
      progressFieldType
    ),
    [fields.billingType]: formData.billingType || DEFAULT_BILLING_TYPE,
  };
};

/** The list query is sparse; its rows must not erase saved snapshot fields. */
export const mergeApplicationHistoryRows = (previousRows = [], incomingRows = []) => {
  const previousById = new Map(previousRows.map((row) => [row.id, row]));
  return incomingRows.map((row) => ({
    ...(previousById.get(row.id) || {}),
    ...row,
  }));
};
