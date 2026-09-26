import axios from "axios";
import {
  conn_name,
  dataCenterMap,
  access_token_api_url,
  access_token_url,
} from "../config/config";

const ZOHO = window.ZOHO;
const ATTACHMENTS_PER_PAGE = 200;
const MAX_ATTACHMENT_PAGES = 100;

async function uploadAttachment({ module, recordId, data }) {
  try {
    if (!data || !(data instanceof File)) {
      return {
        data: null,
        error: "Invalid file data. Expected File object.",
      };
    }

    const uploadAttachmentResp = await ZOHO.CRM.API.attachFile({
      Entity: module,
      RecordID: recordId,
      File: { Name: data.name, Content: data },
    });

    if (uploadAttachmentResp?.data?.[0]?.code === "SUCCESS") {
      return {
        data: uploadAttachmentResp.data,
        error: null,
      };
    } else {
      return {
        data: null,
        error: uploadAttachmentResp?.data?.[0]?.details?.message || "Failed to upload attachment",
      };
    }
  } catch (uploadFileError) {
    console.error("Upload attachment error:", uploadFileError);
    return {
      data: null,
      error: uploadFileError?.message || "Something went wrong",
    };
  }
}

export function parseAttachmentListResponse(response, strict = false) {
  const details = response?.details;
  const rawStatus = details?.statusMessage;
  let status = rawStatus;
  if (typeof rawStatus === "string" && rawStatus.trim()) {
    try {
      status = JSON.parse(rawStatus);
    } catch {
      status = rawStatus;
    }
  }

  const candidates = [status, details, response].filter(
    (value) => value && typeof value === "object"
  );
  const failure = candidates.find((value) =>
    Number(value.statusCode) >= 400 ||
    (value.code && !["SUCCESS", "NO_CONTENT", "200", "204"].includes(String(value.code))) ||
    value.status === "error"
  );
  if (failure) {
    return { data: null, error: failure.message || "CRM could not read attachments." };
  }

  if (Array.isArray(status)) {
    const info = candidates.find((value) => value.info)?.info;
    return info ? { data: status, error: null, info } : { data: status, error: null };
  }
  const dataContainer = candidates.find((value) => Array.isArray(value.data));
  if (dataContainer) {
    const info = dataContainer.info || candidates.find((value) => value.info)?.info;
    return info
      ? { data: dataContainer.data, error: null, info }
      : { data: dataContainer.data, error: null };
  }

  const noContent = candidates.some((value) =>
    Number(value.statusCode) === 204 ||
    value.code === "NO_CONTENT" ||
    String(value.statusText || "").toLowerCase() === "nocontent"
  ) || (typeof status === "string" && /^no[ -]?content$/i.test(status.trim()));
  if (noContent || !strict) return { data: [], error: null };
  return { data: null, error: "CRM did not return a readable attachment list." };
}

async function getAttachments({ module, recordId, strict = false }) {
  try {
    const allAttachments = [];
    const seenIds = new Set();
    const lastPage = strict ? MAX_ATTACHMENT_PAGES : 1;
    for (let page = 1; page <= lastPage; page += 1) {
      const pagination = strict ? `&page=${page}&per_page=${ATTACHMENTS_PER_PAGE}` : "";
      const url = `${dataCenterMap.AU}/crm/v6/${module}/${recordId}/Attachments?fields=id,File_Name,$file_id${pagination}`;
      const response = await (window.ZOHO || ZOHO).CRM.CONNECTION.invoke(conn_name, {
        url,
        param_type: 1,
        headers: {},
        method: "GET",
      });
      const parsed = parseAttachmentListResponse(response, strict);
      if (parsed.error) return { data: null, error: parsed.error };
      const rows = parsed.data;
      const moreRecords = parsed.info?.more_records;

      if (!strict) return { data: rows, error: null };
      if (parsed.info?.page != null && Number(parsed.info.page) !== page) {
        return { data: null, error: "CRM returned the wrong attachment page." };
      }
      if (page > 1 && rows.length === 0) {
        return { data: null, error: "CRM returned an empty attachment page after reporting more records." };
      }
      if (moreRecords === true && rows.length === 0) {
        return { data: null, error: "CRM reported more attachments but returned an empty page." };
      }
      for (const row of rows) {
        if (!row?.id || seenIds.has(String(row.id))) {
          return { data: null, error: "CRM returned missing or repeated attachment IDs." };
        }
        seenIds.add(String(row.id));
      }
      allAttachments.push(...rows);
      if (moreRecords === true) {
        if (page === MAX_ATTACHMENT_PAGES) {
          return { data: null, error: "CRM attachment list exceeds the supported page limit." };
        }
        continue;
      }
      if (moreRecords !== false && rows.length === ATTACHMENTS_PER_PAGE) {
        return { data: null, error: "CRM omitted pagination details for a full attachment page." };
      }
      return { data: allAttachments, error: null };
    }
    return { data: null, error: "CRM attachment list exceeds the supported page limit." };
  } catch (getAttachmentsError) {
    console.log({ getAttachmentsError });
    return {
      data: null,
      error: "Something went wrong",
    };
  }
}

async function downloadAttachmentById({
  module,
  recordId,
  attachmentId,
  fileName,
}) {
  function downloadFile(data, filename, mime) {
    // It is necessary to create a new blob object with mime-type explicitly set
    // otherwise only Chrome works like it should
    const blob = new Blob([data], { type: mime || "application/octet-stream" });
    if (typeof window.navigator.msSaveBlob !== "undefined") {
      // IE doesn't allow using a blob object directly as link href.
      // Workaround for "HTML7007: One or more blob URLs were
      // revoked by closing the blob for which they were created.
      // These URLs will no longer resolve as the data backing
      // the URL has been freed."
      window.navigator.msSaveBlob(blob, filename);
      return;
    }
    // Other browsers
    // Create a link pointing to the ObjectURL containing the blob
    const blobURL = window.URL.createObjectURL(blob);
    const tempLink = document.createElement("a");
    tempLink.style.display = "none";
    tempLink.href = blobURL;
    tempLink.setAttribute("download", filename);
    // Safari thinks _blank anchor are pop ups. We only want to set _blank
    // target if the browser does not support the HTML5 download attribute.
    // This allows you to download files in desktop safari if pop up blocking
    // is enabled.
    if (typeof tempLink.download === "undefined") {
      tempLink.setAttribute("target", "_blank");
    }
    document.body.appendChild(tempLink);
    tempLink.click();
    document.body.removeChild(tempLink);
    setTimeout(() => {
      // For Firefox it is necessary to delay revoking the ObjectURL
      window.URL.revokeObjectURL(blobURL);
    }, 100);
  }
  try {
    const config = {
      url: access_token_api_url,
      method: "POST",

      data: {
        recordId,
        moduleName: module,
        attachment_id: attachmentId,
        access_token_url,
        dataCenterUrl: dataCenterMap.AU,
      },
      responseType: "blob",
    };
    const resp = await axios.request(config);
    console.log({ resp });

    downloadFile(resp?.data, fileName);
  } catch (downloadAttachmentByIdError) {
    return {
      data: null,
      error: "Something went wrong",
    };
  }
}

async function deleteAttachment({ module, recordId, attachment_id }) {
  try {
    const url = `${dataCenterMap.AU}/crm/v6/${module}/${recordId}/Attachments/${attachment_id}`;

    var req_data = {
      url,
      param_type: 1,
      headers: {},
      method: "DELETE",
    };

    const deleteAttachmentResp = await ZOHO.CRM.CONNECTION.invoke(
      conn_name,
      req_data
    );
    const respId = await deleteAttachmentResp?.details?.statusMessage?.data?.[0]
      ?.details?.id;

    return {
      data: respId,
      error: null,
    };
  } catch (deleteFileError) {
    return {
      data: null,
      error: "Something went wrong",
    };
  }
}

export const file = {
  uploadAttachment,
  getAttachments,
  downloadAttachmentById,
  deleteAttachment,
};
