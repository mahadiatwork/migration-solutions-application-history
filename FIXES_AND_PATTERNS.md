# Fixes and Reusable Patterns for Zoho CRM History-Style Widgets

This document summarizes fixes made in the **migration-solution-history** app so you can apply the same patterns in similar Zoho CRM embedded widgets (e.g. related-list tables with create/edit dialogs, lookups, attachments, and background refresh).

---

## 1. App.js (or Main Container)

### 1.1 Lookup (Stakeholder) in COQL and Row Mapping

**Problem:** The Stakeholder lookup was missing from the COQL select. Rows had `stakeHolder: "Unknown"` or `null`, so the Edit dialog showed an empty Stakeholder field even when Zoho had a value. COQL can also return the lookup as a **nested object** (e.g. `{ id: "..." }`) without the related name.

**Fix:**

1. **COQL `select`**  
   Include the lookup. Prefer the full object so both `id` and (when present) the related name are available:
   - `Contact_History_Info.Stakeholder`  
   If your schema uses flat fields, you can also add:
   - `Contact_History_Info.Stakeholder.id`
   - `Contact_History_Info.Stakeholder.Account_Name`

2. **Row mapping**  
   Support multiple shapes so it works with flat fields, nested object, or a junction-level lookup:

```javascript
stakeHolder: (() => {
  const flatId = obj["Contact_History_Info.Stakeholder.id"];
  const flatName = obj["Contact_History_Info.Stakeholder.Account_Name"];
  const nested = obj["Contact_History_Info.Stakeholder"];
  const junction = obj?.Stakeholder; // if lookup is on the junction record

  const id = flatId ?? (nested && typeof nested === "object" ? nested.id : undefined) ?? (junction && typeof junction === "object" ? junction.id : undefined);
  const rawName = flatName ?? (nested && typeof nested === "object" ? (nested.Account_Name ?? nested.name) : undefined) ?? (junction && typeof junction === "object" ? (junction.Account_Name ?? junction.name) : undefined);

  return id != null ? { id, name: rawName || "" } : null;
})(),
```

Use your real API names (e.g. `Account_Name` for Accounts). The Edit dialog and the Stakeholder component expect `{ id, name }` or `null`.

---

### 1.2 Pass the *Form* Value (Not the Row) in `updatedRecord`

**Problem:** After the user changed the Stakeholder in the Edit dialog and saved, the Dialog’s `updatedRecord` passed to `onRecordAdded` used `selectedRowData?.stakeHolder` (the **old** value). The parent’s `handleRecordUpdate` then wrote that back into `relatedListData`, so the UI kept showing the previous stakeholder.

**Fix (in the Dialog, not App.js):**  
When building `updatedRecord` for `onRecordAdded`, use the **form** value, not the original row:

```javascript
// Wrong: uses the row when the dialog opened
Stakeholder: selectedRowData?.stakeHolder || null,

// Correct: uses what the user selected in the form
Stakeholder: formData.stakeHolder || null,
```

The parent’s `handleRecordUpdate` should map `updatedRecord.Stakeholder` into the row’s `stakeHolder` (or your equivalent field name).

---

### 1.3 Background Refetch After Create or Update

**Problem:** Data was only loaded once. After create or update, the list could be stale (e.g. server-side changes, workflow updates) until a full reload.

**Fix:** Run the same fetch logic in the **background** after create and update. The UI stays as-is; the table and filters update when the refetch completes. Optimistic updates (prepend on create, merge on update) stay for instant feedback.

#### Step 1: Extract the fetch into a reusable function

- Move the logic **out** of the `useEffect` into a standalone async function, e.g. `fetchRLData` (or `fetchListData`).
- Place it in the component body (after state and simple handlers, before the `useEffect` that does the initial load).

#### Step 2: Add `options = { isBackground }`

```javascript
const fetchRLData = async (options = {}) => {
  if (!module || !recordId) return;   // or your equivalent params
  try {
    // ... COQL / API calls, setRelatedListData, setTypeList, etc. ...
    setInitPageContent(null);         // or your “hide loading” step
  } catch (error) {
    console.error("Error fetching data:", error);
    if (options.isBackground) {
      enqueueSnackbar("Failed to refresh data", { variant: "error" });
    } else {
      setInitPageContent("Error loading data.");  // or your full-page error
    }
  }
};
```

- **Initial load:** Use the full-page error (or loading) in `catch` when `!options.isBackground`.
- **Background refetch:** Use only a snackbar when `options.isBackground` so the UI is not replaced by an error screen.

#### Step 3: Simplify the initial-load `useEffect`

```javascript
React.useEffect(() => {
  if (module && recordId) {
    fetchRLData();
  }
}, [module, recordId]);
```

#### Step 4: Trigger refetch after create and update

In the **create** handler (e.g. `handleRecordAdded`):

```javascript
// after: setRelatedListData(...), setHighlightedRecordId(...), etc.
fetchRLData({ isBackground: true });
```

In the **update** handler (e.g. `handleRecordUpdate`):

```javascript
// after: setRelatedListData(...), setHighlightedRecordId(...), etc.
fetchRLData({ isBackground: true });
```

Do **not** `await`; run it in the background. The existing optimistic updates remain. The refetch overwrites `relatedListData` (and related state) when it finishes.

**Adapting to other apps:**

- Replace `module` / `recordId` with whatever identifies the “parent” (e.g. `applicationId`, `accountId`).
- Replace `fetchRLData`’s COQL/API and `setRelatedListData` (and `setTypeList`, etc.) with your own fetch logic.
- If you don’t have `initPageContent`, only adjust the `catch` branch (e.g. always snackbar for background, or a different error UX).

---

### 1.4 Table: Record Link (e.g. “Name” column)

**Problem:** The Name (or similar) link used only `row.history_id`. If that was missing, `window.open` was never called, so the link did nothing.

**Fix:** Resolve the main record id from the row, with a fallback:

```javascript
onClick={(e) => {
  e.stopPropagation();
  const historyId = row.history_id || row.historyDetails?.id;  // or your fields
  if (historyId) {
    window.open(
      `https://crm.zoho.com.au/crm/orgXXXX/tab/YourModule/${historyId}`,
      "_blank"
    );
  }
}}
```

Replace `orgXXXX`, `YourModule`, and the field names with your Zoho org, module API name, and row shape.

---

## 2. Stakeholder (or Any “Lookup by ID” Autocomplete)

**Problem:** When `formData.stakeHolder` was `{ id: "...", name: "" }` (id from COQL, no name), the Autocomplete had nothing to show, and the value was not preloaded.

**Fix:** If the object has an `id` but no `name`, fetch the related record (e.g. Account) by ID and set the display name. Sync that back to the parent via `handleInputChange` only when a name is found; otherwise avoid overwriting and avoid an infinite fetch loop.

### 2.1 Refs

- **`expectedIdRef`**  
  Stores the `id` we are currently fetching for. In the fetch’s `.then`/`.catch`, only update state and call `handleInputChange` when `expectedIdRef.current === id`. If the user cleared or switched to another record, we don’t apply the result.

- **`lastFetchedIdRef`**  
  When we fetch because `name` is empty and the API returns no name, we do **not** call `handleInputChange` (to avoid overwriting with empty). Without a guard, the effect would refetch in a loop. `lastFetchedIdRef` remembers we already fetched for this `id`; on the next run we skip the fetch and only sync local state.

### 2.2 `useEffect` Logic

```javascript
useEffect(() => {
  if (!formData?.stakeHolder) {
    expectedIdRef.current = null;
    lastFetchedIdRef.current = null;
    setSelectedStakeholder(null);
    setInputValue("");
    return;
  }

  if (formData.stakeHolder.name) {
    setSelectedStakeholder(formData.stakeHolder);
    setInputValue(formData.stakeHolder.name);
    return;
  }

  const id = formData.stakeHolder.id;
  if (!id || !ZOHO) return;

  if (lastFetchedIdRef.current === id) {
    setSelectedStakeholder(formData.stakeHolder);
    setInputValue(formData.stakeHolder.name || "");
    return;
  }

  lastFetchedIdRef.current = id;
  expectedIdRef.current = id;

  ZOHO.CRM.API.getRecord({
    Entity: "Accounts",        // or your lookup's module
    RecordID: id,
    approved: "both",
  })
    .then((response) => {
      if (expectedIdRef.current !== id) return;
      const name = response?.data?.[0]?.Account_Name || "";  // or your name field
      if (name) {
        const full = { id, name };
        handleInputChange("stakeHolder", full);
        setSelectedStakeholder(full);
        setInputValue(name);
      } else {
        setSelectedStakeholder(formData.stakeHolder);
        setInputValue("");
      }
    })
    .catch((err) => {
      if (expectedIdRef.current !== id) return;
      console.error("Error fetching stakeholder by id:", err);
      setSelectedStakeholder(formData.stakeHolder);
      setInputValue("");
    });
}, [formData, ZOHO, handleInputChange]);
```

**Adapting to other lookups:**

- Change `formData.stakeHolder` / `"stakeHolder"` to your field (e.g. `formData.account`, `"account"`).
- Use your module in `getRecord` (e.g. `"Accounts"`) and the correct name field (e.g. `Account_Name`).
- The parent form must pass `{ id, name }` or `null`; the component does not need to know where that comes from (COQL, another API, etc.).

---

## 3. Dialog (Edit/Create Form)

### 3.1 Lookup (Stakeholder) in `formData` Init

**Problem:** If the row’s `stakeHolder` was the string `"Unknown"` or an invalid shape, the Stakeholder Autocomplete could show nothing or behave oddly.

**Fix:** Only set the lookup in `formData` when it is a proper object with an `id`:

```javascript
stakeHolder: (selectedRowData?.stakeHolder && typeof selectedRowData.stakeHolder === "object" && selectedRowData.stakeHolder?.id != null)
  ? selectedRowData.stakeHolder
  : null,
```

Use the same check for any similar lookup (e.g. `account`, `owner`).

### 3.2 Preserve Attachment When Re-running formData Init

**Problem:** The form’s init effect set `formData` from `selectedRowData` on every run. The attachment is loaded asynchronously in a separate effect. A re-run of the init (e.g. when `currentContact` changed) overwrote `formData` and removed `formData.attachment`.

**Fix:** Use a functional update and, in **edit** mode, keep the existing `attachment` from the previous state:

```javascript
setFormData((prev) => {
  const base = { /* ... all fields from selectedRowData ... */ };
  return {
    ...base,
    attachment: selectedRowData ? prev?.attachment : undefined,
  };
});
```

- Create: `attachment` stays `undefined` (user adds via file input).
- Edit: `prev?.attachment` is kept until the attachment effect or the user sets it.

### 3.3 `updatedRecord` Uses Form Values

As in **§1.2**, any field that the user can change in the form must be taken from the form state (e.g. `formData.stakeHolder`), not from `selectedRowData`, when building `updatedRecord` for `onRecordAdded`.

### 3.4 Save/Update Loader (`isSubmitting`)

**What was implemented:** A loader on the Save/Update button during submit: a `CircularProgress` spinner plus `"Saving..."` text, with the primary action button and Cancel, Delete, and Move to Application all disabled while a save is in progress.

**How it was implemented:**

- **State:** `const [isSubmitting, setIsSubmitting] = React.useState(false);`
- **On submit start:** At the beginning of `handleSubmit`, call `setIsSubmitting(true)`.
- **Button UI:** When `isSubmitting` is true, the primary button shows `CircularProgress` and `"Saving..."` and is `disabled={isSubmitting}`. Cancel, Delete, and Move to Application use `disabled={isSubmitting}`.
- **Submit flow:** The `try` block awaits `createHistory` or `updateHistory`; on success or error, a `finally` block runs before the handler returns.

**Issue faced:** After the user updated a history, the loader showed and the dialog closed. When opening **another** history, the Save/Update button still showed the loader (spinner + `"Saving..."`).  
**Cause:** `isSubmitting` was set to `true` at the start of `handleSubmit` but **never set back to `false`**. The `finally` block only called `handleCloseDialog()`. The Dialog stays mounted when closed (`open={false}`), so `isSubmitting` remained `true`. On the next open, the same Dialog instance was reused with `isSubmitting` still `true`, so the loader appeared even though no save was in progress.

**How it was solved:**

1. **In `handleSubmit`’s `finally` block:** Call `setIsSubmitting(false)` before `handleCloseDialog()`, so the submit state is cleared whenever the handler finishes (success or error), and the dialog closes with a clean state.

   ```javascript
   } finally {
     setIsSubmitting(false);
     handleCloseDialog();
   }
   ```

2. **In the form-init effect (when `openDialog` is true):** At the start of the `if (openDialog) { ... }` block, add `setIsSubmitting(false)`. That way, every time the dialog is opened—for a new record or a different existing record—the loader is explicitly reset. This covers edge cases (e.g. if the dialog is opened before a previous `finally` runs, or if `handleCloseDialog` is not used for that open).

   ```javascript
   if (openDialog) {
     setIsSubmitting(false);
     setFormData((prev) => { ... });
     // ... rest of init
   }
   ```

**Adapting to other forms:** Use the same `isSubmitting` pattern and always reset it in `finally` before closing. Resetting in the open/init effect is a good safeguard when the form is reused for different records.

---

## 4. Attachments (e.g. `getAttachments` in `file.js`)

**Problem:** The Attachments API response from `ZOHO.CRM.CONNECTION.invoke` was read as `getAttachmentsResp?.details?.statusMessage?.data`. The real structure can be `statusMessage` as a JSON string, or the body at a different path, so the list was often empty and the Edit dialog showed “No file selected”.

**Fix:** Parse `statusMessage` safely and fall back to `details.data`:

```javascript
const sm = getAttachmentsResp?.details?.statusMessage;
const details = getAttachmentsResp?.details;

let list = [];
if (sm !== "" && sm != null) {
  const parsed = typeof sm === "string"
    ? (() => { try { return JSON.parse(sm); } catch { return {}; } })()
    : sm;
  list = Array.isArray(parsed?.data) ? parsed.data : (Array.isArray(parsed) ? parsed : []);
}
if (list.length === 0 && details && typeof details === "object" && Array.isArray(details?.data)) {
  list = details.data;
}

return { data: list, error: null };
```

Use `list` (or your `data` array) in the Dialog’s attachment effect to set `formData.attachment` and `loadedAttachmentFromRecord`. The attachment effect should use the **main record id** (e.g. `row.historyDetails?.id` or `row.history_id`), not the junction row `id`, when calling `getAttachments`.

---

## 5. Checklist for a New “History-Style” App

| Area | What to do |
|------|------------|
| **COQL / row mapping** | Include lookup in `select`; map to `{ id, name }` or `null` supporting flat, nested, and junction shapes. |
| **Dialog `updatedRecord`** | Use form state (e.g. `formData.stakeHolder`), not `selectedRowData`, for every editable lookup. |
| **Dialog formData init** | Only set a lookup when it’s an object with `id`; preserve `attachment` when in edit mode. |
| **Dialog Save/Update loader** | Use `isSubmitting`; set `false` in `handleSubmit` `finally` before close, and in form-init when `openDialog` so the loader does not persist on next open. |
| **Lookup Autocomplete** | If `id` exists but `name` is empty, fetch by id, then update form + local state; use `expectedIdRef` and `lastFetchedIdRef`. |
| **Attachments** | Parse `getAttachments` response from `statusMessage` (string or object) and `details.data`; use main record id in the Dialog. |
| **Table record link** | Use `row.recordId \|\| row.details?.id` (or your fields) before `window.open`. |
| **Background refetch** | Extract fetch into `fetchData(options)`, add `isBackground` in `catch`, call `fetchData({ isBackground: true })` after create and update. |

---

## 6. File Reference (This Repo)

| File | Changes |
|------|---------|
| `src/App.js` | COQL + stakeHolder mapping; `fetchRLData` extracted with `isBackground`; `fetchRLData({ isBackground: true })` in `handleRecordAdded` and `handleRecordUpdate`. |
| `src/components/atoms/Stakeholder.jsx` | `useRef` for `expectedIdRef`, `lastFetchedIdRef`; `useEffect` to fetch Account by id when `stakeHolder.id` exists and `stakeHolder.name` is empty. |
| `src/components/organisms/Dialog.js` | `formData.stakeHolder` only when object with `id`; `Stakeholder: formData.stakeHolder` in `updatedRecord`; `attachment: selectedRowData ? prev?.attachment : undefined` in formData init; **Save/Update loader:** `isSubmitting` state, `setIsSubmitting(false)` in `handleSubmit` `finally` and in form-init when `openDialog`. |
| `src/components/organisms/Table.js` | Name link uses `row.history_id \|\| row.historyDetails?.id`. |
| `src/zohoApi/file.js` | `getAttachments` parses `statusMessage` and falls back to `details.data`. |

---

*Last updated for migration-solution-history. Adjust entity names, modules, and URLs to match your Zoho org and schema.*
