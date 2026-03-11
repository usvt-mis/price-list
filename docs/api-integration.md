# Azure Function API Integration

Documentation for Business Central integration via Azure Function APIs.

---

## Overview

Sales Quotes module integrates with Business Central through Azure Function APIs:
- **CreateSalesQuoteWithoutNumber** - Create sales quotes in BC
- **CreateServiceItem** - Create service items (New SER button)

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
- Line items in `state.quote.lines`
- Form data in individual state fields

### CreateServiceItem State
- `state.ui.serCreated` - Tracks if SER was created (Add Line modal)
- `state.ui.serCreatedEdit` - Tracks if SER was created (Edit Line modal)
- `state.ui.pendingSerCreation` - Tracks confirmation modal state
- `state.ui.pendingSerCreationEdit` - Tracks confirmation modal state (Edit mode)

---

## Related Files

- `src/js/salesquotes/create-quote.js` - Main implementation
- `src/js/salesquotes/ui.js` - UI state management
- `src/salesquotes/components/modals/add-line-modal.html` - Add Line modal
- `src/salesquotes/components/modals/edit-line-modal.html` - Edit Line modal
- `src/salesquotes/components/modals/confirm-new-ser-modal.html` - Confirmation modal
