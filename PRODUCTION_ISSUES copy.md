# Production Issues: Vercel Build Failing (ESLint)

This document describes the **Vercel build failures** caused by ESLint when `CI=true`, and how they were fixed. Use it as a reference when similar production or CI build issues appear.

---

## 1. What Happens

### Symptom

- **Build fails on Vercel** with:
  ```
  Treating warnings as errors because process.env.CI = true.
  Most CI servers set it automatically.

  Failed to compile.
  [eslint]
  src/path/to/File.jsx
    Line X:Y:  ...  no-unused-vars
    Line A:B:  React Hook useEffect has missing dependencies: ...  react-hooks/exhaustive-deps
  ```

- Build works locally (`npm run build` or `yarn build`) but fails on Vercel.

### Root Cause

- **Vercel and most CI systems set `process.env.CI = true`**.
- **Create React App (react-scripts) treats all ESLint *warnings* as *errors* when `CI=true`**.
- So any `no-unused-vars`, `react-hooks/exhaustive-deps`, `eqeqeq`, etc. that are only *warnings* locally become **hard failures** in production/CI.

---

## 2. Types of Issues and How to Fix Them

### 2.1 `'X' is defined but never used` (no-unused-vars)

**Meaning:** An import or variable is declared but never referenced.

| Case | Fix |
|------|-----|
| **Unused import** | Remove it: `import { a, b } from "x"` → `import { a } from "x"` |
| **Unused state value** (setter is used) | Use empty slot: `const [value, setValue]` → `const [, setValue]` |
| **Unused variable in assignment** | Use `void` or remove. If it’s an `await` result: `await fn()` (no `const x =`) |
| **Unused function** | Delete it, or keep and add `// eslint-disable-next-line no-unused-vars` only if you must retain it |

**Examples from this project:**

- `'useEffect' is defined but never used` → `import React, { useEffect, useState }` → `import React, { useState }`
- `'historyName' is assigned a value but never used` → `const [historyName, setHistoryName]` → `const [, setHistoryName]`
- `'zohoApi' is defined but never used` → remove from imports

---

### 2.2 `React Hook useEffect has missing dependencies` (react-hooks/exhaustive-deps)

**Meaning:** The `useEffect` dependency array does not list every value from the outer scope used inside the effect. ESLint wants you to add them to avoid stale closures—but that can cause infinite re-runs or unwanted refetches.

**When you intentionally omit deps** (e.g. “run once on mount” or “we know this is safe”):

Add an eslint-disable for that specific line:

```javascript
useEffect(() => {
  fetchData();
// eslint-disable-next-line react-hooks/exhaustive-deps -- run on mount only; ZOHO/selectedContact stable
}, []);
```

Put the comment **immediately above** the line that has the dependency array (`}, [deps]);`). The `--` part is optional; it explains *why* deps are omitted.

**When to use:**
- “Run once on mount” with `[]`
- `fetchRLData`, `ZOHO`, `setSelectedContacts`, etc. that would cause refetch loops or are considered stable

**Examples from this project:**
- `fetchRLData` in `useEffect` in App.js
- `fetchParticipantsDetails` in ContactFields.jsx (ZOHO, selectedContact)
- Form-init and fetch-history `useEffect`s in Dialog.js (ownerList, setSelectedContacts, ZOHO.CRM.API)

---

### 2.3 `Expected '===' and instead saw '=='` (eqeqeq)

**Meaning:** ESLint disallows `==` / `!=`; it wants `===` / `!==`.

**Fix:** Replace with strict equality and handle `null`/`undefined` explicitly if needed:

```javascript
// Before
if (x == null || x == undefined) { ... }

// After
if (x === null || x === undefined) { ... }
// or
if (x == null) { ... }  // only if you intentionally want null+undefined and add eslint-disable
```

Prefer `=== null`, `=== undefined`, or a single `== null` with a comment, rather than disabling eqeqeq project‑wide.

---

### 2.4 Unused `const x = await ...`

**Meaning:** The result of `await` is stored but never used.

**Fix:** Don’t assign if you don’t need the result:

```javascript
// Before
const deleteFileResp = await zohoApi.file.deleteAttachment({...});

// After
await zohoApi.file.deleteAttachment({...});
```

Same for `resizeResp`, `downloadAttachmentResp`, `response` in loops, etc.

---

### 2.5 Unused functions or large blocks

**Meaning:** A whole function or `useMemo` is never called or used.

**Fix:**
- **Functions:** Remove, or comment out and add `// eslint-disable-next-line no-unused-vars` if you need to keep for later.
- **useMemo (e.g. `resultOptions`):** Remove if `getResultOptions` or similar from helpers fully replaces it.

---

## 3. Files and Fixes (This Repo)

| File | Issue | Fix |
|------|-------|-----|
| **App.js** | `zohoApi`, `getCurrentContact` unused | Remove from imports |
| | `selectedRecordId` unused | `const [, setSelectedRecordId]` |
| | `zohoLoaded`, `setZohoLoaded` unused | Remove state |
| | `useEffect` deps for `fetchRLData` | `// eslint-disable-next-line react-hooks/exhaustive-deps` |
| | `setCurrentContact` unused (but `currentContact` is used) | `// eslint-disable-next-line no-unused-vars -- setter not used but state value is needed` |
| | `id != null` (loose equality) | Change to `id !== null && id !== undefined` |
| **ApplicationTable.jsx** | `useEffect` unused (after removing a `useEffect`) | Remove `useEffect` from `import { useState, useEffect }` |
| | `setCurrentGlobalContact`, `getCurrentContact` unused | Remove import |
| | `mahadiContact`, its `useEffect` | Remove state and effect |
| | `contact` / `response` in loop | Use `contact.id`, drop `response`; `await insertRecord(...)` |
| **ContactFields.jsx** | `useRef` unused | Remove from imports |
| | `commonStyles` (outer) unused | Remove; keep inner one |
| | `contacts`, `setContacts` unused | Remove state |
| | `==` in condition | Use `===` |
| | `useEffect` deps (fetch + second effect) | `// eslint-disable-next-line react-hooks/exhaustive-deps` |
| **Stakeholder.jsx** | `fetchStakeholders` causes useCallback deps to change | Wrap `fetchStakeholders` in `useCallback` with `[ZOHO]` deps |
| **Dialog.js** | `Chip`, `CalendarMonthIcon`, `ApplicationTable`, `debounce` | Remove imports / `debounce` |
| | `historyName`, `regarding`, `selectedType`, `selectedApplicationId` | `const [, setHistoryName]` etc. |
| | `regarding` state, `handleRegardingChange` | Remove (use `formData.regarding`) |
| | `resultOptions` useMemo | Remove (replaced by `getResultOptions`) |
| | `deleteFileResp` | `await zohoApi.file.deleteAttachment(...)` |
| | `useEffect` deps (form init, fetch history) | `// eslint-disable-next-line react-hooks/exhaustive-deps` |
| | `selectedApplicationId` unused (only setter used) | `const [, setSelectedApplicationId]` (empty slot pattern) |
| | `DialogTitle`, `DialogContentText` unused | Remove from imports |
| | `updatedHistoryName` duplicate calculation | Remove unused duplicate variable |
| | `adminUserId`, `otherUserId` unused | Remove unused variables |
| | `handleApplicationSelect` unused (duplicate) | Remove function (actual one in ApplicationDialog) |
| **RegardingField.jsx** | `Typography` unused | Remove from imports |
| | `useEffect` deps | `// eslint-disable-next-line react-hooks/exhaustive-deps` |
| **Table.js** | `handleRowClick` unused | Remove function |
| **zohoApi/auth.js** | `resizeResp` | `await ZOHO.CRM.UI.Resize(...)` |
| **zohoApi/file.js** | `downloadAttachmentById2`, inner `downloadFile`, `downloadAttachmentResp` | Remove whole `downloadAttachmentById2` |
| | `sm != null` (loose equality) | Change to `sm !== null && sm !== undefined` |

---

## 4. Checklist for Similar CI / Vercel Failures

1. **Reproduce with CI mode locally:**
   ```bash
   CI=true npm run build
   # or
   $env:CI="true"; npm run build   # PowerShell
   ```

2. **Run ESLint in “warnings = errors” mode:**
   ```bash
   npx eslint src --max-warnings 0
   ```

3. **For each ESLint warning:**
   - **no-unused-vars:** Remove the symbol or use `[, setX]`, or `await fn()` without assigning.
   - **react-hooks/exhaustive-deps:** Either add the missing deps or add `// eslint-disable-next-line react-hooks/exhaustive-deps` with a short reason.
   - **eqeqeq:** Switch to `===` / `!==` (or a justified `== null` plus comment).

4. **Optional:** Add `@babel/plugin-proposal-private-property-in-object` (or the suggested replacement) to `devDependencies` if the build log suggests it to avoid future Babel warnings.

5. **Optional:** To avoid mixed lockfile warnings on Vercel, use one package manager: remove `package-lock.json` if using `yarn.lock`, or the opposite.

6. **Re-run before pushing:**
   ```bash
   npx eslint src --max-warnings 0
   CI=true npm run build
   ```

---

## 5. One-Line Reference

- **CI sets `CI=true`** → **react-scripts treats ESLint warnings as errors** → fix all `no-unused-vars`, `react-hooks/exhaustive-deps`, `eqeqeq` either by real fixes or targeted `eslint-disable-next-line` with a reason.

---

## 6. Recent Issues Fixed (Latest Build)

### Issue 1: Unused State Setters with Used Values

**Problem:**
- `setCurrentContact` in App.js was marked as unused, but `currentContact` value is actually used in the code
- `selectedApplicationId` in Dialog.js was marked as unused, but only the setter is used

**Solution:**
- For cases where the **value is used but setter is not**: Add eslint-disable comment explaining why:
  ```javascript
  // eslint-disable-next-line no-unused-vars -- setter not used but state value is needed
  const [currentContact, setCurrentContact] = React.useState(null);
  ```
- For cases where **only the setter is used**: Use empty slot pattern:
  ```javascript
  const [, setSelectedApplicationId] = React.useState(null);
  ```

### Issue 2: Loose Equality (`!=` / `==`) in Null Checks

**Problem:**
- ESLint `eqeqeq` rule requires strict equality (`===` / `!==`)
- Code used `!= null` which checks for both `null` and `undefined`, but ESLint wants explicit checks

**Solution:**
Replace loose equality with explicit strict checks:
```javascript
// Before
if (sm != null) { ... }
return id != null ? { id, name } : null;

// After
if (sm !== null && sm !== undefined) { ... }
return id !== null && id !== undefined ? { id, name } : null;
```

**Files Fixed:**
- `src/App.js` line 193: `id != null` → `id !== null && id !== undefined`
- `src/zohoApi/file.js` line 50: `sm != null` → `sm !== null && sm !== undefined`

### Issue 3: useCallback Dependency Issue

**Problem:**
- `fetchStakeholders` function in Stakeholder.jsx was causing `useCallback` dependencies to change on every render
- This triggered `react-hooks/exhaustive-deps` warning

**Solution:**
Wrap `fetchStakeholders` in its own `useCallback`:
```javascript
// Before
const fetchStakeholders = async (query) => { ... };
const handleInputChangeWithDebounce = useCallback(
  (event, newValue) => { ... },
  [fetchStakeholders]  // This changes every render
);

// After
const fetchStakeholders = useCallback(async (query) => { ... }, [ZOHO]);
const handleInputChangeWithDebounce = useCallback(
  (event, newValue) => { ... },
  [fetchStakeholders]  // Now stable
);
```

---

*Last updated for migration-solutions-stakeholder-history. Adapt file and symbol names to your project.*
