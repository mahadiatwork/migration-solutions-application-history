# COQL v8 & Custom Filtering Implementation Plan

## Overview

This document adapts the patterns from **COQL_V8_2000_RECORDS_PLAN.md** and **CUSTOM_FILTERING_GUIDE.md** (written for a Contact History application) to the **migration-solutions-application-history** app, which displays **Application History** records related to an Application.

---

## Application Context

| Aspect | Reference Apps | This App (migration-solutions-application-history) |
|--------|----------------|---------------------------------------------------|
| **Parent Entity** | Contact | Application |
| **Parent ID** | `contactId` | `recordId` (from `useZohoInit`) |
| **Related Data** | History_X_Contacts (junction) | Application_History (related list) |
| **Module** | Contacts | Applications |
| **Related List API Name** | N/A (COQL) | `Application_History` |
| **Current Fetch** | COQL / getRelatedRecords | `getRecordsFromRelatedList` → `getRelatedRecords` |
| **Record Limit** | 200 (standard) / 2000 (COQL v8) | ~200 per page (getRelatedRecords default) |

---

## Part 1: COQL v8 – 2000 Records in One API Call

### 1.1 Current vs Target

| Aspect | Current | Target |
|--------|---------|--------|
| **API** | `ZOHO.CRM.API.getRelatedRecords` | `ZOHO.CRM.CONNECTION.invoke` → COQL v8 |
| **Endpoint** | Internal related list API | `{dataCenter}/crm/v8/coql` |
| **Method** | GET (internal) | POST |
| **Limit** | ~200 per page | **2000 records** (LIMIT 0, 2000) |

### 1.2 COQL Query for Application History (Verified Working – Deluge)

The related list "Application_History" returns **Applications_History** records linked to the current Application. The following query has been **verified working** in Deluge:

**Working Deluge Reference:**
```deluge
applicationId = "76775000007812292";
limit = 2000;
offset = 0;

// REMOVED: Duration_Min, Stakeholder, Owner.Name (these caused COQL to fail)
// KEPT: All fields confirmed in JSON response
selectQuery = "SELECT Name, id, Date, History_Type, History_Result, Regarding, History_Details, Owner FROM Applications_History WHERE Application = '" + applicationId + "' LIMIT " + offset + ", " + limit;

paramMap = Map();
paramMap.put("select_query", selectQuery);

response = invokeurl
[
  url :"https://www.zohoapis.com.au/crm/v8/coql"
  type :POST
  parameters :paramMap.toString()
  connection :"zoho_crm_conn" 
];
```

**Correct COQL Query (use in widget):**
```sql
SELECT Name, id, Date, History_Type, History_Result, Regarding, History_Details, Owner
FROM Applications_History
WHERE Application = '{recordId}'
LIMIT {offset}, {limit}
```

**Fields that must NOT be used (cause COQL to fail):**
- `Duration_Min` – not supported in this COQL context
- `Stakeholder` – not supported in this COQL context  
- `Owner.name`, `Owner.id` – use `Owner` only (whole lookup object)

**Fields returned:** `Name`, `id`, `Date`, `History_Type`, `History_Result`, `Regarding`, `History_Details`, `Owner`

**Row mapping:** For `duration` and `stakeHolder`, use fallbacks (`"N/A"` and `null`) since COQL does not return them. Extract `ownerName` from `Owner.name` or `Owner.full_name` in the response.

**Deluge verification:** The above query was tested in Deluge with `applicationId = "76775000007812292"` and returned data successfully. The connection `zoho_crm_conn` and URL `https://www.zohoapis.com.au/crm/v8/coql` are confirmed working.

---

### Post-Implementation Issues & Resolutions

The following issues were encountered after the initial COQL implementation and were resolved as described below.

#### Issue 1: Record Owner showing "Unknown Owner"

**Problem:** The "Record Owner" column displayed "Unknown Owner" for all records, even though owner data exists in Zoho.

**Root cause:** When selecting `Owner` in COQL, the Zoho API often returns only `{ "id": "xxx" }` without `name` or `full_name`. The docs state: *"When you query a lookup field, the response only contains the ID of the field."*

**Fix:** Added a `getOwnerDisplayName(owner, users)` helper in `App.js` that:
- Handles multiple Owner shapes: `name`, `full_name`, `Name`, `Full_Name`, or `first_name` + `last_name`
- When Owner is only `{ id }` or a string ID, looks up the user in `validUsers` (from `getAllUsers`) and returns their `full_name`
- Falls back to `"Unknown Owner"` only when no match is found

#### Issue 2: Stakeholder not showing when reopening the edit popup

**Problem:** After updating the stakeholder in the edit dialog and saving, the update was persisted to Zoho. But when reopening the popup, the stakeholder field still showed the old value.

**Root cause:** `handleRecordUpdate` correctly updated `relatedListData` with the new `stakeHolder`. However, it then called `fetchRLData({ isBackground: true })`, which refetched data from COQL. The COQL query does **not** include `Stakeholder` (it causes COQL to fail), so the refetched records had `stakeHolder: null`. This overwrote the locally updated data.

**Fix:** Added `preserveFieldsForRecordId` support to `fetchRLData`:
- When refetching after an edit, pass `{ id: updatedRecord.id, stakeHolder: normalizedRecord.stakeHolder }`
- During row mapping, if a row's `id` matches and preserved `stakeHolder` is provided, use it instead of the API-mapped value (which would be null from COQL)

#### Issue 3: Duration not showing in table or edit dialog

**Problem:** The "Duration" column showed "N/A" for all records, and the "Duration (Min)" field in the edit dialog also showed "N/A" instead of the actual value.

**Root cause:**
1. **COQL query:** The COQL query did not include `Duration_Min`. The original plan said it was unsupported, but Zoho's COQL docs indicate numeric fields are supported.
2. **Dialog handling:** The Duration Autocomplete expects numeric options (10, 20, 30, …). When `duration` was `"N/A"` or a string like `"60"`, it didn't match any option and displayed incorrectly.

**Fix:**
1. **`record.js`:** Added `Duration_Min` to the COQL SELECT query. If this causes COQL to fail, the app falls back to `getRecordsFromRelatedList`, which returns full records including `Duration_Min`.
2. **`App.js`:** Updated duration mapping to handle `0` correctly: `(obj?.Duration_Min != null && String(obj.Duration_Min).trim() !== "") ? obj.Duration_Min : "N/A"`.
3. **`Dialog.js`:** 
   - Parse `selectedRowData.duration` to a number when initializing the form (handles `"N/A"`, `null`, and numeric strings)
   - Added `freeSolo` so custom durations (e.g. 45) display even when not in the preset options
   - Added `isOptionEqualToValue` for robust string/number comparison

**Updated COQL query (current):**
```sql
SELECT Name, id, Date, History_Type, History_Result, Regarding, History_Details, Owner, Duration_Min
FROM Applications_History
WHERE Application = '{recordId}'
LIMIT {offset}, {limit}
```

**Note:** `Stakeholder` remains excluded from the COQL query as it causes the query to fail. Use `preserveFieldsForRecordId` when refetching after a stakeholder update.

---

### 1.3 Implementation Steps

#### Step 1: Add COQL v8 Fetch Helper

**Location:** `src/zohoApi/record.js` (or new `src/zohoApi/coql.js`)

```javascript
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
  // Verified working: do NOT include Duration_Min, Stakeholder, Owner.name, Owner.id
  const selectQuery = `SELECT Name, id, Date, History_Type, History_Result, Regarding, History_Details, Owner FROM Applications_History WHERE Application = '${applicationId}' LIMIT ${offset}, ${limit}`;

  const req_data = {
    url: `${dataCenterMap.AU}/crm/v8/coql`,
    method: "POST",
    param_type: 2,
    parameters: { select_query: selectQuery },
  };

  const response = await ZOHO.CRM.CONNECTION.invoke(conn_name, req_data);

  let data = [];
  if (response?.data) {
    data = Array.isArray(response.data) ? response.data : [];
  } else if (response?.details?.statusMessage?.data) {
    const sm = response.details.statusMessage;
    const parsed = typeof sm === "string" ? JSON.parse(sm || "{}") : sm;
    data = Array.isArray(parsed?.data) ? parsed.data : [];
  }

  return data;
}
```

#### Step 2: Update `fetchRLData` in App.js

**Current (record.js):**
```javascript
const { data } = await zohoApi.record.getRecordsFromRelatedList({
  module,
  recordId,
  RelatedListAPI: "Application_History",
});
```

**Option A – Use COQL v8 when module is Applications, Application, or Deals:**
```javascript
let data = [];
if (module === "Applications" || module === "Deals") {
  try {
    data = await zohoApi.record.fetchApplicationHistoryViaCoqlV8(recordId, 2000, 0);
  } catch (coqlError) {
    console.warn("COQL v8 failed, falling back to getRelatedRecords:", coqlError);
    const resp = await zohoApi.record.getRecordsFromRelatedList({
      module,
      recordId,
      RelatedListAPI: "Application_History",
    });
    data = resp?.data || [];
  }
} else {
  const resp = await zohoApi.record.getRecordsFromRelatedList({
    module,
    recordId,
    RelatedListAPI: "Application_History",
  });
  data = resp?.data || [];
}
```

**Option B – Paginate getRelatedRecords (if COQL not available):**

If COQL v8 is not supported for Applications_History, use pagination to fetch up to 2000 records:

```javascript
const fetchAllApplicationHistory = async (module, recordId) => {
  let allData = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const resp = await ZOHO.CRM.API.getRelatedRecords({
      Entity: module,
      RecordID: recordId,
      RelatedList: "Application_History",
      page,
      per_page: perPage,
    });
    const pageData = resp?.data || [];
    allData = [...allData, ...pageData];
    if (pageData.length < perPage || allData.length >= 2000) break;
    page++;
  }

  return allData;
};
```

#### Step 3: Row Mapping (Same as Current)

The COQL response may return slightly different field shapes. Keep the existing mapping logic and extend for COQL if needed:

```javascript
// COQL returns: Name, id, Date, History_Type, History_Result, Regarding, History_Details, Owner
// COQL does NOT return: Duration_Min, Stakeholder – use fallbacks
const tempData = data?.map((obj) => ({
  name: obj?.Name || "No Name",
  id: obj?.id,
  date_time: obj?.Date,
  type: obj?.History_Type || "Unknown Type",
  result: obj?.History_Result || "No Result",
  duration: obj?.Duration_Min || "N/A",  // COQL: always "N/A"; getRelatedRecords: has value
  regarding: obj?.Regarding || "No Regarding",
  details: obj?.History_Details || "No Details",
  icon: <DownloadIcon />,
  ownerName: obj?.Owner?.name || obj?.Owner?.full_name || "Unknown Owner",  // COQL: Owner object
  stakeHolder: (() => {
    const nested = obj?.Stakeholder;  // COQL: null (not in query); getRelatedRecords: may have value
    const id = nested && typeof nested === "object" ? nested.id : undefined;
    const rawName = nested && typeof nested === "object" ? (nested.Account_Name ?? nested.name) : undefined;
    return id != null ? { id, name: rawName || "" } : null;
  })(),
  currentData: currentModuleData,
}));
```

### 1.4 Config Verification

**Location:** `src/config/config.js`

- `dataCenterMap.AU` = `"https://www.zohoapis.com.au"` ✓
- `conn_name` = `"zoho_crm_conn"` ✓

### 1.5 Checklist (COQL v8)

- [ ] Add `fetchApplicationHistoryViaCoqlV8` to `src/zohoApi/record.js` (or new coql module)
- [ ] Update `fetchRLData` in App.js to use COQL v8 when applicable
- [ ] Add fallback to `getRecordsFromRelatedList` if COQL fails
- [ ] Verify module/field names (Applications_History, Application) in Zoho schema
- [ ] Handle both `response.data` and `response.details.statusMessage` shapes
- [ ] Test with an Application that has 200+ history records

---

## Part 2: Custom Filtering Enhancements

### 2.1 Current Filter State (App.js)

| Filter | State | Type | Notes |
|--------|-------|------|-------|
| Date | `dateRange` | Object | preDay, custom, startDate/endDate |
| Type | `selectedType` | string \| null | Single select |
| Keyword | `keyword` | string | Text search |
| User (Owner) | `selectedOwner` | object \| null | Single select |

### 2.2 Target Enhancements (from CUSTOM_FILTERING_GUIDE)

| Enhancement | Description |
|-------------|-------------|
| **Filter Summary** | Display "Total Records X • Filter By Date, Type, User" above table |
| **Clear Filters** | Button to reset all filters to default |
| **useMemo for filteredData** | Memoize filtered rows for performance |
| **Explicit Date Parsing** | Use `dayjs(date, "YYYY-MM-DD")` to avoid locale issues |
| **Multi-Select Type** | Optional: Allow multiple types (OR logic) |
| **Flexible User Matching** | Optional: Partial match for owner names |

### 2.3 Filter Types (Adapted for Application History)

This app does **not** have Priority or Cleared Status. The adapted filter set:

1. **Date Filter** – Predefined ranges + Custom Range (already present)
2. **Type Filter** – History types (single or multi-select)
3. **User Filter** – Record Owner (single or multi-select)
4. **Keyword Filter** – Search in name, details, regarding

### 2.4 Implementation Steps

#### Step 1: Memoize `filteredData` with useMemo

**Location:** `src/App.js`

**Current:**
```javascript
const filteredData = relatedListData
  ?.filter(...)
  ?.filter(...)
  ?.filter(...)
  ?.filter(...);
```

**Replace with:**
```javascript
const filteredData = React.useMemo(() => {
  if (!relatedListData?.length) return [];
  return relatedListData
    .filter((el) =>
      selectedOwner ? el.ownerName === selectedOwner?.full_name : true
    )
    .filter((el) => (selectedType ? el?.type === selectedType : true))
    .filter((el) => {
      if (dateRange?.preDay) {
        const isValidDate = dayjs(el?.date_time).isValid();
        return isValidDate && isInLastNDays(el?.date_time, dateRange.preDay);
      }
      if (dateRange?.startDate && dateRange?.endDate) {
        const rowDate = dayjs(el?.date_time);
        const start = dayjs(dateRange.startDate).startOf("day");
        const end = dayjs(dateRange.endDate).endOf("day");
        return rowDate.isBetween(start, end, null, "[]");
      }
      if (dateRange?.custom) {
        const startDate = dayjs(dateRange.custom());
        const endDate = dayjs();
        return dayjs(el?.date_time).isBetween(startDate, endDate, null, "[]");
      }
      return true;
    })
    .filter((el) => {
      if (!keyword?.trim()) return true;
      const kw = keyword.trim().toLowerCase();
      return (
        el.name?.toLowerCase().includes(kw) ||
        el.details?.toLowerCase().includes(kw) ||
        el.regarding?.toLowerCase().includes(kw)
      );
    });
}, [
  relatedListData,
  selectedOwner,
  selectedType,
  dateRange,
  keyword,
]);
```

#### Step 2: Add Filter Summary

**Location:** `src/App.js` – above the Table, inside the Grid

```jsx
{/* Filter Summary */}
<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, fontSize: "9pt" }}>
  <span>Total Records {filteredData?.length ?? 0}</span>
  {getActiveFilterNames().length > 0 && (
    <>
      <span>•</span>
      <span>Filter By: {getActiveFilterNames().join(", ")}</span>
      <Button size="small" onClick={handleClearFilters} sx={{ ml: 1 }}>
        Clear Filters
      </Button>
    </>
  )}
</Box>
```

**Helper:**
```javascript
const getActiveFilterNames = () => {
  const active = [];
  if (dateRange?.preDay || dateRange?.startDate || dateRange?.custom) active.push("Date");
  if (selectedType) active.push("Type");
  if (selectedOwner) active.push("User");
  if (keyword?.trim()) active.push("Keyword");
  return active;
};
```

#### Step 3: Add Clear Filters Handler

```javascript
const handleClearFilters = () => {
  setDateRange(dateOptions[0]);
  setSelectedType(null);
  setSelectedOwner(null);
  setKeyword("");
  setCustomRange({ startDate: null, endDate: null });
  setIsCustomRangeDialogOpen(false);
};
```

#### Step 4: Improve Date Parsing (Custom Range)

For custom range, use explicit formats to avoid locale issues:

```javascript
// In the date filter logic for custom range
const rowDate = dayjs(el?.date_time);
const startDate = dayjs(dateRange.startDate, "YYYY-MM-DD").startOf("day");
const endDate = dayjs(dateRange.endDate, "YYYY-MM-DD").endOf("day");
return rowDate.isBetween(startDate, endDate, null, "[]");
```

Ensure custom range stores dates as `YYYY-MM-DD` when applying.

### 2.5 Optional: Multi-Select Type Filter

To allow multiple types (e.g., "Meeting" OR "Call"):

```javascript
const [selectedTypes, setSelectedTypes] = React.useState([]); // Array instead of single

// Filter logic
.filter((el) =>
  selectedTypes.length === 0 || selectedTypes.includes(el?.type)
)

// UI: Use Autocomplete with multiple
<Autocomplete
  multiple
  options={typeList}
  value={selectedTypes}
  onChange={(e, value) => setSelectedTypes(value)}
  // ...
/>
```

### 2.6 Optional: Flexible User Matching

```javascript
const userMatch = !selectedOwner ? true : (() => {
  const rowOwner = (el.ownerName || "").trim().toLowerCase();
  const filterOwner = (selectedOwner?.full_name || "").trim().toLowerCase();
  return rowOwner === filterOwner || rowOwner.includes(filterOwner) || filterOwner.includes(rowOwner);
})();
```

### 2.7 Checklist (Custom Filtering)

- [ ] Refactor `filteredData` to use `React.useMemo` with correct dependencies
- [ ] Add `getActiveFilterNames()` helper
- [ ] Add Filter Summary UI above table
- [ ] Add `handleClearFilters` and "Clear Filters" button
- [ ] Use explicit date parsing for custom range
- [ ] (Optional) Multi-select type filter
- [ ] (Optional) Flexible user matching

---

## Part 3: File Changes Summary

| File | Changes |
|------|---------|
| `src/zohoApi/record.js` | Add `fetchApplicationHistoryViaCoqlV8`; export from record API |
| `src/App.js` | Use COQL v8 in `fetchRLData` (with fallback); memoize `filteredData`; add filter summary, `getActiveFilterNames`, `handleClearFilters` |
| `src/config/config.js` | No change if AU + conn_name already correct |

---

## Part 4: Schema Verification (Verified via Deluge)

**Confirmed working** (from Deluge test):

1. **Module:** `Applications_History`
2. **Lookup field:** `Application` (to parent Application record)
3. **Fields that work in COQL:** `Name`, `id`, `Date`, `History_Type`, `History_Result`, `Regarding`, `History_Details`, `Owner`
4. **Fields that must NOT be used** (cause COQL to fail): `Duration_Min`, `Stakeholder`, `Owner.name`, `Owner.id`

---

## Part 5: Testing

1. **COQL v8**
   - Open an Application with 200+ history records
   - Confirm all records load (check count)
   - If COQL fails, confirm fallback to getRelatedRecords works

2. **Filtering**
   - Apply each filter (Date, Type, User, Keyword) and verify results
   - Use "Clear Filters" and confirm all filters reset
   - Check Filter Summary shows correct active filters and count

3. **Custom Date Range**
   - Select Custom Range, pick start/end, apply
   - Verify only records in that range are shown
   - Verify date parsing works across locales

---

## Summary

| Feature | Status | Notes |
|---------|--------|-------|
| COQL v8 (2000 records) | To implement | Add helper, switch fetchRLData, verify schema |
| Memoized filtering | To implement | useMemo with deps |
| Filter summary | To implement | Total count + active filter names |
| Clear filters | To implement | Reset all filter state |
| Explicit date parsing | To implement | For custom range |
| Multi-select type | Optional | Enhance type filter |
| Flexible user match | Optional | Enhance owner filter |

---

*Adapted from COQL_V8_2000_RECORDS_PLAN.md and CUSTOM_FILTERING_GUIDE.md for migration-solutions-application-history.*
