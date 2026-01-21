const ZOHO = window.ZOHO;

export async function resizeWindow({ height, width }) {
  try {
    await ZOHO.CRM.UI.Resize({ height, width });
  } catch (resizeWindowError) {
    console.log({ resizeWindowError });
  }
}

export async function initZoho(callback, { height, width }, initCallback) {
  ZOHO.embeddedApp.on("PageLoad", async function (initialData) {
    try {
      callback(initialData, null);
    } catch (initZohoError) {
      console.log({ initZohoError });
      callback({}, { message: "initzoho error" });
    }
  });

  ZOHO.embeddedApp
    .init()
    .then(() => {
      if (height && width) {
        resizeWindow({ height, width });
      }
      initCallback?.(true);
    })
    .catch((initZohoInitError) => {
      console.log({ initZohoInitError });
    });
}

export const auth = {
  initZoho,
  resizeWindow,
};
