# Save Feature Documentation

**Parent Documentation**: This guide is part of the CLAUDE.md documentation.
See [CLAUDE.md](../CLAUDE.md) for project overview and navigation.

---

## Overview

Allows users to save, load, edit, and share calculation records.

---

## Run Numbers

Year-based sequential format (e.g., 2024-001, 2024-002)

### Generation
- Generated via `GetNextRunNumber` stored procedure
- Uses `RunNumberSequence` table to track year-based sequential numbers
- Stored procedure participates in the caller's transaction (no inner transaction to avoid nesting issues)

---

## Access Control

### Viewing Records
- **Sales role**: See only their own records
- **Executive role**: See all records

### Editing Records
- Only creators can edit their own records
- Shared records are view-only for authenticated users

### Deleting Records
- Creators can delete their own records
- Executives can delete any record

---

## State Management

### Global Variables
- `currentSavedRecord` - Currently editing record (null = new calculation)
- `savedRecordsList` - Cached list of saved records
- `isDirty` - Tracks unsaved changes (shows "Save *" indicator)
- `isViewOnly` - View-only mode for shared records
- `selectedRecords` - Set of selected record IDs for batch operations

---

## UI Components

### Save Button
- Header button with dynamic state
- Shows "Save" for new calculations
- Shows "Update" when editing existing record
- Shows "Save *" indicator for unsaved changes (dirty state)

### My Records Button
- Access saved records list

### List View
- Card grid with filtering (search, sort, date range)
- **Record Cards**: Display run number, date, creator name, branch, motor type, job/material counts
- **Batch Selection**: Checkbox in top-left corner for multi-select operations
- **Visual Feedback**: Selected cards show blue ring highlight (`ring-2 ring-blue-500`)

### Detail View
- Read-only record display with Share/Edit/Delete actions
- Shows calculation metadata (branch, motor type, sales profit, travel distance)
- Lists all jobs with manhours and checked state
- Lists all materials with quantities
- Displays creator information

### Share Modal
- Copy share link to clipboard

### Save Success Modal
- Confirmation modal displayed after successful save
- Shows run number and timestamp
- Action buttons: View Record, Close

### Delete Success Modal
- Red-themed confirmation modal after deletion
- Shows run number and timestamp
- Done button

### Batch Delete Progress Modal
- Shows spinner, progress text, and progress bar
- Displays during sequential deletions

### Batch Delete Summary Modal
- Shows success/failure counts
- Appropriate icon styling

### Bulk Actions Bar
- Fixed bar (desktop: top, mobile: bottom)
- Selected count display
- "Select All" button (desktop only)
- "Clear Selection" button
- "Delete Selected" button with red styling

### Breadcrumb Navigation
- Format: Calculator > Records > 2024-001

---

## Key Functions (`src/index.html`)

### Serialization/Deserialization

#### `serializeCalculatorState()`
- Captures all calculator data (branch, motor type, jobs, materials, sales profit, travel)
- **Validation**:
  - Filters out invalid material rows: `materialId != null && !isNaN(unitCost) && unitCost >= 0`
  - Ensures quantity is integer: `Math.trunc(m.qty)`
- Provides frontend defense-in-depth validation to prevent SQL constraint violations

#### `deserializeCalculatorState(data)`
- Restores saved data and populates calculator

### Save/Load Operations

#### `saveCalculation()`
- Create or update record via API
- Enhanced error handling extracts detailed error messages from API responses
- Shows user-friendly notifications with specific error details

#### `loadSavedRecords()`
- Fetch user's records (role-filtered)

#### `loadSharedRecord(token)`
- Load shared record via URL parameter

### Rendering

#### `renderRecordsList()`
- Render filtered/sorted grid
- Generates record cards with `data-save-id` and `data-run-number` attributes
- Includes checkbox for batch selection with `onchange="toggleRecordSelection(saveId)"`
- Applies `ring-2 ring-blue-500` class to selected cards
- Calls `toggleBulkActions()` to show/hide bulk actions bar

#### `showView(viewName)`
- Navigate between views (calculator/list/detail)

### Sharing

#### `shareRecord(id, token)`
- Generate or show share link

### Delete Operations

#### `deleteRecord(saveId, runNumber)`
- Delete a saved record via API
- **Immediate visual feedback**: Card fades out (300ms opacity + scale animation) and is removed from DOM immediately
- **Rollback capability**: Card is cloned before deletion; restored if API call fails
- Handles HTTP 204 (No Content) as successful deletion (standard DELETE response)
- Enhanced error handling with specific messages for 403, 404, 401, and 500 status codes
- Diagnostic console logging for debugging (SaveId, response status, error body)
- Shows delete success modal with run number and timestamp
- Clears cache (`savedRecordsList = null`) immediately, then reloads in background (non-blocking)
- **Idempotent**: Already-deleted records return success without error

### Modal Functions

#### `showSaveSuccessModal(runNumber, saveId)`
- Display save success confirmation modal

#### `hideSaveSuccessModal()`
- Hide save success modal

#### `showDeleteSuccessModal(runNumber)`
- Display delete success confirmation modal with red-themed styling

#### `hideDeleteSuccessModal()`
- Hide delete success modal

### Batch Delete Functions

#### `toggleRecordSelection(saveId)`
- Toggle checkbox selection for individual records

#### `selectAllRecords()`
- Select all visible records in the grid

#### `deselectAllRecords()`
- Clear all selections

#### `toggleBulkActions()`
- Show/hide bulk actions bar based on selection count

#### `bulkDeleteRecords()`
- Delete multiple selected records with progress tracking
- Shows progress modal with spinner and progress bar
- Processes deletions sequentially (no backend changes required)
- Shows summary modal with success/failure counts
- Clears selection and refreshes list on completion

---

## Backend Implementation (`api/src/functions/savedCalculations.js`)

### Delete Operation
- Uses `DeleteSavedCalculation` stored procedure (from `database/fix_orphaned_records.sql`)
- Properly deletes child records (`SavedCalculationMaterials` and `SavedCalculationJobs`) before soft-deleting parent
- Returns counts of deleted materials and jobs
- Prevents orphaned records in child tables
- Accepts `@SaveId` and `@DeletedBy` parameters
- **Idempotent**: Already-deleted records return success without error
- **Error handling**: Checks stored procedure result set for `Status: 'Error'` and returns appropriate 500 response
- Stored procedure returns error info as result set instead of throwing (prevents 500 after successful error info return)

### Material Validation (POST and PUT handlers)
- `materialId` must exist in Materials table and be active (`IsActive = 1`)
- `unitCost` must be non-null, non-NaN, and >= 0
- `quantity` must be a non-negative integer
- Returns clear error messages for each validation failure (e.g., "MaterialId 123 does not exist or is inactive")
- Prevents 500 errors by catching validation issues before database operations

---

## Sharing

### Share URL Format
```
/?share=<token>
```
- Token is UUID v4
- Requires authentication to access shared records
- Shared records are view-only (no editing)
- URL parameter is cleaned after loading (via `history.replaceState`)

---

## Unsaved Changes Tracking

### Dirty State
- `markDirty()` called on any input change
- Save button shows "Save *" indicator for unsaved changes
- Only tracks dirty state for new calculations (not when editing existing)

---

## List View Filters

### Search
- Search by run number (case-insensitive)

### Sort
- Sort by date (newest/oldest first)
- Sort by amount (highest/lowest)

### Date Range
- All time
- Today
- This week
- This month
- This year

---

## Record Detail View

### Display Information
- Calculation metadata (branch, motor type, sales profit, travel distance)
- All jobs with manhours and checked state
- All materials with quantities
- Creator information

### Actions
- **Share button**: Generates shareable link
- **Edit button**: (visible to creator only) loads record into calculator
- **Back button**: Returns to list or calculator depending on context
