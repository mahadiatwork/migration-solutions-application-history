# COQL v8 – 2000 Records in One API Call

## Overview

This plan describes how to replace the current COQL fetch (limited to 200 records via `ZOHO.CRM.API.coql`) with a direct call to the **Zoho CRM v8 COQL API** using `ZOHO.CRM.CONNECTION.invoke`, so you can fetch **up to 2000 records in a single request**.

---

## Reference: Your Working Deluge Code

```deluge
queryMap = Map();
queryMap.put("select_query","select Name,id,Contact_History_Info.id,Owner.first_name,Owner.last_name,Contact_Details.Full_Name,Contact_History_Info.History_Type,Contact_History_Info.History_Result,Contact_History_Info.Duration,Contact_History_Info.Regarding,Contact_History_Info.History_Details_Plain,Contact_History_Info.Date from History_X_Contacts where Contact_Details = '76775000000557775' LIMIT 0, 2000");
response = invokeurl
[
	url :"https://www.zohoapis.com.au/crm/v8/coql"
	type :POST
	parameters:queryMap.toString()
	connection:"zoho_crm_conn"
];
```

---

## Key Differences

| Aspect | Current (Widget) | Target (v8 COQL) |
|-------|------------------|------------------|
| API | `ZOHO.CRM.API.coql(config)` | `ZOHO.CRM.CONNECTION.invoke(conn_name, req_data)` |
| Endpoint | Internal v2/v3 COQL (200 limit) | `{dataCenter}/crm/v8/coql` |
| Method | Internal | POST |
| Limit | 200 records | **2000 records** (LIMIT 0, 2000) |
| LIMIT syntax | `limit 200` | `LIMIT offset, limit` → `LIMIT 0, 2000` |

---

## Implementation Plan

### Step 1: Add COQL v8 Fetch Helper

**Location**: `src/App.js` (inside App component, before `fetchRLData`)

Create a helper that calls the v8 COQL endpoint via `ZOHO.CRM.CONNECTION.invoke`:

```javascript
/**
 * Fetch History_X_Contacts via COQL v8 API (up to 2000 records in one call)
 * Uses CONNECTION.invoke POST to {dataCenter}/crm/v8/coql
 * @param {string} contactId - Contact record ID (from widget context)
 * @param {number} [limit=2000] - Max records (v8 allows up to 2000)
 * @param {number} [offset=0] - Pagination offset
 * @returns {Promise<Array>} - Array of junction records
 */
const fetchHistoryViaCoqlV8 = async (contactId, limit = 2000, offset = 0) => {
  const selectQuery = `select Name,id,Contact_History_Info.id,Owner.first_name,Owner.last_name,Contact_Details.Full_Name,Contact_History_Info.History_Type,Contact_History_Info.History_Result,Contact_History_Info.Duration,Contact_History_Info.Regarding,Contact_History_Info.History_Details_Plain,Contact_History_Info.Date,Contact_History_Info.Stakeholder from History_X_Contacts where Contact_Details = '${contactId}' LIMIT ${offset}, ${limit}`;

  const req_data = {
    url: `${dataCenterMap.AU}/crm/v8/coql`,
    method: "POST",
    param_type: 2, // Send parameters in request body (payload)
    parameters: { select_query: selectQuery },
  };

  const response = await ZOHO.CRM.CONNECTION.invoke(conn_name, req_data);

  // Handle response format (may vary: data vs details.statusMessage.data)
  let data = [];
  if (response?.data) {
    data = Array.isArray(response.data) ? response.data : [];
  } else if (response?.details?.statusMessage?.data) {
    data = Array.isArray(response.details.statusMessage.data)
      ? response.details.statusMessage.data
      : [];
  }

  return data;
};
```

**Notes**:

- `param_type: 2` sends `parameters` in the request body (payload). The Zoho CRM CONNECTION API will serialize the object appropriately for the COQL endpoint.

---

### Step 2: Replace COQL Call in `fetchRLData`

**Location**: `src/App.js` – inside `fetchRLData`, replace the current COQL block.

**Current**:

```javascript
var config = {
  "select_query": `select ... from History_X_Contacts where Contact_Details = '${recordId}' limit 200`
};
const { data } = await ZOHO.CRM.API.coql(config);
const dataArray = Array.isArray(data) ? data : [];
```

**Replace with**:

```javascript
const dataArray = await fetchHistoryViaCoqlV8(recordId, 2000, 0);
```

---

### Step 3: Handle Pagination (Optional – If > 2000 Records)

If a contact can have more than 2000 history records, add a loop:

```javascript
const fetchAllHistoryViaCoqlV8 = async (contactId, maxRecords = 10000) => {
  const pageSize = 2000;
  let offset = 0;
  let allData = [];
  let hasMore = true;

  while (hasMore && allData.length < maxRecords) {
    const page = await fetchHistoryViaCoqlV8(contactId, pageSize, offset);
    allData = [...allData, ...page];
    hasMore = page.length === pageSize;
    offset += pageSize;
  }

  return allData;
};
```

Then in `fetchRLData`:

```javascript
const dataArray = await fetchAllHistoryViaCoqlV8(recordId);
```

---

### Step 4: Data Center Configuration

**Location**: `src/config/config.js`

Your Deluge uses `https://www.zohoapis.com.au`. The widget should use the same data center:

```javascript
export const dataCenterMap = {
  AU: "https://www.zohoapis.com.au",
  // ... other regions
};
```

Use `dataCenterMap.AU` (or the correct region) when building the COQL URL.

---

### Step 5: Connection Name

**Location**: `src/config/config.js`

Your Deluge uses `connection:"zoho_crm_conn"`. The widget uses:

```javascript
export const conn_name = "zoho_crm_conn";
```

Ensure this matches the connection configured in your Zoho CRM widget.

---

### Step 6: Response Handling

The v8 COQL response format is:

```json
{
  "data": [ /* array of records */ ],
  "info": {
    "count": 2000,
    "more_records": true
  }
}
```

The widget’s `ZOHO.CRM.CONNECTION.invoke` may wrap this. Handle both shapes:

```javascript
let data = [];
if (response?.data) {
  data = Array.isArray(response.data) ? response.data : [];
} else if (response?.details?.statusMessage?.data) {
  data = Array.isArray(response.details.statusMessage.data)
    ? response.details.statusMessage.data
    : [];
}
```

---

### Step 7: Error Handling

Add try/catch and user feedback:

```javascript
try {
  const dataArray = await fetchHistoryViaCoqlV8(recordId, 2000, 0);
  // ... rest of fetchRLData
} catch (error) {
  console.error("COQL v8 fetch error:", error);
  if (error?.details?.statusMessage?.code === "LIMIT_EXCEEDED") {
    // Fallback: try with 200 if 2000 fails
    const dataArray = await fetchHistoryViaCoqlV8(recordId, 200, 0);
    // ...
  }
}
```

---

## COQL Query (Exact Match to Deluge)

Use this query (with `recordId` from the widget context):

```sql
select Name,id,Contact_History_Info.id,Owner.first_name,Owner.last_name,Contact_Details.Full_Name,Contact_History_Info.History_Type,Contact_History_Info.History_Result,Contact_History_Info.Duration,Contact_History_Info.Regarding,Contact_History_Info.History_Details_Plain,Contact_History_Info.Date,Contact_History_Info.Stakeholder
from History_X_Contacts
where Contact_Details = '{recordId}'
LIMIT 0, 2000
```

---

## API Credits (v8 COQL)

From Zoho docs:

- LIMIT 1–200: 1 credit  
- LIMIT 201–1000: 2 credits  
- LIMIT 1001–2000: 3 credits  

Using `LIMIT 0, 2000` costs 3 credits per call but returns up to 2000 records in one request.

---

## Checklist

- [ ] Add `fetchHistoryViaCoqlV8` helper
- [ ] Replace `ZOHO.CRM.API.coql` call in `fetchRLData` with `fetchHistoryViaCoqlV8`
- [ ] Confirm `dataCenterMap.AU` and `conn_name` match your setup
- [ ] Handle both `response.data` and `response.details.statusMessage.data`
- [ ] Add error handling and optional fallback to 200 records
- [ ] (Optional) Add pagination for > 2000 records
- [ ] Test with a contact that has 200+ history records

---

## File Changes Summary

| File | Change |
|------|--------|
| `src/App.js` | Add `fetchHistoryViaCoqlV8`, replace COQL call in `fetchRLData` |
| `src/config/config.js` | No change if AU + `zoho_crm_conn` are already correct |

---

## Testing

1. Open a Contact record with many history entries.
2. Load the widget and confirm it fetches up to 2000 records.
3. Check the Debug panel for `coqlRows` and `totalMs`.
4. If you see `LIMIT_EXCEEDED` or similar, verify the connection scopes and that the v8 COQL endpoint is allowed.
