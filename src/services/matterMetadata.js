import {
  APPLICATION_HISTORY_MATTER_FIELDS,
  APPLICATION_HISTORY_MODULE,
  conn_name,
  dataCenterMap,
  MATTERS_MODULE,
  MATTER_SOURCE_FIELDS,
} from "../config/config";

const ZOHO = window.ZOHO;

export const normalizePicklistValue = (value) => {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value.map(normalizePicklistValue).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    return String(
      value.actual_value ??
        value.display_value ??
        value.name ??
        value.value ??
        ""
    ).trim();
  }
  return String(value).trim();
};

const uniqueValues = (values = []) => {
  const seen = new Set();
  return values.reduce((result, value) => {
    const normalized = normalizePicklistValue(value);
    if (!normalized || seen.has(normalized)) return result;
    seen.add(normalized);
    result.push(normalized);
    return result;
  }, []);
};

export const isAvailablePicklistValue = (option) => {
  if (!option || typeof option !== "object") return true;
  const type = String(option.type ?? "").toLowerCase();
  return (
    option.active !== false &&
    option.used !== false &&
    !Object.prototype.hasOwnProperty.call(option, "_delete") &&
    type !== "unused" &&
    type !== "inactive"
  );
};

export const extractPicklistOptions = (field) =>
  uniqueValues(
    (field?.pick_list_values || field?.picklist_values || [])
      .filter(isAvailablePicklistValue)
      .map(normalizePicklistValue)
  );

const unwrapInvokeResponse = (response) => {
  const rawStatusMessage = response?.details?.statusMessage;
  if (typeof rawStatusMessage === "string" && rawStatusMessage.trim()) {
    try {
      return JSON.parse(rawStatusMessage);
    } catch {
      // Fall through to other known response shapes.
    }
  }
  if (rawStatusMessage && typeof rawStatusMessage === "object") {
    return rawStatusMessage;
  }
  return response?.details?.data ? response.details : response;
};

export const getInvokeError = (response) => {
  const payload = unwrapInvokeResponse(response) || {};
  const candidates = [payload, payload?.data, response, response?.details].filter(
    (candidate) => candidate && typeof candidate === "object"
  );
  const error = candidates.find(
    (candidate) =>
      candidate.status === "error" ||
      (typeof candidate.code === "string" &&
        candidate.code !== "SUCCESS" &&
        candidate.code !== "200")
  );
  if (!error) return null;
  return {
    code: error.code || "ERROR",
    message: error.message || error.statusMessage || "Request failed",
  };
};

const extractLayouts = (response) => {
  const payload = unwrapInvokeResponse(response) || {};
  if (Array.isArray(payload.layouts)) return payload.layouts;
  if (Array.isArray(payload.data?.layouts)) return payload.data.layouts;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
};

const flattenLayoutFields = (layout) => [
  ...(layout?.fields || []),
  ...(layout?.sections || []).flatMap((section) => section?.fields || []),
];

export const getMatterLayoutId = (matter) => {
  const candidate =
    matter?.$layout_id ?? matter?.Layout ?? matter?.layout ?? matter?.layout_id;
  if (candidate && typeof candidate === "object") {
    return String(candidate.id ?? candidate.ID ?? "") || null;
  }
  return candidate != null && candidate !== "" ? String(candidate) : null;
};

const selectLayout = (layouts, matter) => {
  const recordLayoutId = getMatterLayoutId(matter);
  if (recordLayoutId) {
    const match = layouts.find(
      (layout) => String(layout?.id ?? "") === recordLayoutId
    );
    if (match) return match;
  }
  return layouts.find((layout) => layout?.status !== "deactivated") || layouts[0];
};

const dependencyMapFromValues = (pickListValues = []) => {
  const progressByStage = {};
  pickListValues
    .filter(isAvailablePicklistValue)
    .forEach((stageOption) => {
      const stage = normalizePicklistValue(stageOption);
      if (!stage || !Array.isArray(stageOption?.maps)) return;
      progressByStage[stage] = uniqueValues(
        stageOption.maps
          .filter(isAvailablePicklistValue)
          .map(normalizePicklistValue)
      );
    });

  // An all-empty layout map is not proof that every progress value is forbidden.
  // The v8 map_dependency response remains authoritative in that case.
  return Object.values(progressByStage).some((options) => options.length > 0)
    ? progressByStage
    : {};
};

export const extractMatterLayoutMetadata = (response, matter = null) => {
  const layouts = extractLayouts(response);
  const layout = selectLayout(layouts, matter);
  if (!layout) {
    return {
      layoutId: getMatterLayoutId(matter),
      stages: [],
      progress: [],
      progressByStage: {},
    };
  }
  const fields = flattenLayoutFields(layout);
  const stageField = fields.find(
    (field) => field?.api_name === MATTER_SOURCE_FIELDS.currentStage
  );
  const progressField = fields.find(
    (field) => field?.api_name === MATTER_SOURCE_FIELDS.matterProgress
  );
  const stageValues = stageField?.pick_list_values || stageField?.picklist_values || [];
  return {
    layoutId: String(layout.id ?? getMatterLayoutId(matter) ?? "") || null,
    stages: extractPicklistOptions(stageField),
    progress: extractPicklistOptions(progressField),
    progressByStage: dependencyMapFromValues(stageValues),
  };
};

const extractDependencyEntries = (response) => {
  const payload = unwrapInvokeResponse(response) || {};
  if (Array.isArray(payload.map_dependency)) return payload.map_dependency;
  if (Array.isArray(payload.data?.map_dependency)) {
    return payload.data.map_dependency;
  }
  return [];
};

const isMatterProgressDependency = (dependency) =>
  dependency?.parent?.api_name === MATTER_SOURCE_FIELDS.currentStage &&
  dependency?.child?.api_name === MATTER_SOURCE_FIELDS.matterProgress &&
  dependency?.active !== false;

export const extractMatterDependencyMetadata = (response) => {
  const dependency = extractDependencyEntries(response).find(
    isMatterProgressDependency
  );
  if (!dependency) return { stages: [], progress: [], progressByStage: {} };
  const pickListValues = dependency.pick_list_values || [];
  const progressByStage = dependencyMapFromValues(pickListValues);
  return {
    stages: uniqueValues(
      pickListValues.filter(isAvailablePicklistValue).map(normalizePicklistValue)
    ),
    progress: uniqueValues(Object.values(progressByStage).flat()),
    progressByStage,
  };
};

export const mergeMatterMetadata = (layoutMetadata, dependencyMetadata) => ({
  layoutId: layoutMetadata?.layoutId || null,
  stages: uniqueValues([
    ...(layoutMetadata?.stages || []),
    ...(dependencyMetadata?.stages || []),
  ]),
  progress: uniqueValues([
    ...(layoutMetadata?.progress || []),
    ...(dependencyMetadata?.progress || []),
  ]),
  progressByStage:
    dependencyMetadata &&
    Object.keys(dependencyMetadata.progressByStage || {}).length > 0
      ? dependencyMetadata.progressByStage
      : layoutMetadata?.progressByStage || {},
});

export const withCurrentPicklistValue = (options, currentValue) =>
  uniqueValues([...(options || []), normalizePicklistValue(currentValue)]);

export const getStageOptions = (metadata, currentValue) =>
  withCurrentPicklistValue(metadata?.stages || [], currentValue);

export const getProgressOptions = (metadata, stage, currentValue) => {
  const normalizedStage = normalizePicklistValue(stage);
  const progressByStage = metadata?.progressByStage || {};
  const hasMappedStage = Object.prototype.hasOwnProperty.call(
    progressByStage,
    normalizedStage
  );
  // Keep a stored historical value visible on edit. For a selected stage,
  // only mapped values are available for new selections.
  const baseOptions = normalizedStage
    ? hasMappedStage
      ? progressByStage[normalizedStage]
      : []
    : metadata?.progress || [];
  return withCurrentPicklistValue(baseOptions, currentValue);
};

const invokeSettingsGet = async (url) => {
  if (!ZOHO?.CRM?.CONNECTION?.invoke) return null;
  const response = await ZOHO.CRM.CONNECTION.invoke(conn_name, {
    url,
    method: "GET",
    param_type: 1,
  });
  const requestError = getInvokeError(response);
  if (requestError) {
    throw new Error(`${requestError.code}: ${requestError.message}`);
  }
  return response;
};

const extractFields = (response) => {
  const payload = unwrapInvokeResponse(response) || {};
  if (Array.isArray(payload.fields)) return payload.fields;
  if (Array.isArray(payload.data?.fields)) return payload.data.fields;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
};

export const getApplicationHistoryProgressFieldType = (response) => {
  const progressField = extractFields(response).find(
    (field) =>
      field?.api_name === APPLICATION_HISTORY_MATTER_FIELDS.matterProgress
  );
  return progressField?.data_type
    ? String(progressField.data_type).toLowerCase()
    : null;
};

/** Determine the payload shape required by Applications_History.Matter_Progress. */
export const fetchApplicationHistoryProgressFieldType = async () => {
  if (typeof ZOHO?.CRM?.META?.getFields === "function") {
    try {
      const response = await ZOHO.CRM.META.getFields({
        Entity: APPLICATION_HISTORY_MODULE,
      });
      const dataType = getApplicationHistoryProgressFieldType(response);
      if (dataType) return dataType;
    } catch (error) {
      console.warn("Application History field metadata SDK request failed:", error);
    }
  }

  const response = await invokeSettingsGet(
    `${dataCenterMap.AU}/crm/v8/settings/fields?module=${encodeURIComponent(
      APPLICATION_HISTORY_MODULE
    )}`
  );
  return getApplicationHistoryProgressFieldType(response);
};

const fetchLayouts = async () => {
  if (typeof ZOHO?.CRM?.META?.getLayouts === "function") {
    try {
      const response = await ZOHO.CRM.META.getLayouts({ Entity: MATTERS_MODULE });
      if (extractLayouts(response).length > 0) return response;
    } catch (error) {
      console.warn("Applications layout metadata SDK request failed:", error);
    }
  }
  return invokeSettingsGet(
    `${dataCenterMap.AU}/crm/v8/settings/layouts?module=${encodeURIComponent(
      MATTERS_MODULE
    )}`
  );
};

const fetchMappedDependency = async (layoutId) => {
  if (!layoutId) return null;
  const baseUrl = `${dataCenterMap.AU}/crm/v8/settings/layouts/${encodeURIComponent(
    layoutId
  )}/map_dependency`;
  const moduleQuery = `module=${encodeURIComponent(MATTERS_MODULE)}`;
  const summaryResponse = await invokeSettingsGet(`${baseUrl}?${moduleQuery}`);
  const summary = extractDependencyEntries(summaryResponse).find(
    isMatterProgressDependency
  );
  if (!summary) return summaryResponse;
  if (Array.isArray(summary.pick_list_values)) return summaryResponse;
  if (!summary.id) return summaryResponse;
  return invokeSettingsGet(
    `${baseUrl}/${encodeURIComponent(summary.id)}?${moduleQuery}`
  );
};

/** Read the source Matter's layout and Current Stage -> Matter Progress rules. */
export const fetchMatterPicklistMetadata = async (matter = null) => {
  try {
    const layoutsResponse = await fetchLayouts();
    const layoutMetadata = extractMatterLayoutMetadata(layoutsResponse, matter);
    let dependencyMetadata = {
      stages: [],
      progress: [],
      progressByStage: {},
    };
    let dependencyError = null;
    if (layoutMetadata.layoutId) {
      try {
        const dependencyResponse = await fetchMappedDependency(
          layoutMetadata.layoutId
        );
        dependencyMetadata = extractMatterDependencyMetadata(
          dependencyResponse
        );
      } catch (error) {
        console.warn("Applications map dependency request failed:", error);
        dependencyError = error?.message || "Matter Progress rules could not be loaded.";
      }
    }
    return {
      ...mergeMatterMetadata(layoutMetadata, dependencyMetadata),
      dependencyError,
    };
  } catch (error) {
    console.warn("Could not load Applications picklist metadata:", error);
    return {
      layoutId: null,
      stages: [],
      progress: [],
      progressByStage: {},
      dependencyError: error?.message || "Matter metadata could not be loaded.",
    };
  }
};
