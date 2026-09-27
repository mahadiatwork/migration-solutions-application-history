import { dataCenterMap, conn_name } from "../config/config";

const ZOHO = window.ZOHO;
const RELATED_LIST_PAGE_SIZE = 200;
const MAX_RELATED_LIST_RECORDS = 2000;

const parseCoqlResponse = (response) => {
  const rawStatusMessage = response?.details?.statusMessage;
  let statusMessage = rawStatusMessage;

  if (typeof rawStatusMessage === "string" && rawStatusMessage.trim()) {
    try {
      statusMessage = JSON.parse(rawStatusMessage);
    } catch {
      throw new Error("COQL returned an unreadable response.");
    }
  }

  const candidates = [statusMessage, response?.details, response].filter(
    (candidate) => candidate && typeof candidate === "object"
  );

  const errorPayload = candidates.find((candidate) => {
    const code = String(candidate?.code || "").toUpperCase();
    return (
      String(candidate?.status || "").toLowerCase() === "error" ||
      (code && code !== "SUCCESS" && code !== "NO_CONTENT")
    );
  });

  if (errorPayload) {
    throw new Error(
      `${errorPayload.code || "COQL_ERROR"}: ${
        errorPayload.message || "Could not load Matter History."
      }`
    );
  }

  for (const candidate of candidates) {
    if (Array.isArray(candidate.data)) return candidate.data;
  }

  const statusCode = Number(
    response?.details?.statusCode ?? response?.statusCode ?? response?.status
  );
  if (statusCode === 204 || response?.statusText === "nocontent") return [];

  throw new Error("COQL returned an unrecognized response.");
};

/**
 * Fetch Applications_History via COQL v8 API (up to 2000 records in one call)
 * @param {string} applicationId - Application record ID (from widget context)
 * @param {number} [limit=2000] - Max records (v8 allows up to 2000)
 * @param {number} [offset=0] - Pagination offset
 * @returns {Promise<Array>} - Array of Applications_History records
 */
export async function fetchApplicationHistoryViaCoqlV8(
  applicationId,
  limit = 2000,
  offset = 0
) {
  // Verified working in Deluge: do NOT include Stakeholder, Owner.name, Owner.id
  const selectQuery = `SELECT Name, id, Date, History_Type, History_Result, Regarding, History_Details, Owner, Duration_Min FROM Applications_History WHERE Application = '${applicationId}' LIMIT ${offset}, ${limit}`;

  const req_data = {
    url: `${dataCenterMap.AU}/crm/v8/coql`,
    method: "POST",
    param_type: 2,
    parameters: { select_query: selectQuery },
  };

  const response = await ZOHO.CRM.CONNECTION.invoke(conn_name, req_data);
  return parseCoqlResponse(response);
}

export async function getRecordsFromRelatedList({
  module,
  recordId,
  RelatedListAPI,
  perPage = RELATED_LIST_PAGE_SIZE,
  maxRecords = MAX_RELATED_LIST_RECORDS,
}) {
  try {
    const records = [];
    const pageSize = Math.min(Math.max(Number(perPage) || 1, 1), 200);
    const recordLimit = Math.max(Number(maxRecords) || pageSize, 1);
    let page = 1;

    while (records.length < recordLimit) {
      const relatedListResp = await ZOHO.CRM.API.getRelatedRecords({
        Entity: module,
        RecordID: recordId,
        RelatedList: RelatedListAPI,
        page,
        per_page: pageSize,
      });

      if (relatedListResp?.statusText === "nocontent") break;

      if (!Array.isArray(relatedListResp?.data)) {
        throw new Error(
          relatedListResp?.message || "Zoho returned an invalid related-list response."
        );
      }

      const pageRecords = relatedListResp.data;
      records.push(...pageRecords.slice(0, recordLimit - records.length));

      const moreRecords = relatedListResp?.info?.more_records;
      if (
        moreRecords === false ||
        pageRecords.length === 0 ||
        pageRecords.length < pageSize
      ) {
        break;
      }

      page += 1;
    }

    return { data: records, error: null };
  } catch (getRecordsFromRelatedListError) {
    console.log({ getRecordsFromRelatedListError });
    return {
      data: null,
      error:
        getRecordsFromRelatedListError?.message ||
        "Could not load records from the related list.",
    };
  }
}

/**
 * Load Matter History from the active CRM environment first. A named OAuth
 * connection can point at production while the widget is open in a sandbox.
 */
export async function fetchApplicationHistory(
  module,
  recordId,
  limit = MAX_RELATED_LIST_RECORDS
) {
  const relatedListResponse = await getRecordsFromRelatedList({
    module,
    recordId,
    RelatedListAPI: "Application_History",
    maxRecords: limit,
  });

  if (!relatedListResponse.error) {
    return relatedListResponse.data || [];
  }

  console.warn(
    "Application History related-list fetch failed; falling back to COQL:",
    relatedListResponse.error
  );
  return fetchApplicationHistoryViaCoqlV8(recordId, limit, 0);
}

export const record = {
  getRecordsFromRelatedList,
  fetchApplicationHistoryViaCoqlV8,
  fetchApplicationHistory,
};
