import { dataCenterMap, conn_name } from "../config/config";

const ZOHO = window.ZOHO;

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

  let data = [];
  if (response?.data && Array.isArray(response.data)) {
    data = response.data;
  } else if (response?.details?.data && Array.isArray(response.details.data)) {
    data = response.details.data;
  } else if (response?.details?.statusMessage) {
    const sm = response.details.statusMessage;
    const parsed = typeof sm === "string" ? (() => { try { return JSON.parse(sm || "{}"); } catch { return {}; } })() : sm;
    data = Array.isArray(parsed?.data) ? parsed.data : [];
  }

  return data;
}

export async function getRecordsFromRelatedList({
  module,
  recordId,
  RelatedListAPI,
}) {
  try {
    const relatedListResp = await ZOHO.CRM.API.getRelatedRecords({
      Entity: module,
      RecordID: recordId,
      RelatedList: RelatedListAPI,
    });

    if (relatedListResp.statusText === "nocontent") {
      return { data: [], error: null };
    }

    if (!(relatedListResp.statusText === "nocontent")) {
      return { data: relatedListResp?.data, error: null };
    }
  } catch (getRecordsFromRelatedListError) {
    console.log({ getRecordsFromRelatedListError });
    return { data: null, error: "Something went wrong" };
  }
}

export const record = {
  getRecordsFromRelatedList,
  fetchApplicationHistoryViaCoqlV8,
};
