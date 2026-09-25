/**
 * Loads Type, Result, Regarding, and Duration from Widget_Picklist_Config.
 *
 * Call only after Zoho init. Cache a successful CRM load only
 * (`_source === "custom_module"`). A reached module is authoritative even
 * when it has no active rows; only unavailable/failed fetches use fallbacks.
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

    let fetchResult = await _fetchViaSdk();
    if (!fetchResult.reached) {
      fetchResult = await _fetchViaCoql();
    }

    if (!fetchResult.reached) {
      console.warn(
        "Widget_Picklist_Config: module unavailable. Using hard-coded defaults."
      );
      return _fallbackConfig();
    }

    const activeRecords = fetchResult.records.filter(_isActive);

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

const _responseEntries = (response) => [
  response,
  ...(response?.data &&
  typeof response.data === "object" &&
  !Array.isArray(response.data)
    ? [response.data]
    : []),
  ...(Array.isArray(response?.data) ? response.data : []),
  ...(Array.isArray(response?.data?.data) ? response.data.data : []),
].filter((entry) => entry && typeof entry === "object");

const _isInvalidModule = (response) =>
  _responseEntries(response).some(
    (entry) =>
      entry?.code === "INVALID_MODULE" ||
      entry?.code === "INVALID_MODULE_API_NAME" ||
      entry?.status === "INVALID_MODULE"
  );

const _isErrorResponse = (response) => {
  return _responseEntries(response).some((entry) => {
    const code = typeof entry?.code === "string" ? entry.code : "";
    return (
      entry?.status === "error" ||
      entry?.status === "failure" ||
      Number(entry?.statusCode) >= 400 ||
      (code !== "" &&
        code !== "SUCCESS" &&
        code !== "NO_DATA" &&
        code !== "NO_CONTENT" &&
        code !== "200")
    );
  });
};

const _isSuccessfulEmptyResponse = (response) =>
  _responseEntries(response).some(
    (entry) => entry?.code === "NO_DATA" || entry?.code === "NO_CONTENT"
  );

const _hasRecordPayload = (response) =>
  Array.isArray(response?.data) ||
  Array.isArray(response) ||
  Array.isArray(response?.data?.data);

const _extractRecordArray = (response) => {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
};

const _fetchViaSdk = async () => {
  for (const entity of MODULE_API_NAMES) {
    const result = await _paginateSdk(entity);
    if (result.reached) return result;
  }
  return { records: [], reached: false };
};

const _paginateSdk = async (entity) => {
  const all = [];
  let page = 1;
  const perPage = 200;
  const seenPageSignatures = new Set();

  while (true) {
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
        return { records: [], reached: false };
      }
    } catch (error) {
      const message = `${error?.code || ""} ${error?.message || error || ""}`;
      if (message.includes("INVALID_MODULE") && page === 1) {
        console.warn(`Widget_Picklist_Config SDK INVALID_MODULE for ${entity}`);
        return { records: [], reached: false };
      }
      console.warn(
        `Widget_Picklist_Config SDK fetch failed for ${entity} page ${page}:`,
        error
      );
      return { records: [], reached: false };
    }

    if (_isInvalidModule(response)) {
      console.warn(
        `Widget_Picklist_Config SDK INVALID_MODULE for ${entity}:`,
        response
      );
      return { records: [], reached: false };
    }
    if (_isSuccessfulEmptyResponse(response)) {
      return { records: all, reached: true };
    }
    if (_isErrorResponse(response)) {
      console.warn(
        `Widget_Picklist_Config SDK fetch failed for ${entity} page ${page}:`,
        response
      );
      return { records: [], reached: false };
    }
    if (!_hasRecordPayload(response)) {
      return { records: [], reached: false };
    }

    const chunk = _extractRecordArray(response);
    const more =
      response?.info?.more_records === true ||
      response?.info?.more_records === "true" ||
      response?.data?.info?.more_records === true ||
      response?.data?.info?.more_records === "true";
    const pageSignature = JSON.stringify(chunk);
    if (more && (chunk.length === 0 || seenPageSignatures.has(pageSignature))) {
      console.warn(
        `Widget_Picklist_Config SDK pagination made no progress for ${entity} page ${page}.`
      );
      return { records: [], reached: false };
    }
    seenPageSignatures.add(pageSignature);
    all.push(...chunk);
    if (!more) break;
    page += 1;
  }

  return { records: all, reached: true };
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
    if (Array.isArray(candidate.data)) {
      return candidate.data;
    }
  }

  if (Array.isArray(response?.data)) return response.data;
  return null;
};

const _hasCoqlError = (response) => {
  const rawStatusMessage = response?.details?.statusMessage;
  let parsedStatusMessage = rawStatusMessage;
  if (typeof rawStatusMessage === "string" && rawStatusMessage.trim()) {
    try {
      parsedStatusMessage = JSON.parse(rawStatusMessage);
    } catch {
      parsedStatusMessage = null;
    }
  }
  const candidates = [
    response,
    response?.data,
    response?.details,
    parsedStatusMessage,
    ...(Array.isArray(parsedStatusMessage?.data)
      ? parsedStatusMessage.data
      : []),
    ...(Array.isArray(response?.data) ? response.data : []),
  ].filter((candidate) => candidate && typeof candidate === "object");
  return candidates.some((candidate) => {
    const code = candidate.code;
    return (
      candidate.status === "error" ||
      candidate.status === "failure" ||
      Number(candidate.statusCode) >= 400 ||
      (typeof code === "string" &&
        code !== "SUCCESS" &&
        code !== "NO_DATA" &&
        code !== "NO_CONTENT" &&
        code !== "200")
    );
  });
};

const _hasSuccessfulEmptyCoqlResponse = (response) => {
  const rawStatusMessage = response?.details?.statusMessage;
  let parsedStatusMessage = rawStatusMessage;
  if (typeof rawStatusMessage === "string" && rawStatusMessage.trim()) {
    try {
      parsedStatusMessage = JSON.parse(rawStatusMessage);
    } catch {
      parsedStatusMessage = null;
    }
  }
  const candidates = [
    response,
    response?.data,
    response?.details,
    parsedStatusMessage,
    ...(Array.isArray(response?.data) ? response.data : []),
    ...(Array.isArray(parsedStatusMessage?.data)
      ? parsedStatusMessage.data
      : []),
  ].filter((candidate) => candidate && typeof candidate === "object");
  return candidates.some(
    (candidate) =>
      candidate?.code === "NO_DATA" || candidate?.code === "NO_CONTENT"
  );
};

const _coqlMoreRecords = (response) => {
  const rawStatusMessage = response?.details?.statusMessage;
  let parsedStatusMessage = rawStatusMessage;
  if (typeof rawStatusMessage === "string" && rawStatusMessage.trim()) {
    try {
      parsedStatusMessage = JSON.parse(rawStatusMessage);
    } catch {
      parsedStatusMessage = null;
    }
  }

  const candidates = [
    parsedStatusMessage,
    response?.details,
    response,
  ].filter((candidate) => candidate && typeof candidate === "object");

  for (const candidate of candidates) {
    const value = candidate?.info?.more_records;
    if (value === true || value === "true" || value === 1 || value === "1") {
      return true;
    }
    if (
      value === false ||
      value === "false" ||
      value === 0 ||
      value === "0"
    ) {
      return false;
    }
  }
  return null;
};

const _fetchViaCoql = async () => {
  const { name, category, parentType, sortOrder, active } =
    PICKLIST_CONFIG_FIELDS;
  const pageSize = 2000;

  if (!ZOHO?.CRM?.CONNECTION?.invoke) {
    return { records: [], reached: false };
  }

  for (const moduleApiName of MODULE_API_NAMES) {
    const all = [];
    const seenPageSignatures = new Set();
    let offset = 0;

    while (true) {
      const selectQuery = `select ${name}, ${category}, ${parentType}, ${sortOrder}, ${active} from ${moduleApiName} where ${active} = true order by ${sortOrder} asc LIMIT ${offset}, ${pageSize}`;
      try {
        const req_data = {
          url: `${dataCenterMap.AU}/crm/v8/coql`,
          method: "POST",
          param_type: 2,
          parameters: { select_query: selectQuery },
        };
        const response = await ZOHO.CRM.CONNECTION.invoke(conn_name, req_data);
        if (_isInvalidModule(response)) break;
        if (_hasSuccessfulEmptyCoqlResponse(response)) {
          return { records: all, reached: true };
        }
        if (_isErrorResponse(response) || _hasCoqlError(response)) break;
        const data = _parseCoqlResponse(response);
        if (data === null) break;
        const moreRecords = _coqlMoreRecords(response);
        if (data.length === 0) {
          if (moreRecords === true) {
            console.warn(
              `Widget_Picklist_Config COQL pagination made no progress for ${moduleApiName} at offset ${offset}.`
            );
            break;
          }
          return { records: all, reached: true };
        }

        const pageSignature = JSON.stringify(data);
        if (seenPageSignatures.has(pageSignature)) {
          console.warn(
            `Widget_Picklist_Config COQL pagination made no progress for ${moduleApiName} at offset ${offset}.`
          );
          break;
        }
        seenPageSignatures.add(pageSignature);
        all.push(...data);
        if (
          moreRecords === false ||
          (moreRecords !== true && data.length < pageSize)
        ) {
          return { records: all, reached: true };
        }
        offset += data.length;
      } catch (coqlError) {
        console.warn(
          `COQL picklist fetch failed for ${moduleApiName}:`,
          coqlError
        );
        break;
      }
    }
  }
  return { records: [], reached: false };
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
    const cat = _fieldValue(record[category]).trim();
    const value = _fieldValue(record[name]);
    const parent = _fieldValue(record[parentType]) || "_default";

    if (!value) continue;

    const categoryMatches = (aliases) =>
      aliases.some((alias) => alias.toLowerCase() === cat.toLowerCase());

    if (categoryMatches(TYPE)) {
      _pushUnique(types, value);
    } else if (categoryMatches(RESULT)) {
      if (!results[parent]) results[parent] = [];
      _pushUnique(results[parent], value);
    } else if (categoryMatches(REGARDING)) {
      if (!regarding[parent]) regarding[parent] = [];
      _pushUnique(regarding[parent], value);
    } else if (categoryMatches(DURATION)) {
      const num = parseInt(value, 10);
      if (!Number.isNaN(num) && !durations.includes(num)) durations.push(num);
    } else {
      console.warn(`Unknown picklist category: ${cat} for entry "${value}"`);
    }
  }

  const resultMapping = {};
  for (const [parent, resultList] of Object.entries(results)) {
    if (parent !== "_default" && resultList.length > 0) {
      resultMapping[parent] = resultList[0];
    }
  }

  return {
    types,
    results,
    resultMapping,
    regarding,
    durations,
    _source: "custom_module",
  };
};

export const getTypeOptionsFromConfig = (config) => {
  if (config?._source === "custom_module") {
    return Array.isArray(config.types) ? config.types : [];
  }
  return defaultTypeOptions;
};

export const getDurationOptionsFromConfig = (config) => {
  if (config?._source === "custom_module") {
    return Array.isArray(config.durations) ? config.durations : [];
  }
  return defaultDurationOptions;
};

export const getResultMappingFromConfig = (config) => {
  if (config?._source === "custom_module") {
    return config.resultMapping || {};
  }
  return defaultResultMapping;
};
