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

/**
 * The list query is sparse, and newly created records can take a moment to
 * appear in Zoho's related-list response. Preserve only explicitly optimistic
 * rows that the server has not returned yet; ordinary missing rows remain
 * removable so deletes do not linger in the widget.
 */
export const mergeApplicationHistoryRows = (previousRows = [], incomingRows = []) => {
  const rowKey = (row) => (row?.id == null ? null : String(row.id));
  const previousById = new Map(
    previousRows
      .map((row) => [rowKey(row), row])
      .filter(([id]) => id !== null)
  );
  const incomingIds = new Set(
    incomingRows.map(rowKey).filter((id) => id !== null)
  );

  const pendingRows = previousRows.filter((row) => {
    const id = rowKey(row);
    return row?._optimistic === true && id !== null && !incomingIds.has(id);
  });

  const serverRows = incomingRows.map((row) => {
    const merged = {
      ...(previousById.get(rowKey(row)) || {}),
      ...row,
    };
    delete merged._optimistic;
    return merged;
  });

  return [...pendingRows, ...serverRows];
};
