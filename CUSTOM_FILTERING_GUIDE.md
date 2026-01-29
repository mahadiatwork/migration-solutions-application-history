# Custom Filtering System Guide

## Overview

The application implements a comprehensive client-side filtering system that allows users to filter activities/events by multiple criteria simultaneously. The filtering is **reactive** and **real-time**, meaning results update immediately as filter criteria change.

## Architecture

### Key Components

- **Filter Controls**: UI dropdowns and checkboxes in `ActivityTable.jsx`
- **Filter Logic**: Reactive filtering using `useMemo` hook
- **Date Utilities**: Helper functions in `helperFunc.js` and `App.jsx`
- **Global State**: Zustand store manages events data

### Filter Types

The system supports **5 main filter types**:

1. **Date Filter** (Predefined ranges + Custom Range)
2. **Type Filter** (Activity types)
3. **Priority Filter** (Low, Medium, High)
4. **User Filter** (Scheduled For)
5. **Cleared Status Filter** (Show/Hide cleared events)

---

## 1. Date Filtering

### Predefined Date Ranges

The date filter supports the following predefined options:

| Filter Option | Date Range Calculation |
|--------------|------------------------|
| **Default** | From start of last month to 1 year in the future |
| **Last 7 Days** | Last 7 days including today (6 days ago to today) |
| **Last 30 Days** | Last 30 days including today (29 days ago to today) |
| **Last 90 Days** | Last 90 days including today (89 days ago to today) |
| **Last Month** | First day to last day of previous month |
| **Current Week** | Start of current week (Sunday) to end of week (Saturday) |
| **Current Month** | First day to last day of current month |
| **Next Week** | Start of next week (Sunday) to end of next week (Saturday) |

### Custom Date Range

Users can select a custom date range using the "Custom Range" option:

1. **Selection**: Click "Custom Range" from the Date dropdown
2. **Modal Opens**: A modal with two date pickers appears
3. **Date Format**: Date pickers display dates in `DD-MM-YYYY` format
4. **Date Selection**: 
   - Select start date
   - Select end date (must be after start date)
   - Click "Search" to apply
5. **Storage**: Dates are stored as `YYYY-MM-DD` strings internally

**Important**: The custom range does NOT trigger an API fetch automatically. Data is only fetched after clicking "Search" in the modal.

### Date Filtering Logic

#### For Predefined Ranges

```javascript
// Uses helperFunc.js isDateInRange function
dateMatch = isDateInRange(row.date, filterDate);
```

**Date Parsing**:
- Table displays dates as `DD/MM/YYYY` (e.g., "06/01/2026")
- Parsing explicitly uses `DD/MM/YYYY` format to avoid locale issues
- Uses `dayjs.utc()` for consistent timezone handling

#### For Custom Range

```javascript
// Explicit parsing with format specification
let rowDate = dayjs(row.date, "DD/MM/YYYY").startOf("day");
const startDate = dayjs(customDateRange.startDate, "YYYY-MM-DD").startOf("day");
const endDate = dayjs(customDateRange.endDate, "YYYY-MM-DD").endOf("day");

// Inclusive boundary check
dateMatch = rowDate.isBetween(startDate, endDate, null, "[]");
```

**Key Features**:
- **Inclusive Boundaries**: Both start and end dates are included (`"[]"` boundary)
- **Format Safety**: Explicit format parsing prevents locale-dependent errors
- **Day Normalization**: Uses `startOf("day")` to compare dates without time components
- **Fallback Parsing**: If `DD/MM/YYYY` fails, tries `YYYY-MM-DD` format

---

## 2. Type Filtering

### Available Types

Users can filter by one or more activity types:

- Meeting
- To-Do
- Call
- Appointment
- Boardroom
- Call Billing
- Email Billing
- Initial Consultation
- Mail
- Meeting Billing
- Personal Activity
- Room 1, Room 2, Room 3
- Todo Billing
- Vacation
- Other

### Filtering Logic

```javascript
const typeMatch = filterType.length === 0 || filterType.includes(row.type);
```

**Behavior**:
- **Empty array** (`filterType.length === 0`): Shows all types (no filter)
- **Has values**: Shows only events matching selected types
- **Multiple selection**: Uses `includes()` for OR logic (event matches if type is in array)

---

## 3. Priority Filtering

### Available Priorities

- Low
- Medium
- High

### Filtering Logic

```javascript
const priorityMatch = filterPriority.length === 0 || filterPriority.includes(row.priority);
```

**Behavior**:
- **Empty array**: Shows all priorities
- **Has values**: Shows only events matching selected priorities
- **Multiple selection**: OR logic (event matches if priority is in array)

---

## 4. User Filtering

### Filter Options

Users can filter by "Scheduled For" (event owner):

- **Default**: Shows only events for the logged-in user
- **Select All**: Shows events for all users
- **Deselect All**: Resets to logged-in user only
- **Multiple Selection**: Select specific users

### Filtering Logic

```javascript
const userMatch = filterUser.length === 0 ||
  filterUser.some((user) => {
    const a = (row.scheduledFor || "").trim().toLowerCase();
    const b = (user || "").trim().toLowerCase();
    
    // Try both exact and flexible matching
    const exactMatch = a === b;
    const flexibleMatch = a.includes(b) || b.includes(a);
    
    return exactMatch || flexibleMatch;
  });
```

**Key Features**:
- **Case Insensitive**: Converts to lowercase for comparison
- **Flexible Matching**: Supports partial matches (e.g., "John" matches "John Smith")
- **Exact Match**: Also supports exact name matching
- **Empty Handling**: Empty array shows all users

---

## 5. Cleared Status Filtering

### Filter Option

A checkbox labeled "Show Cleared" controls visibility of cleared events.

### Filtering Logic

```javascript
const clearedMatch = showCleared ? true : row.Event_Status !== "Closed";
```

**Behavior**:
- **Unchecked** (`showCleared = false`): Hides events where `Event_Status === "Closed"`
- **Checked** (`showCleared = true`): Shows all events, including cleared ones

**Visual Indicator**: Cleared events are displayed with a strikethrough style in the table.

---

## 6. Combined Filtering (AND Logic)

All filters are combined using **AND logic**:

```javascript
const result = typeMatch && priorityMatch && clearedMatch && userMatch && dateMatch;
```

**Meaning**: An event must pass **ALL** active filters to be displayed.

### Example

If you have:
- Date: "Last 30 Days"
- Type: ["Meeting", "Call"]
- Priority: ["High"]
- User: ["Admin"]
- Show Cleared: false

An event will be shown **only if**:
- ✅ Date is within last 30 days **AND**
- ✅ Type is "Meeting" or "Call" **AND**
- ✅ Priority is "High" **AND**
- ✅ Scheduled For is "Admin" **AND**
- ✅ Event_Status is NOT "Closed"

---

## 7. Reactive Filtering

### Implementation

The filtering uses React's `useMemo` hook for performance optimization:

```javascript
const filteredRows = React.useMemo(() => {
  const filtered = rows.filter((row) => {
    // ... filter logic ...
  });
  return filtered;
}, [
  rows,              // Re-calculates when events change
  filterType,        // Re-calculates when type filter changes
  filterPriority,    // Re-calculates when priority filter changes
  filterUser,        // Re-calculates when user filter changes
  customDateRange,   // Re-calculates when custom date range changes
  filterDate,        // Re-calculates when date filter changes
  showCleared,       // Re-calculates when cleared checkbox changes
  order,             // Re-calculates when sorting changes
  orderBy,           // Re-calculates when sort column changes
]);
```

### Benefits

1. **Automatic Updates**: When any filter changes, the filtered list automatically re-calculates
2. **Performance**: Only re-calculates when dependencies change (not on every render)
3. **Real-time**: UI updates immediately as filters change
4. **Event Updates**: When an event's date/status changes, the filtered list automatically reflects whether it should be visible

---

## 8. Filter Summary Display

### Active Filter Display

Above the table, a summary bar shows:
- **Total Records**: Count of filtered rows
- **Filter By**: List of active filter names

### Active Filter Detection

The system automatically detects which filters are active:

```javascript
const getActiveFilterNames = () => {
  const activeFilters = [];
  
  // Date filter
  if (customDateRange || (filterDate && filterDate !== "Default")) {
    activeFilters.push("Date");
  }
  
  // Type filter
  if (filterType.length > 0) {
    activeFilters.push("Type");
  }
  
  // Priority filter
  if (filterPriority.length > 0) {
    activeFilters.push("Priority");
  }
  
  // User filter (only if subset is selected)
  if (filterUser.length > 0 && filterUser.length < users.length) {
    activeFilters.push("User");
  }
  
  // Cleared filter
  if (showCleared) {
    activeFilters.push("Cleared");
  }
  
  return activeFilters;
};
```

**Display Format**: `"Total Records 13 • Filter By Date, User, Cleared"`

---

## 9. Clear Filters Functionality

### Implementation

The "Clear Filter" button resets all filters:

```javascript
const handleClearFilters = () => {
  // Step 1: Reset all filter states
  setFilterType([]);
  setFilterPriority([]);
  setFilterUser(loggedInUser?.full_name ? [loggedInUser.full_name] : []);
  setCustomDateRange(null);
  setShowCleared(false);
  
  // Step 2: Restore events from cache["Default"]
  const store = useEventsStore.getState();
  const defaultCache = store.getCache("Default");
  
  if (defaultCache && defaultCache.data && defaultCache.data.length > 0) {
    // Immediately restore from cache
    store.setEvents(defaultCache.data);
  }
  
  // Step 3: Reset filterDate to "Default"
  setFilterDate("Default");
};
```

### Behavior

1. **Resets All Filters**: Clears type, priority, user, custom date range, and cleared status
2. **Restores Default Data**: Immediately loads events from `cache["Default"]` if available
3. **Sets Date to Default**: Changes date filter to "Default"
4. **User Filter**: Resets to logged-in user only (default state)

---

## 10. Date Format Handling

### Display Format

- **Table Display**: `DD/MM/YYYY` (e.g., "06/01/2026" = January 6, 2026)
- **Date Picker Display**: `DD-MM-YYYY` (e.g., "06-01-2026")

### Internal Format

- **API Format**: `YYYY-MM-DDTHH:MM:SS±HH:MM` (e.g., "2026-01-06T14:30:00+11:00")
- **Custom Range Storage**: `YYYY-MM-DD` (e.g., "2026-01-06")

### Parsing Strategy

The system uses explicit format parsing to avoid locale-dependent issues:

```javascript
// Table dates: DD/MM/YYYY
let rowDate = dayjs(row.date, "DD/MM/YYYY").startOf("day");

// Custom range: YYYY-MM-DD
const startDate = dayjs(customDateRange.startDate, "YYYY-MM-DD").startOf("day");
```

**Why Explicit Parsing?**
- Prevents misinterpretation (e.g., "06/01/2026" could be June 1st in US format)
- Ensures consistent behavior across different locales
- Makes the code more maintainable and predictable

---

## 11. Filter State Management

### Local State (ActivityTable.jsx)

Each filter has its own state:

```javascript
const [filterDate, setFilterDate] = useState("Default");
const [customDateRange, setCustomDateRange] = useState(null);
const [filterType, setFilterType] = useState([]);
const [filterPriority, setFilterPriority] = useState([]);
const [filterUser, setFilterUser] = useState([loggedInUser?.full_name]);
const [showCleared, setShowCleared] = useState(false);
```

### Global State (Zustand Store)

The events data is managed globally:

```javascript
const events = useEventsStore((state) => state.events);
```

**Separation of Concerns**:
- **Filter criteria**: Local component state
- **Event data**: Global Zustand store
- **Filtered results**: Computed via `useMemo` from both

---

## 12. Performance Considerations

### Optimization Strategies

1. **Memoization**: `filteredRows` is memoized to prevent unnecessary recalculations
2. **Dependency Array**: Only recalculates when relevant dependencies change
3. **Client-Side Filtering**: All filtering happens in the browser (no API calls per filter change)
4. **Efficient Comparisons**: Uses optimized string matching and date comparisons

### When Filtering Runs

The `filteredRows` useMemo recalculates when:
- ✅ Events in store change (new data loaded, event updated/deleted)
- ✅ Any filter criteria changes (type, priority, user, date, cleared)
- ✅ Sorting changes (order, orderBy)

---

## 13. Common Filter Scenarios

### Scenario 1: Filter by Date Range

**User Action**: Select "Last 30 Days" from Date dropdown

**What Happens**:
1. `filterDate` state changes to "Last 30 Days"
2. `useEffect` in `App.jsx` triggers `handleStandardFilter("Last 30 Days")`
3. Checks cache for "Last 30 Days"
4. If cached, loads from cache; otherwise fetches from API
5. Events are added to global store
6. `filteredRows` useMemo recalculates with new events
7. Table displays filtered results

### Scenario 2: Multiple Filters

**User Action**: 
- Select "Last 7 Days" date filter
- Select "Meeting" and "Call" types
- Select "High" priority
- Check "Show Cleared"

**What Happens**:
1. Each filter change updates its respective state
2. `filteredRows` useMemo recalculates after each change
3. Events must pass ALL filters (AND logic)
4. Table updates immediately showing only matching events

### Scenario 3: Custom Date Range

**User Action**: 
- Select "Custom Range" from Date dropdown
- Modal opens
- Select start date: 01-01-2026
- Select end date: 31-01-2026
- Click "Search"

**What Happens**:
1. Dates are converted to `YYYY-MM-DD` format
2. `customDateRange` state is set: `{ startDate: "2026-01-01", endDate: "2026-01-31" }`
3. `filterDate` is set to "Custom Range"
4. `useEffect` triggers `handleCustomRange()`
5. API fetches events for that date range
6. Events are added to global store
7. `filteredRows` filters events where date is between 01-01-2026 and 31-01-2026
8. Table displays filtered results

---

## 14. Troubleshooting

### Issue: Dates Not Filtering Correctly

**Possible Causes**:
- Date format mismatch (DD/MM/YYYY vs MM/DD/YYYY)
- Timezone issues
- Invalid date parsing

**Solution**: Check console logs for date parsing warnings. Ensure dates are in correct format.

### Issue: Filter Not Applying

**Possible Causes**:
- Filter state not updating
- useMemo dependencies missing
- Events array empty

**Solution**: Check that filter state changes trigger useMemo recalculation.

### Issue: Cleared Events Still Showing

**Possible Causes**:
- "Show Cleared" checkbox is checked
- Event_Status is not "Closed"

**Solution**: Uncheck "Show Cleared" checkbox or verify Event_Status field.

---

## 15. Code Locations

### Key Files

- **Filter UI**: `src/components/ActivityTable.jsx` (lines 359-644)
- **Filter Logic**: `src/components/ActivityTable.jsx` (lines 476-584)
- **Date Utilities**: `src/components/helperFunc.js` (lines 36-89)
- **Date Range Calculation**: `src/App.jsx` (lines 74-140)
- **Custom Range Modal**: `src/components/atom/DateRangeModal.jsx`

### Key Functions

- `filteredRows` (useMemo): Main filtering logic
- `isDateInRange()`: Predefined date range checking
- `handleClearFilters()`: Reset all filters
- `getActiveFilterNames()`: Generate filter summary
- `calculateDateRange()`: Calculate date boundaries for API

---

## Summary

The custom filtering system provides:

✅ **5 Filter Types**: Date, Type, Priority, User, Cleared Status  
✅ **Reactive Updates**: Automatic recalculation when filters change  
✅ **Combined Logic**: AND logic for multiple filters  
✅ **Date Safety**: Explicit format parsing prevents locale issues  
✅ **Performance**: Memoized filtering for optimal performance  
✅ **User-Friendly**: Clear filter summary and easy reset functionality  

The system ensures that users can efficiently filter large datasets with multiple criteria while maintaining fast, responsive UI updates.
