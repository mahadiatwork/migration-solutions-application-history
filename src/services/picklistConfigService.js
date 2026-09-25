/**
 * Loads Type, Result, Regarding, and Duration from Widget_Picklist_Config.
 *
 * Call only after Zoho init. Cache a successful CRM load only
 * (`_source === "custom_module"`). Failed or empty fetches return hard-coded
 * lists for that call and are not cached.
 */
import {
  PICKLIST_CONFIG_MODULE,
  PICKLIST_CONFIG_MODULE_FALLBACK,
  PICKLIST_CONFIG_FIELDS,
  PICKLIST_CATEGORIES,
  dataCenterMap,
  conn_name,
} from "../config/config";
import {
  typeOptions as defaultTypeOptions,
  resultMapping as defaultResultMapping,
  durationOptions as defaultDurationOptions,
  mergeCategoryOptions,
  mergeDurationOptions,
} from "../components/organisms/dialogConstants";

const ZOHO = window.ZOHO;

const MODULE_API_NAMES = [
  PICKLIST_CONFIG_MODULE,
  PICKLIST_CONFIG_MODULE_FALLBACK,
];

let cachedConfig = null;
let inFlight = null;

const _fallbackConfig = () => ({
  types: defaultTypeOptions,
  results: null,
  resultMapping: defaultResultMapping,
  regarding: null,
  durations: defaultDurationOptions,
  _source: "fallback",
});

export const fetchPicklistConfig = async () => {
  if (cachedConfig?._source === "custom_module") return cachedConfig;
  if (inFlight) return inFlight;

  inFlight = _doFetch();
  try {
    const config = await inFlight;
    if (config?._source === "custom_module") {
      cachedConfig = config;
    }
    return config;
  } finally {
    inFlight = null;
  }
};

export const clearPicklistConfigCache = () => {
  cachedConfig = null;
  inFlight = null;
};

const _doFetch = async () => {
  try {
    if (!ZOHO?.CRM) {
      console.warn("Widget_Picklist_Config: ZOHO.CRM is not ready yet.");
      return _fallbackConfig();
    }

    let records = await _fetchViaSdk();
    if (!records.length) {
      records = await _fetchViaCoql();
    }

    const activeRecords = records.filter(_isActive);
    if (!activeRecords.length) {
      console.warn(
        "Widget_Picklist_Config: No active records returned. Using hard-coded defaults."
      );
      return _fallbackConfig();
    }

    console.info(
      `Widget_Picklist_Config: Loaded ${activeRecords.length} option(s) from CRM.`
    );
    return _groupRecords(activeRecords);
  } catch (error) {
    console.warn(
      "Widget_Picklist_Config: fetch failed. Falling back to defaults.",
      error
    );
    return _fallbackConfig();
  }
};

const _fieldValue = (value) => {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "object") {
    return (
      value.display_value ||
      value.actual_value ||
      value.name ||
      value.Name ||
      ""
    );
  }
  return String(value);
};

const _isActive = (record) => {
  const value = record?.[PICKLIST_CONFIG_FIELDS.active];
  return (
    value === true ||
    value === "true" ||
    value === 1 ||
    value === "1" ||
    value === "Yes"
  );
};

const _isInvalidModule = (response) => {
  const code = response?.code || response?.data?.[0]?.code;
  return code === "INVALID_MODULE" || response?.status === "INVALID_MODULE";
};

const _extractRecordArray = (response) => {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
};

const _fetchViaSdk = async () => {
  for (const entity of MODULE_API_NAMES) {
    const records = await _paginateSdk(entity);
    if (records.length) return records;
  }
  return [];
};

const _paginateSdk = async (entity) => {
  const all = [];
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    let response;
    try {
      const params = {
        Entity: entity,
        per_page: perPage,
        page,
        sort_order: "asc",
      };
      if (typeof ZOHO.CRM.API.getAllRecords === "function") {
        response = await ZOHO.CRM.API.getAllRecords(params);
      } else if (typeof ZOHO.CRM.API.getRecords === "function") {
        response = await ZOHO.CRM.API.getRecords(params);
      } else {
        return [];
      }
    } catch (error) {
      const message = `${error?.code || ""} ${error?.message || error || ""}`;
      if (message.includes("INVALID_MODULE") && page === 1) {
        console.warn(`Widget_Picklist_Config SDK INVALID_MODULE for ${entity}`);
        return [];
      }
      console.warn(
        `Widget_Picklist_Config SDK fetch failed for ${entity} page ${page}:`,
        error
      );
      return [];
    }

    if (_isInvalidModule(response)) {
      console.warn(
        `Widget_Picklist_Config SDK INVALID_MODULE for ${entity}:`,
        response
      );
      return [];
    }

    const chunk = _extractRecordArray(response);
    all.push(...chunk);
    const more =
      response?.info?.more_records === true ||
      response?.info?.more_records === "true";
    if (chunk.length < perPage || !more) break;
    page += 1;
  }

  return all;
};

const _parseCoqlResponse = (response) => {
  const details = response?.details || {};
  const rawStatusMessage = details.statusMessage ?? details.statusMessage;
  let parsedStatusMessage = rawStatusMessage;
  if (typeof rawStatusMessage === "string" && rawStatusMessage.trim()) {
    try {
      parsedStatusMessage = JSON.parse(rawStatusMessage);
    } catch {
      parsedStatusMessage = null;
    }
  }

  const candidates = [parsedStatusMessage, details, response].filter(
    (c) => c && typeof c === "object"
  );

  for (const candidate of candidates) {
    if (Array.isArray(candidate.data) && candidate.data.length > 0) {
      return candidate.data;
    }
  }

  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const _fetchViaCoql = async () => {
  const { name, category, parentType, sortOrder, active } =
    PICKLIST_CONFIG_FIELDS;

  if (!ZOHO?.CRM?.CONNECTION?.invoke) return [];

  for (const moduleApiName of MODULE_API_NAMES) {
    const selectQuery = `select ${name}, ${category}, ${parentType}, ${sortOrder}, ${active} from ${moduleApiName} where ${active} = true LIMIT 0, 2000`;
    try {
      const req_data = {
        url: `${dataCenterMap.AU}/crm/v8/coql`,
        method: "POST",
        param_type: 2,
        parameters: { select_query: selectQuery },
      };
      const response = await ZOHO.CRM.CONNECTION.invoke(conn_name, req_data);
      const data = _parseCoqlResponse(response);
      if (data.length) return data;
    } catch (coqlError) {
      console.warn(
        `COQL picklist fetch failed for ${moduleApiName}:`,
        coqlError
      );
    }
  }
  return [];
};

const _pushUnique = (list, value) => {
  if (value && !list.includes(value)) list.push(value);
};

const _groupRecords = (records) => {
  const { name, category, parentType, sortOrder } = PICKLIST_CONFIG_FIELDS;
  const { TYPE, RESULT, REGARDING, DURATION } = PICKLIST_CATEGORIES;

  const types = [];
  const results = {};
  const regarding = {};
  const durations = [];

  const sorted = [...records].sort(
    (a, b) => (Number(a[sortOrder]) || 9999) - (Number(b[sortOrder]) || 9999)
  );

  for (const record of sorted) {
    const cat = _fieldValue(record[category]);
    const value = _fieldValue(record[name]);
    const parent = _fieldValue(record[parentType]) || "_default";

    if (!value) continue;

    switch (cat) {
      case TYPE:
        _pushUnique(types, value);
        break;
      case RESULT:
        if (!results[parent]) results[parent] = [];
        _pushUnique(results[parent], value);
        break;
      case REGARDING:
        if (!regarding[parent]) regarding[parent] = [];
        _pushUnique(regarding[parent], value);
        break;
      case DURATION: {
        const num = parseInt(value, 10);
        if (!Number.isNaN(num) && !durations.includes(num)) durations.push(num);
        break;
      }
      default:
        console.warn(`Unknown picklist category: ${cat} for entry "${value}"`);
    }
  }

  const resultMapping = {};
  for (const [parent, resultList] of Object.entries(results)) {
    if (parent !== "_default" && resultList.length > 0) {
      resultMapping[parent] = resultList[0];
    }
  }

  const fromModule = types.length > 0 || Object.keys(results).length > 0;

  return {
    types: types.length > 0 ? types : defaultTypeOptions,
    results: Object.keys(results).length > 0 ? results : null,
    resultMapping:
      Object.keys(resultMapping).length > 0
        ? resultMapping
        : defaultResultMapping,
    regarding: Object.keys(regarding).length > 0 ? regarding : null,
    durations: durations.length > 0 ? durations : defaultDurationOptions,
    _source: fromModule ? "custom_module" : "fallback",
  };
};

export const getTypeOptionsFromConfig = (config) => {
  if (Array.isArray(config?.types)) {
    return mergeCategoryOptions(config.types);
  }
  return defaultTypeOptions;
};

export const getDurationOptionsFromConfig = (config) => {
  if (Array.isArray(config?.durations)) {
    return mergeDurationOptions(config.durations);
  }
  return defaultDurationOptions;
};

export const getResultMappingFromConfig = (config) => {
  if (config?.resultMapping && Object.keys(config.resultMapping).length > 0) {
    return config.resultMapping;
  }
  return defaultResultMapping;
};
