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
    const uploadAttachmentResp = await ZOHO.CRM.API.attachFile({
      Entity: module,
      RecordID: recordId,
      File: { Name: data?.name, Content: data },
    });
    return {
      data: uploadAttachmentResp?.data,
      error: null,
    };
  } catch (uploadFileError) {
    return {
      data: null,
      error: "Something went wrong",
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

    if (getAttachmentsResp?.details?.statusMessage === "") {
      return {
        data: [],
        error: null,
      };
    }

    return {
      data: getAttachmentsResp?.details?.statusMessage?.data,
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

async function downloadAttachmentById2({ module, recordId, attachmentId }) {
  console.log({ module, recordId, attachmentId });
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
    const url = `${dataCenterMap.AU}/crm/v6/${module}/${recordId}/Attachments/${attachmentId}`;

    var req_data = {
      url,
      param_type: 1,
      headers: {},
      method: "GET",
    };

    const downloadAttachmentResp = await ZOHO.CRM.CONNECTION.invoke(
      conn_name,
      req_data
    );
    // console.log(downloadAttachmentResp);
    // downloadFile(downloadAttachmentResp, "AAA.jpg");

    // return {
    //   data: downloadAttachmentResp,
    //   error: null,
    // };
  } catch (downloadAttachmentByIdError) {
    console.log({ downloadAttachmentByIdError });
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
    console.log({ downloadAttachmentByIdError });
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
