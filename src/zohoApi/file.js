import axios from "axios";
import {
  conn_name,
  dataCenterMap,
  access_token_api_url,
  access_token_url,
} from "../config/config";

const ZOHO = window.ZOHO;

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

async function getAttachments({ module, recordId }) {
  try {
    const url = `${dataCenterMap.AU}/crm/v6/${module}/${recordId}/Attachments?fields=id,File_Name,$file_id`;

    var req_data = {
      url,
      param_type: 1,
      headers: {},
      method: "GET",
    };

    const getAttachmentsResp = await ZOHO.CRM.CONNECTION.invoke(
      conn_name,
      req_data
    );

    const sm = getAttachmentsResp?.details?.statusMessage;
    const details = getAttachmentsResp?.details;

    let list = [];
    if (sm !== "" && sm !== null && sm !== undefined) {
      const parsed = typeof sm === "string"
        ? (() => { try { return JSON.parse(sm); } catch { return {}; } })()
        : sm;
      list = Array.isArray(parsed?.data) ? parsed.data : (Array.isArray(parsed) ? parsed : []);
    }
    if (list.length === 0 && details && typeof details === "object" && Array.isArray(details?.data)) {
      list = details.data;
    }

    return {
      data: list,
      error: null,
    };
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
