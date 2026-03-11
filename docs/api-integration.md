# Azure Function API Integration

Documentation for Business Central integration via Azure Function APIs.

---

## Overview

Sales Quotes module integrates with Business Central through Azure Function APIs:
- **CreateSalesQuoteWithoutNumber** - Create sales quotes in BC
- **CreateServiceItem** - Create service items (New SER button)
- **CreateServiceOrderFromSQ** - Create service orders from sales quote (automatic after quote creation)

**Base URL**: `https://func-api-gateway-prod-uat-f7ffhjejehcmbued.southeastasia-01.azurewebsites.net/api`

---

## CreateSalesQuoteWithoutNumber

Create sales quotes in Business Central with line items.

### Endpoint
```
POST /api/CreateSalesQuoteWithoutNumber
```

### Headers
```
Content-Type: application/json
x-functions-key: <API_KEY>
```

### Request Body

```javascript
{
  customerNo: string,           // From state.quote.customerNo
  workDescription: string,      // From quote work description field
  responsibilityCenter: string, // From BRANCH field (auto-populated)
  assignedUserId: string,       // From assigned user search selection
  salespersonCode: string,      // From salesperson search selection
  serviceOrderType: string,     // From service order type dropdown
  contactName: string,          // From contact field
  division: string,             // From Division dropdown (MS1029, EL1017, PS1029, GT1029)
  branchCode: string,           // From state.quote.branch (auto-populated)
  discountAmount: number,       // From invoice discount field
  lineItems: [                  // Quote line items
    {
      lineType: "Item" | "Comment",
      lineObjectNumber: string,        // Material code from search
      description: string,
      quantity: number,
      unitPrice: number,
      discountPercent: number,
      usvtGroupNo: string,             // Group number
      usvtServiceItemNo: string,       // Service item number
      usvtServiceItemDescription: string,
      usvtCreateSv: boolean,           // New SER button state
      usvtAddition: boolean,           // Addition checkbox
      usvtRefSalesQuoteno: string,     // Reference sales quote number
      discountAmount: number
    }
  ]
}
```

### Response

```javascript
{
  number: string,               // Quote Number created in BC (e.g., "SO-12345")
  // ... other fields
}
```

### Implementation

**Location**: `src/js/salesquotes/create-quote.js`

**Functions:**
- `sendQuoteToAzureFunction()` - Handles API call with proper headers and error handling
- `handleSendQuote()` - Orchestrates validation, sanitization, and API submission

**Success Flow:**
1. Validate all required fields
2. Sanitize line item data
3. Send POST request to Azure Function
4. Extract Quote Number from response
5. Show custom success modal with Quote Number
6. Clear all form data

---

## CreateServiceItem

Create Service Items in Business Central (triggered by "New SER" button).

### Endpoint
```
POST /api/CreateServiceItem
```

### Headers
```
Content-Type: application/json
x-functions-key: <API_KEY>
```

### Request Body

**IMPORTANT**: The request body MUST be an array, even when creating a single service item.

```javascript
[{
  description: string,      // Service Item Description from user input (required)
  item_No: string,          // Hardcoded as "SERV-ITEM"
  Customer_Number: string,  // Customer number from state.quote.customerNo (optional)
  Group_No: string          // Group number from lineUsvtGroupNo field (defaults to '1')
}]
```

### Response

```javascript
{
  success: boolean,
  message: string,
  result: {
    Results: [{
      ServiceItemNo: string,  // Service Item Number created in BC (e.g., "SER0036079")
      GroupNo: string,
      Success: boolean,
      Error: string | null
    }],
    TotalCount: number,
    SuccessCount: number,
    FailureCount: number
  }
}
```

### Implementation

**Location**: `src/js/salesquotes/create-quote.js`

**Functions:**
- `createServiceItem(description, customerNo, groupNo)` - Handles API call
- `createServiceItemAndLockFields()` - Locks fields after successful creation
- `showConfirmNewSerModal()` / `hideConfirmNewSerModal()` - Confirmation modal
- `confirmNewSerCreation()` / `cancelNewSerCreation()` - Modal actions

**Workflow:**
1. User clicks "New SER" button
2. Validate Service Item Description is not empty
3. Show confirmation modal with description
4. User confirms → Call API
5. On success: Auto-populate Serv. Item No. field, lock related fields, disable button
6. On error: Show toast notification, re-enable button

**Field Locking After Creation:**
- Serv. Item No., Serv. Item Desc., and Type fields become locked (disabled, gray background)
- New SER button shows "✓ Created" state
- Type dropdown cannot be changed

**Edit Line Modal - Existing Service Item:**
When editing a line that already has a Service Item No:
- Type, Serv. Item No., and Serv. Item Desc. fields are locked (disabled, gray background)
- New SER button is disabled and shows "✓ Created"
- Prevents accidental modification of Service Item-related fields
- `state.ui.editLineLocked` flag tracks this state

---

## CreateServiceOrderFromSQ

Create Service Orders from a Sales Quote (automatically called after successful quote creation).

### Endpoint
```
POST /api/CreateServiceOrderFromSQ
```

### Headers
```
Content-Type: application/json
x-functions-key: <API_KEY>
```

### Request Body

**IMPORTANT**: The request body MUST be an array with one entry per unique Group No from the quote lines.

```javascript
[{
  salesQuoteId: string,    // Quote Number returned from CreateSalesQuoteWithoutNumber
  branchCode: string,      // Branch code (e.g., "URY", "USB", "USR")
  GroupNo: number          // Group number from quote line (integer)
}]
```

**Example:**
```javascript
// If quote has lines with Group Nos: 1, 2, 1, 3
// Unique Group Nos: 1, 2, 3
// Payload:
[
  { salesQuoteId: "SQRY2602-0032", branchCode: "URY", GroupNo: 1 },
  { salesQuoteId: "SQRY2602-0032", branchCode: "URY", GroupNo: 2 },
  { salesQuoteId: "SQRY2602-0032", branchCode: "URY", GroupNo: 3 }
]
```

### Response

```javascript
{
  success: boolean,
  message: string,
  processedAt: string,      // ISO timestamp
  salesQuoteId: string,     // Echo of input
  result: {
    serviceOrderNo: string,        // Service Order Number created in BC (e.g., "SVRY2512-0013")
    serviceOrderLinesCreated: number,
    serviceOrderLinesStatus: string,
    statusCode: number,
    success: boolean
  }
}
```

### Implementation

**Location**: `src/js/salesquotes/create-quote.js`

**Functions:**
- `createServiceOrderFromSQ(salesQuoteId, branchCode)` - Handles API call

**Workflow (Automatic):**
1. After `CreateSalesQuoteWithoutNumber` succeeds
2. Extract unique Group No values from `state.quote.lines`
3. Build payload array (one entry per unique Group No)
4. Call `CreateServiceOrderFromSQ` API
5. Extract Service Order No from response
6. Display in success modal alongside Quote Number

**Error Handling:**
- If Service Order creation fails, quote creation still succeeds
- Modal shows Quote Number only (Service Order No section hidden)
- Error logged to console for debugging

**Success Modal Update:**
- Quote Number displayed in green (emerald) section
- Service Order No displayed in blue section below (if created)
- Both numbers clearly labeled with color-coded backgrounds

---

## Error Handling

Both APIs implement comprehensive error handling:

1. **Network Errors**: Caught and displayed as toast notifications
2. **API Errors**: Parsed from response and shown to user
3. **Validation Errors**: Checked before API call (e.g., empty description)
4. **Loading States**: Button shows "Creating..." during API call

---

## State Management

### CreateSalesQuote State
- Quote data stored in `state.quote`
- Line items in `state.quote.lines` (includes `usvtGroupNo` for Service Order creation)
- Form data in individual state fields

### CreateServiceItem State
- `state.ui.serCreated` - Tracks if SER was created (Add Line modal)
- `state.ui.serCreatedEdit` - Tracks if SER was created (Edit Line modal)
- `state.ui.pendingSerCreation` - Tracks confirmation modal state
- `state.ui.pendingSerCreationEdit` - Tracks confirmation modal state (Edit mode)
- `state.ui.editLineLocked` - Tracks if Edit Line fields are locked due to existing Service Item No

### CreateServiceOrderFromSQ State
- No additional state required (uses `state.quote.lines` for Group No extraction)
- Service Order No passed directly to `showQuoteCreatedSuccess()` function

---

## Related Files

- `src/js/salesquotes/create-quote.js` - Main implementation
- `src/js/salesquotes/ui.js` - UI state management
- `src/salesquotes/components/modals/add-line-modal.html` - Add Line modal
- `src/salesquotes/components/modals/edit-line-modal.html` - Edit Line modal
- `src/salesquotes/components/modals/confirm-new-ser-modal.html` - Confirmation modal
- `src/salesquotes/components/modals/quote-created-modal.html` - Success modal (shows Quote No + Service Order No)
