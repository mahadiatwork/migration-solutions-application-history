const ZOHO = window.ZOHO;

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
      return { data: relatedListResp?.data, erroe: null };
    }
  } catch (getRecordsFromRelatedListError) {
    console.log({ getRecordsFromRelatedListError });
    return { data: null, error: "Something went wrong" };
  }
}

export const record = {
  getRecordsFromRelatedList,
};
