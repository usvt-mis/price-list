/**
 * Sales Quotes UI Components
 * BC-style UI components and helpers for Sales Quotes module
 */

import { state } from './state.js';
import { BC_UI_CONFIG } from './config.js';
import { SALES_QUOTES_PREFERENCE_KEYS, loadSalesQuotePreference, saveSalesQuotePreference } from './preferences.js';
import { authState } from '../state.js';

// Import APPROVAL_STATUS dynamically when needed to avoid circular dependency
let APPROVAL_STATUS = null;
async function getApprovalStatus() {
  if (!APPROVAL_STATUS) {
    const module = await import('./approvals.js');
    APPROVAL_STATUS = module.APPROVAL_STATUS;
  }
  return APPROVAL_STATUS;
}

// ============================================================
// DOM Element Helpers
// ============================================================

/**
 * Get DOM element by ID
 */
export function el(id) {
  return document.getElementById(id);
}

/**
 * Get all elements by selector
 */
export function els(selector) {
  return document.querySelectorAll(selector);
}

/**
 * Set value for either a form field or a read-only display element
 */
export function setFieldValue(id, value) {
  const element = el(id);
  if (!element) {
    return;
  }

  const nextValue = value ?? '';
  if ('value' in element) {
    element.value = nextValue;
    return;
  }

  element.dataset.value = nextValue;
  element.textContent = nextValue;
}

/**
 * Get value from either a form field or a read-only display element
 */
export function getFieldValue(id) {
  const element = el(id);
  if (!element) {
    return '';
  }

  if ('value' in element) {
    return element.value || '';
  }

  return element.dataset.value || '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// Format Helpers
// ============================================================

/**
 * Format number with comma separators and 2 decimal places
 * @param {number} num - The number to format
 * @returns {string} Formatted number with commas (e.g., "1,234.56")
 */
export function formatCurrency(num) {
  if (typeof num !== 'number' || isNaN(num)) {
    return '0.00';
  }
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Show element
 */
export function show(id) {
  const element = el(id);
  if (element) {
    element.classList.remove('hidden');
  }
}

/**
 * Hide element
 */
export function hide(id) {
  const element = el(id);
  if (element) {
    element.classList.add('hidden');
  }
}

/**
 * Toggle element visibility
 */
export function toggle(id, visible) {
  if (visible) {
    show(id);
  } else {
    hide(id);
  }
}

// ============================================================
// Loading States
// ============================================================

function setLoadingOverlayContent(title = 'Processing', message = 'Loading...') {
  const titleEl = el('loadingTitle');
  const messageEl = el('loadingMessage');

  if (titleEl) {
    titleEl.textContent = title;
  }

  if (messageEl) {
    messageEl.textContent = message;
  }
}

/**
 * Show loading overlay
 */
export function showLoading(message = 'Loading...', title = 'Processing') {
  const overlay = el('loadingOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    overlay.style.zIndex = '150'; // Highest z-index for loading
  }
  setLoadingOverlayContent(title, message);
  state.ui.loading = true;
}

/**
 * Hide loading overlay
 */
export function hideLoading() {
  const overlay = el('loadingOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
  setLoadingOverlayContent('Processing', 'Loading...');
  state.ui.loading = false;
}

/**
 * Show saving state
 */
export function showSaving(title = 'Sending Quote', message = 'Sending quote to Business Central...') {
  showLoading(message, title);
  state.ui.saving = true;
}

/**
 * Hide saving state
 */
export function hideSaving() {
  hideLoading();
  state.ui.saving = false;
}

// ============================================================
// Toast Notifications
// ============================================================

/**
 * Show toast notification
 */
export function showToast(message, type = 'success') {
  const container = el('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // Add icon based on type
  const icon = type === 'success'
    ? '<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
    : '<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';

  toast.innerHTML = `${icon}<span>${message}</span>`;

  container.appendChild(toast);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.remove();
  }, 3000);

  console.log(`[${type.toUpperCase()}] ${message}`);
}

/**
 * Show success toast
 */
export function showSuccess(message) {
  showToast(message, 'success');
  state.ui.success = message;
}

/**
 * Show error toast
 */
export function showError(message) {
  showToast(message, 'error');
  state.ui.error = message;
  console.error('UI Error:', message);
}

/**
 * Clear all notifications
 */
export function clearToasts() {
  const container = el('toastContainer');
  if (container) {
    container.innerHTML = '';
  }
  state.ui.error = null;
  state.ui.success = null;
}

// ============================================================
// Tab Navigation
// ============================================================

/**
 * Switch between tabs
 */
export function switchTab(tabName) {
  // Update tab buttons
  els('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });
  el(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`)?.classList.add('active');

  // Update views
  els('.view').forEach(view => {
    view.classList.add('hidden');
  });
  el(`${tabName}View`)?.classList.remove('hidden');

  state.currentView = tabName;

  // Load approvals list when approvals tab is activated
  if (tabName === 'approvals') {
    // Dynamically import and load approvals
    import('./approvals.js').then(async (module) => {
      await module.loadPendingApprovals();
      await module.loadMyApprovalRequests();
    }).catch(err => {
      console.error('Failed to load approvals:', err);
    });
  }

  // Load records when records tab is activated
  if (tabName === 'records') {
    // Dynamically import and load records
    import('./records.js').then(async (module) => {
      await module.loadQuoteSubmissionRecords();
    }).catch(err => {
      console.error('Failed to load records:', err);
    });
  }
}

// ============================================================
// Customer Dropdown
// ============================================================

/**
 * Render customer dropdown
 */
export function renderCustomerDropdown(customers) {
  const dropdown = el('customerDropdown');
  if (!dropdown) return;

  if (customers.length === 0) {
    dropdown.innerHTML = '<div class="search-dropdown-item text-gray-500">No customers found</div>';
  } else {
    dropdown.innerHTML = customers.map(customer => `
      <div class="search-dropdown-item" onclick="window.selectCustomer('${customer.id}')">
        <div class="font-medium">${customer.name}</div>
        <div class="text-sm text-gray-600">${customer.number}</div>
      </div>
    `).join('');
  }

  dropdown.classList.remove('hidden');
}

/**
 * Hide customer dropdown
 */
export function hideCustomerDropdown() {
  const dropdown = el('customerDropdown');
  if (dropdown) {
    dropdown.classList.add('hidden');
  }
}

/**
 * Display selected customer
 */
export function displaySelectedCustomer(customer) {
  const display = el('selectedCustomerDisplay');
  const details = el('customerDetails');

  if (!customer || !display || !details) return;

  display.classList.remove('hidden');
  details.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
      <div><span class="font-medium">Customer:</span> ${customer.name}</div>
      <div><span class="font-medium">Number:</span> ${customer.number}</div>
      ${customer.address ? `<div class="md:col-span-2"><span class="font-medium">Address:</span> ${customer.address}</div>` : ''}
      ${customer.phone ? `<div><span class="font-medium">Phone:</span> ${customer.phone}</div>` : ''}
      ${customer.email ? `<div><span class="font-medium">Email:</span> ${customer.email}</div>` : ''}
    </div>
  `;
}

/**
 * Clear customer selection
 */
export function clearCustomerSelection() {
  const searchInput = el('customerSearch');
  const customerNoSearch = el('customerNoSearch');
  const customerName = el('customerName');
  const display = el('selectedCustomerDisplay');
  const sellToSection = el('sellToSection');

  ['sellToAddress', 'sellToAddress2', 'sellToCity', 'sellToPostCode', 'sellToVatRegNo', 'sellToTaxBranchNo'].forEach(fieldId => {
    setFieldValue(fieldId, '');
  });

  if (searchInput) searchInput.value = '';
  if (customerNoSearch) customerNoSearch.value = '';
  if (customerName) customerName.value = '';
  if (display) display.classList.add('hidden');
  if (sellToSection) sellToSection.classList.add('hidden');

  state.quote.customerId = null;
  state.quote.customer = null;
  state.quote.customerNo = null;
  state.quote.customerName = null;
  state.quote.sellTo = {
    address: null,
    address2: null,
    city: null,
    postCode: null,
    vatRegNo: null,
    taxBranchNo: null
  };
  state.formData.selectedCustomer = null;
}

// ============================================================
// Item Dropdown
// ============================================================

/**
 * Render item dropdown
 */
export function renderItemDropdown(items) {
  const dropdown = el('itemDropdown');
  if (!dropdown) return;

  if (items.length === 0) {
    dropdown.innerHTML = '<div class="search-dropdown-item text-gray-500">No items found</div>';
  } else {
    dropdown.innerHTML = items.map(item => `
      <div class="search-dropdown-item" onclick="window.selectItem('${item.id}')">
        <div class="font-medium">${item.description}</div>
        <div class="text-sm text-gray-600">${item.number} - ${item.unitPrice.toFixed(2)}</div>
      </div>
    `).join('');
  }

  dropdown.classList.remove('hidden');
}

/**
 * Hide item dropdown
 */
export function hideItemDropdown() {
  const dropdown = el('itemDropdown');
  if (dropdown) {
    dropdown.classList.add('hidden');
  }
}

// ============================================================
// Quote Lines Table
// ============================================================

const QUOTE_LINE_LAYOUT_HINT_DEFAULT = 'Drag column headers to rearrange. Layout saves automatically for your user.';
const QUOTE_LINE_DRAG_STATE = {
  draggedColumnId: null
};

function isSearchSalesQuoteEditorMode() {
  return state.quote.mode === 'edit' && Boolean(state.quote.number) && state.quote.loadedFromBc;
}

function hasPendingRevisionRequestState() {
  return state.approval.currentStatus === 'Approved' &&
    state.approval.hasPendingRevisionRequest === true;
}

let lastRequestRevisionVisibilityLogSignature = '';

export function isCurrentUserApprovalOwner() {
  const currentUserEmail = authState.user?.email?.trim().toLowerCase();
  const approvalOwnerEmail = (state.approval.approvalOwnerEmail || state.approval.salespersonEmail || '')
    .trim()
    .toLowerCase();

  return Boolean(currentUserEmail) &&
    Boolean(approvalOwnerEmail) &&
    currentUserEmail === approvalOwnerEmail;
}

function logRequestRevisionVisibilityDecision({
  requestRevisionBtn,
  isSearchSalesQuoteMode,
  approvalStatus,
  approvedStatus,
  canUseRevisionRequest,
  pendingRevisionRequest,
  showRequestRevision
}) {
  const currentUserEmail = authState.user?.email?.trim().toLowerCase() || '';
  const approvalOwnerEmail = (state.approval.approvalOwnerEmail || state.approval.salespersonEmail || '')
    .trim()
    .toLowerCase();
  const reasons = [];

  if (!requestRevisionBtn) {
    reasons.push('button element not found');
  }
  if (!isSearchSalesQuoteMode) {
    reasons.push('not in searched Sales Quote mode');
  }
  if (approvalStatus !== approvedStatus) {
    reasons.push(`approval status is "${approvalStatus || 'null'}" instead of "${approvedStatus}"`);
  }
  if (!canUseRevisionRequest) {
    reasons.push('current user is not the approval owner');
  }
  if (pendingRevisionRequest) {
    reasons.push('a revision request is already pending approval');
  }
  if (showRequestRevision) {
    reasons.push('all show conditions passed');
  }

  const payload = {
    quoteNumber: state.quote.number || '',
    quoteMode: state.quote.mode || '',
    buttonFound: Boolean(requestRevisionBtn),
    isSearchSalesQuoteMode,
    approvalStatus: approvalStatus || null,
    expectedApprovalStatus: approvedStatus,
    currentUserEmail,
    approvalOwnerEmail,
    canUseRevisionRequest,
    pendingRevisionRequest,
    willShow: showRequestRevision,
    reasons
  };
  const signature = JSON.stringify(payload);

  if (signature === lastRequestRevisionVisibilityLogSignature) {
    return;
  }

  lastRequestRevisionVisibilityLogSignature = signature;
  console.log('[REVISE BUTTON] visibility decision', payload);
}

export function isQuoteEditable() {
  return !isSearchSalesQuoteEditorMode() || state.approval.canEdit !== false;
}

export function getQuoteEditLockMessage() {
  if (state.approval.currentStatus === 'Approved') {
    if (hasPendingRevisionRequestState()) {
      return 'Revision request already submitted. Awaiting Sales Director approval.';
    }

    return 'Approved quotes are read-only. Use Revise to request editing access.';
  }

  if (state.approval.currentStatus === 'PendingApproval') {
    return 'This quote is awaiting approval and cannot be edited.';
  }

  return 'This quote cannot be edited in its current approval status.';
}

function canModifyQuoteLines() {
  return isQuoteEditable();
}

function setMainFormFieldLocked(element, locked, title) {
  if (!element) {
    return;
  }

  if ('disabled' in element) {
    element.disabled = locked;
  }

  if ('readOnly' in element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
    element.readOnly = locked;
  }

  element.classList.toggle('bg-slate-50', locked);
  element.classList.toggle('text-slate-600', locked);
  element.classList.toggle('cursor-not-allowed', locked);

  if (locked && title) {
    element.setAttribute('title', title);
  } else {
    element.removeAttribute('title');
  }
}

function setActionButtonLocked(element, locked, title) {
  if (!element) {
    return;
  }

  element.disabled = locked;
  element.classList.toggle('opacity-60', locked);
  element.classList.toggle('cursor-not-allowed', locked);

  if (locked && title) {
    element.setAttribute('title', title);
  } else {
    element.removeAttribute('title');
  }
}

function updateQuoteEditorFormLockState(locked, title) {
  [
    'orderDate',
    'requestedDeliveryDate',
    'contact',
    'salesPhoneNo',
    'salesEmail',
    'salespersonCodeSearch',
    'assignedUserIdSearch',
    'serviceOrderType',
    'division',
    'workStatus',
    'quoteWorkDescription',
    'invoiceDiscount',
    'invoiceDiscountPercent'
  ].forEach(fieldId => {
    setMainFormFieldLocked(el(fieldId), locked, title);
  });

  setActionButtonLocked(el('addLineBtn'), locked, title);
  setActionButtonLocked(el('fabAddLine'), locked, title);
  setActionButtonLocked(el('insertLineAtStartBtn'), locked, title);
}

function renderQuoteLineFlagToggle(line, fieldName, { disabled = false, title = '' } = {}) {
  const isChecked = fieldName === 'showInDocument'
    ? line.showInDocument !== false
    : Boolean(line[fieldName]);
  const disabledAttr = disabled ? 'disabled' : '';
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';

  return `
    <label class="toggle-switch toggle-switch-sm"${titleAttr} onclick="event.stopPropagation()" ondblclick="event.stopPropagation()">
      <input
        type="checkbox"
        aria-label="${escapeHtml(fieldName)}"
        ${isChecked ? 'checked' : ''}
        ${disabledAttr}
        onchange="window.toggleQuoteLinePrintFlag('${line.id}', '${fieldName}', this.checked)"
      >
      <span class="toggle-slider"></span>
    </label>
  `;
}

const QUOTE_LINE_COLUMNS = [
  {
    id: 'sequence',
    label: '#',
    width: '40px',
    headerClass: 'text-center',
    cellClass: 'font-medium text-center',
    render: (line) => `${line.sequence}`
  },
  {
    id: 'lineType',
    label: 'Type',
    width: '80px',
    cellClass: 'text-sm',
    render: (line) => line.lineType || '-'
  },
  {
    id: 'usvtServiceItemNo',
    label: 'Serv. Item No.',
    width: '120px',
    cellClass: 'text-sm',
    render: (line) => line.usvtServiceItemNo || ''
  },
  {
    id: 'usvtServiceItemDescription',
    label: 'Serv. Item Desc.',
    width: '150px',
    cellClass: 'text-sm',
    render: (line) => line.usvtServiceItemDescription || ''
  },
  {
    id: 'usvtGroupNo',
    label: 'Group No.',
    width: '80px',
    headerClass: 'text-center',
    cellClass: 'text-sm text-center',
    render: (line) => line.usvtGroupNo || ''
  },
  {
    id: 'showInDocument',
    label: 'Show',
    width: '78px',
    headerClass: 'text-center',
    cellClass: 'text-center',
    isVisible: () => isSearchSalesQuoteEditorMode(),
    render: (line) => renderQuoteLineFlagToggle(line, 'showInDocument', {
      disabled: !canModifyQuoteLines(),
      title: canModifyQuoteLines() ? 'Show or hide this line in print' : getQuoteEditLockMessage()
    })
  },
  {
    id: 'printHeader',
    label: 'Header',
    width: '84px',
    headerClass: 'text-center',
    cellClass: 'text-center',
    isVisible: () => isSearchSalesQuoteEditorMode(),
    render: (line) => {
      const editable = canModifyQuoteLines();
      const isVisibleInPrint = line.showInDocument !== false;

      return renderQuoteLineFlagToggle(line, 'printHeader', {
        disabled: !editable || !isVisibleInPrint,
        title: !editable
          ? getQuoteEditLockMessage()
          : (isVisibleInPrint ? 'Mark this line as the group header for print' : 'Enable Show before assigning Header')
      });
    }
  },
  {
    id: 'printFooter',
    label: 'Footer',
    width: '84px',
    headerClass: 'text-center',
    cellClass: 'text-center',
    isVisible: () => isSearchSalesQuoteEditorMode(),
    render: (line) => {
      const editable = canModifyQuoteLines();
      const isVisibleInPrint = line.showInDocument !== false;

      return renderQuoteLineFlagToggle(line, 'printFooter', {
        disabled: !editable || !isVisibleInPrint,
        title: !editable
          ? getQuoteEditLockMessage()
          : (isVisibleInPrint ? 'Mark this line as the group footer for print' : 'Enable Show before assigning Footer')
      });
    }
  },
  {
    id: 'lineObjectNumber',
    label: 'No.',
    width: '150px',
    cellClass: 'text-sm font-medium',
    render: (line) => line.lineObjectNumber || '-'
  },
  {
    id: 'description',
    label: 'Description',
    width: '350px',
    cellClass: 'text-sm',
    render: (line) => line.description || ''
  },
  {
    id: 'quantity',
    label: 'Qty.',
    width: '70px',
    headerClass: 'text-center',
    cellClass: 'text-sm text-center',
    render: (line) => `${line.quantity}`
  },
  {
    id: 'unitPrice',
    label: 'Unit Price',
    width: '100px',
    headerClass: 'text-right',
    cellClass: 'text-sm text-right',
    render: (line) => formatCurrency(parseFloat(line.unitPrice))
  },
  {
    id: 'usvtAddition',
    label: 'Add',
    width: '60px',
    headerClass: 'text-center',
    cellClass: 'text-center',
    render: (line) => `
      <label class="toggle-switch" style="transform: scale(0.85);">
        <input type="checkbox" ${line.usvtAddition ? 'checked' : ''} disabled>
        <span class="toggle-slider"></span>
      </label>
    `
  },
  {
    id: 'usvtRefSalesQuoteno',
    label: 'Ref. SQ No.',
    width: '130px',
    cellClass: 'text-sm',
    render: (line) => line.usvtRefSalesQuoteno || ''
  },
  {
    id: 'discountPercent',
    label: 'Disc. %',
    width: '80px',
    headerClass: 'text-right',
    cellClass: 'text-sm text-right',
    render: (line) => `${parseFloat(line.discountPercent || 0).toFixed(1)}%`
  },
  {
    id: 'discountAmount',
    label: 'Discount Amt.',
    width: '90px',
    headerClass: 'text-right',
    cellClass: 'text-sm text-right',
    render: (line) => formatCurrency(parseFloat(line.discountAmount || 0))
  },
  {
    id: 'lineTotal',
    label: 'Line Total',
    width: '100px',
    headerClass: 'text-right',
    cellClass: 'font-bold text-gray-900 text-right',
    render: (line) => formatCurrency(calculateLineTotal(line))
  },
  {
    id: 'usvtRefServiceOrderNo',
    label: 'Ref. SV No.',
    width: '170px',
    cellClass: 'text-sm',
    isVisible: () => isSearchSalesQuoteEditorMode(),
    render: (line) => line.usvtRefServiceOrderNo || ''
  },
  {
    id: 'actions',
    label: 'Actions',
    width: '100px',
    cellClass: 'whitespace-nowrap',
    render: (line, index) => canModifyQuoteLines()
      ? `
        <div class="flex gap-1">
          <button class="sq-inline-action text-xs font-medium" onclick="window.openEditLineModal('${line.id}')">Edit</button>
          <button class="sq-inline-action text-xs font-medium" onclick="window.openInsertLineModal(${index})">Insert</button>
          <button class="sq-inline-action sq-inline-action-danger text-xs font-medium" onclick="window.removeQuoteLine(${index})">Remove</button>
        </div>
      `
      : '<span class="text-xs font-medium text-slate-400">Locked</span>'
  }
];

const QUOTE_LINE_COLUMNS_BY_ID = new Map(
  QUOTE_LINE_COLUMNS.map(column => [column.id, column])
);

const DEFAULT_QUOTE_LINE_COLUMN_ORDER = QUOTE_LINE_COLUMNS.map(column => column.id);

let quoteLineHintResetTimer = null;

function sanitizeQuoteLineColumnOrder(order) {
  const requestedOrder = Array.isArray(order) ? order : [];
  const normalizedOrder = [];

  requestedOrder.forEach(columnId => {
    if (QUOTE_LINE_COLUMNS_BY_ID.has(columnId) && !normalizedOrder.includes(columnId)) {
      normalizedOrder.push(columnId);
    }
  });

  DEFAULT_QUOTE_LINE_COLUMN_ORDER.forEach(columnId => {
    if (!normalizedOrder.includes(columnId)) {
      const defaultIndex = DEFAULT_QUOTE_LINE_COLUMN_ORDER.indexOf(columnId);
      const nextKnownColumnId = DEFAULT_QUOTE_LINE_COLUMN_ORDER
        .slice(defaultIndex + 1)
        .find(nextColumnId => normalizedOrder.includes(nextColumnId));

      if (!nextKnownColumnId) {
        normalizedOrder.push(columnId);
        return;
      }

      const insertIndex = normalizedOrder.indexOf(nextKnownColumnId);
      normalizedOrder.splice(insertIndex, 0, columnId);
    }
  });

  return normalizedOrder;
}

function getQuoteLineColumnOrder() {
  return sanitizeQuoteLineColumnOrder(state.ui.quoteLineColumnOrder);
}

function setQuoteLineColumnOrder(order) {
  state.ui.quoteLineColumnOrder = sanitizeQuoteLineColumnOrder(order);
  updateQuoteLineLayoutControls();
}

function isDefaultQuoteLineColumnOrder(order = getQuoteLineColumnOrder()) {
  return DEFAULT_QUOTE_LINE_COLUMN_ORDER.every((columnId, index) => columnId === order[index]);
}

function setQuoteLineLayoutHint(message = QUOTE_LINE_LAYOUT_HINT_DEFAULT, tone = 'muted') {
  const hint = el('quoteLineLayoutHint');
  if (!hint) {
    return;
  }

  hint.textContent = message;
  hint.classList.remove('text-slate-500', 'text-emerald-600', 'text-rose-600');

  if (tone === 'success') {
    hint.classList.add('text-emerald-600');
  } else if (tone === 'error') {
    hint.classList.add('text-rose-600');
  } else {
    hint.classList.add('text-slate-500');
  }

  if (quoteLineHintResetTimer) {
    clearTimeout(quoteLineHintResetTimer);
    quoteLineHintResetTimer = null;
  }

  if (message !== QUOTE_LINE_LAYOUT_HINT_DEFAULT) {
    quoteLineHintResetTimer = setTimeout(() => {
      setQuoteLineLayoutHint();
    }, 2400);
  }
}

function updateQuoteLineLayoutControls() {
  const isDefault = isDefaultQuoteLineColumnOrder();

  ['resetQuoteLineColumnsBtn', 'resetQuoteLineColumnsBtnFullscreen'].forEach(buttonId => {
    const button = el(buttonId);
    if (button) {
      button.disabled = isDefault;
    }
  });
}

function getOrderedQuoteLineColumns() {
  return getQuoteLineColumnOrder()
    .map(columnId => QUOTE_LINE_COLUMNS_BY_ID.get(columnId))
    .filter(column => column && (typeof column.isVisible !== 'function' || column.isVisible()));
}

function getQuoteLineHeaderMarkup(column) {
  const headerClass = column.headerClass ? ` ${column.headerClass}` : '';

  return `
    <th
      class="quote-line-column-header is-draggable${headerClass}"
      style="width: ${column.width};"
      data-column-id="${column.id}"
      draggable="true"
      title="Drag to move column"
    >
      <div class="quote-line-column-header-content">
        <span class="quote-line-column-title">
          <svg class="quote-line-column-handle h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h.01M8 12h.01M8 17h.01M16 7h.01M16 12h.01M16 17h.01"></path>
          </svg>
          <span>${column.label}</span>
        </span>
      </div>
    </th>
  `;
}

function renderQuoteLineHeaders() {
  const headerMarkup = `<tr>${getOrderedQuoteLineColumns().map(getQuoteLineHeaderMarkup).join('')}</tr>`;

  ['linesTableHead', 'fullscreenLinesTableHead'].forEach(headerId => {
    const header = el(headerId);
    if (!header) {
      return;
    }

    header.innerHTML = headerMarkup;
    attachQuoteLineHeaderDragHandlers(header);
  });
}

function renderQuoteLineCell(column, line, index) {
  const cellClass = column.cellClass ? ` ${column.cellClass}` : '';
  return `<td class="${cellClass.trim()}">${column.render(line, index)}</td>`;
}

function renderQuoteLineRow(line, index, rowClass) {
  const cells = getOrderedQuoteLineColumns()
    .map(column => renderQuoteLineCell(column, line, index))
    .join('');
  const isEditable = canModifyQuoteLines();
  const interactiveClassName = isEditable ? ' row-double-clickable' : '';
  const dblClickHandler = isEditable ? ` ondblclick="window.openEditLineModal('${line.id}')"` : '';

  return `
    <tr class="${rowClass}${interactiveClassName}"${dblClickHandler}>
      ${cells}
    </tr>
  `;
}

function renderQuoteLineBody(tableBodyId, emptyStateId) {
  const tbody = el(tableBodyId);
  const noLinesMessage = el(emptyStateId);

  if (!tbody) {
    return;
  }

  if (state.quote.lines.length === 0) {
    tbody.innerHTML = '';
    if (noLinesMessage) {
      noLinesMessage.classList.remove('hidden');
    }
    return;
  }

  if (noLinesMessage) {
    noLinesMessage.classList.add('hidden');
  }

  tbody.innerHTML = state.quote.lines.map((line, index) => {
    const rowClass = index % 2 === 0 ? 'bg-white' : 'bg-slate-50';
    return renderQuoteLineRow(line, index, rowClass);
  }).join('');
}

async function persistQuoteLineColumnOrder(order = getQuoteLineColumnOrder(), { showSuccessState = true } = {}) {
  try {
    setQuoteLineLayoutHint('Saving layout...', 'muted');
    await saveSalesQuotePreference(SALES_QUOTES_PREFERENCE_KEYS.LINE_COLUMN_ORDER, order);

    if (showSuccessState) {
      setQuoteLineLayoutHint('Layout saved for your user.', 'success');
    }
  } catch (error) {
    console.error('Failed to save quote line layout:', error);
    setQuoteLineLayoutHint('Unable to save layout right now.', 'error');
    showToast('Unable to save your line column layout right now.', 'error');
  }
}

function clearQuoteLineHeaderDragState() {
  QUOTE_LINE_DRAG_STATE.draggedColumnId = null;

  document.querySelectorAll('.quote-line-column-header').forEach(header => {
    header.classList.remove('is-dragging', 'drop-before', 'drop-after');
  });
}

function moveQuoteLineColumn(draggedColumnId, targetColumnId, position) {
  const nextOrder = getQuoteLineColumnOrder().filter(columnId => columnId !== draggedColumnId);
  const targetIndex = nextOrder.indexOf(targetColumnId);

  if (targetIndex === -1) {
    return getQuoteLineColumnOrder();
  }

  const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
  nextOrder.splice(insertIndex, 0, draggedColumnId);

  return nextOrder;
}

function getDropPosition(target, event) {
  const rect = target.getBoundingClientRect();
  const midpoint = rect.left + (rect.width / 2);
  return event.clientX >= midpoint ? 'after' : 'before';
}

function handleQuoteLineHeaderDragStart(event) {
  const header = event.currentTarget;
  QUOTE_LINE_DRAG_STATE.draggedColumnId = header.dataset.columnId;
  header.classList.add('is-dragging');

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', QUOTE_LINE_DRAG_STATE.draggedColumnId);
  }
}

function handleQuoteLineHeaderDragOver(event) {
  event.preventDefault();

  const header = event.currentTarget;
  const targetColumnId = header.dataset.columnId;

  if (!QUOTE_LINE_DRAG_STATE.draggedColumnId || targetColumnId === QUOTE_LINE_DRAG_STATE.draggedColumnId) {
    header.classList.remove('drop-before', 'drop-after');
    return;
  }

  const dropPosition = getDropPosition(header, event);

  header.classList.toggle('drop-before', dropPosition === 'before');
  header.classList.toggle('drop-after', dropPosition === 'after');
}

async function handleQuoteLineHeaderDrop(event) {
  event.preventDefault();

  const header = event.currentTarget;
  const targetColumnId = header.dataset.columnId;
  const draggedColumnId = QUOTE_LINE_DRAG_STATE.draggedColumnId;

  if (!draggedColumnId || draggedColumnId === targetColumnId) {
    clearQuoteLineHeaderDragState();
    return;
  }

  const nextOrder = moveQuoteLineColumn(draggedColumnId, targetColumnId, getDropPosition(header, event));
  const currentOrder = getQuoteLineColumnOrder();

  clearQuoteLineHeaderDragState();

  if (nextOrder.every((columnId, index) => columnId === currentOrder[index])) {
    return;
  }

  setQuoteLineColumnOrder(nextOrder);
  renderQuoteLines();
  await persistQuoteLineColumnOrder(nextOrder);
}

function handleQuoteLineHeaderDragEnd() {
  clearQuoteLineHeaderDragState();
}

function attachQuoteLineHeaderDragHandlers(headerRoot) {
  headerRoot.querySelectorAll('.quote-line-column-header').forEach(header => {
    header.addEventListener('dragstart', handleQuoteLineHeaderDragStart);
    header.addEventListener('dragover', handleQuoteLineHeaderDragOver);
    header.addEventListener('drop', handleQuoteLineHeaderDrop);
    header.addEventListener('dragend', handleQuoteLineHeaderDragEnd);
    header.addEventListener('dragleave', () => {
      header.classList.remove('drop-before', 'drop-after');
    });
  });
}

export async function resetQuoteLineColumnOrder() {
  if (isDefaultQuoteLineColumnOrder()) {
    return;
  }

  setQuoteLineColumnOrder(DEFAULT_QUOTE_LINE_COLUMN_ORDER);
  renderQuoteLines();
  await persistQuoteLineColumnOrder(DEFAULT_QUOTE_LINE_COLUMN_ORDER, { showSuccessState: false });
  setQuoteLineLayoutHint('Layout reset to default.', 'success');
}

export async function initializeQuoteLinePersonalization() {
  setQuoteLineColumnOrder(DEFAULT_QUOTE_LINE_COLUMN_ORDER);
  setQuoteLineLayoutHint();

  const resetHandler = () => {
    resetQuoteLineColumnOrder();
  };

  const resetButton = el('resetQuoteLineColumnsBtn');
  if (resetButton) {
    resetButton.onclick = resetHandler;
  }

  const fullscreenResetButton = el('resetQuoteLineColumnsBtnFullscreen');
  if (fullscreenResetButton) {
    fullscreenResetButton.onclick = resetHandler;
  }

  renderQuoteLineHeaders();
  renderQuoteLines();

  try {
    const response = await loadSalesQuotePreference(SALES_QUOTES_PREFERENCE_KEYS.LINE_COLUMN_ORDER);
    if (Array.isArray(response?.value)) {
      setQuoteLineColumnOrder(response.value);
      renderQuoteLines();
    }
  } catch (error) {
    console.warn('Failed to load saved quote line layout, using default order:', error);
  }
}

/**
 * Render quote lines table
 */
export function renderQuoteLines() {
  renderQuoteLineHeaders();
  renderQuoteLineBody('linesTableBody', 'noLinesMessage');
  renderQuoteLineBody('fullscreenLinesTableBody', 'fullscreenNoLinesMessage');
}

/**
 * Calculate line total
 * Formula: (Quantity × Unit Price) - Discount Amount
 */
function calculateLineTotal(line) {
  const quantity = parseFloat(line.quantity) || 0;
  const unitPrice = parseFloat(line.unitPrice) || 0;
  const discountAmount = parseFloat(line.discountAmount) || 0;
  return quantity * unitPrice - discountAmount;
}

// ============================================================
// Totals Display
// ============================================================

/**
 * Render totals
 * Also syncs invoice discount percent when called from line changes
 */
export function renderTotals() {
  const invoiceDiscount = parseFloat(el('invoiceDiscount')?.value || 0);
  const vatRate = parseFloat(el('vatRate')?.value || 7) / 100;

  const subtotal = state.quote.lines.reduce((sum, line) => sum + calculateLineTotal(line), 0);
  const discountAmount = invoiceDiscount;
  const afterDiscount = subtotal - discountAmount;
  const vatAmount = afterDiscount * vatRate;
  const total = afterDiscount + vatAmount;

  // Update display
  if (el('subtotal')) el('subtotal').textContent = formatCurrency(subtotal);
  if (el('discountAmount')) el('discountAmount').textContent = formatCurrency(discountAmount);
  if (el('afterDiscount')) el('afterDiscount').textContent = formatCurrency(afterDiscount);
  if (el('vatAmount')) el('vatAmount').textContent = formatCurrency(vatAmount);
  if (el('vatRateDisplay')) el('vatRateDisplay').textContent = (vatRate * 100).toFixed(0);
  if (el('totalAmount')) el('totalAmount').textContent = formatCurrency(total);

  // Sync invoice discount percent (unless currently being edited by user)
  const percentInput = el('invoiceDiscountPercent');
  if (percentInput && document.activeElement !== percentInput) {
    const calculatedPercent = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
    percentInput.value = calculatedPercent.toFixed(1);
  }
}

// ============================================================
// Modal Management
// ============================================================

/**
 * Open add line modal
 */
export function openAddLineModal(insertIndex = null) {
  if (!canModifyQuoteLines()) {
    showToast(getQuoteEditLockMessage(), 'error');
    return;
  }

  // Close edit modal if open
  const editModal = el('editLineModal');
  if (editModal && !editModal.classList.contains('hidden')) {
    const content = el('editLineModalContent');
    content.classList.remove('opacity-100', 'translate-y-0');
    content.classList.add('opacity-0', 'translate-y-[-10px]');
    setTimeout(() => {
      editModal.classList.add('hidden');
      state.ui.editingLineId = null;
      // Reset SER creation flag for Edit modal
      state.ui.serCreatedEdit = false;
      state.ui.pendingSerCreationEdit = false;
    }, 300);
  }

  // Close confirmation modal if open
  const confirmModal = el('confirmNewSerModal');
  if (confirmModal && !confirmModal.classList.contains('hidden')) {
    const confirmContent = el('confirmNewSerModalContent');
    confirmContent.classList.remove('opacity-100', 'translate-y-0');
    confirmContent.classList.add('opacity-0', 'translate-y-[-10px]');
    setTimeout(() => {
      confirmModal.classList.add('hidden');
      state.ui.pendingSerCreation = false;
      state.ui.pendingSerCreationEdit = false;
    }, 300);
  }

  const modal = el('addLineModal');
  const modalContent = el('addLineModalContent');
  if (modal && modalContent) {
    modal.classList.remove('hidden');

    // Ensure modal is on top (higher z-index than fullscreen table)
    modal.style.zIndex = '100';

    // Store insert index in state
    state.ui.insertIndex = insertIndex;

    // Reset SER creation flag on modal open
    state.ui.serCreated = false;

    // Reset dropdown validation state for Material No field (new modal, so no valid value)
    state.ui.dropdownFields.materialNo.valid = false;
    state.ui.dropdownFields.materialNo.touched = false;

    // Update modal title/subtitle based on mode
    const titleEl = el('addLineModalTitle');
    const subtitleEl = el('addLineModalSubtitle');

    if (insertIndex !== null) {
      // Insert mode
      if (titleEl) titleEl.textContent = 'Insert Quote Line';
      if (subtitleEl) subtitleEl.textContent = `Inserting at position ${insertIndex + 1}`;
    } else {
      // Append mode
      if (titleEl) titleEl.textContent = 'Add Quote Line';
      if (subtitleEl) subtitleEl.textContent = 'Search items and add to quote';
    }

    // Clear form - reset all fields to default values
    // Type dropdown
    if (el('lineType')) el('lineType').value = 'Item';

    // New SER button - reset to normal state
    if (el('lineCreateSv')) {
      const button = el('lineCreateSv');
      // Reset to normal state (Tailwind classes handle styling)
      button.disabled = false;
      button.innerHTML = 'New SER';
    }

    // Service Item fields
    if (el('lineUsvtServiceItemNo')) el('lineUsvtServiceItemNo').value = '';
    if (el('lineUsvtServiceItemDescription')) el('lineUsvtServiceItemDescription').value = '';
    if (el('lineUsvtGroupNo')) el('lineUsvtGroupNo').value = '1';

    // Material search (No field)
    if (el('lineObjectNumberSearch')) el('lineObjectNumberSearch').value = '';

    // Description
    if (el('lineDescription')) el('lineDescription').value = '';

    // Pricing
    if (el('lineQuantity')) el('lineQuantity').value = '1';
    if (el('lineUnitPrice')) el('lineUnitPrice').value = '0';

    // Discount fields
    if (el('lineDiscountPercent')) el('lineDiscountPercent').value = '0';
    if (el('lineDiscountAmount')) el('lineDiscountAmount').value = '0';

    // Addition checkbox
    if (el('lineUsvtAddition')) el('lineUsvtAddition').checked = false;

    // Ref Sales Quote No
    if (el('lineUsvtRefSalesQuoteno')) el('lineUsvtRefSalesQuoteno').value = '';

    // Line total preview
    if (el('lineTotalPreview')) el('lineTotalPreview').textContent = '0.00';

    // Remove any disabled states or visual feedback
    const allInputs = document.querySelectorAll('#addLineModal input, #addLineModal select');
    allInputs.forEach(input => {
      input.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-50', 'text-slate-600');
      input.removeAttribute('title');
      if (!input.readOnly) {
        input.disabled = false;
      }
    });

    // Setup Type -> New SER locking handler
    if (window.setupLineModalHandlers) {
      window.setupLineModalHandlers();
    }

    // Initialize New SER button state based on default Group No (1)
    // This ensures the button is properly disabled if Group No 1 already has a Service Item
    if (window.updateNewSerButtonStateForAddModal) {
      window.updateNewSerButtonStateForAddModal();
    }

    // Setup modal field asterisk handlers
    setupModalAsteriskHandlers();

    // Focus on item search
    setTimeout(() => el('lineItemSearch')?.focus(), 100);

    // Trigger animation
    setTimeout(() => {
      modalContent.classList.remove('opacity-0', 'translate-y-[-10px]');
      modalContent.classList.add('opacity-100', 'translate-y-0');
    }, 10);
  }
}

/**
 * Open insert line modal (wrapper function)
 */
export function openInsertLineModal(index) {
  openAddLineModal(index);
}

/**
 * Close add line modal
 */
export function closeAddLineModal() {
  const modal = el('addLineModal');
  const modalContent = el('addLineModalContent');
  if (modal && modalContent) {
    // Start closing animation
    modalContent.classList.remove('opacity-100', 'translate-y-0');
    modalContent.classList.add('opacity-0', 'translate-y-[-10px]');

    // Hide modal after animation completes
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 300);

    // Reset insert mode
    state.ui.insertIndex = null;

    // Close confirmation modal if open
    const confirmModal = el('confirmNewSerModal');
    if (confirmModal && !confirmModal.classList.contains('hidden')) {
      const confirmContent = el('confirmNewSerModalContent');
      confirmContent.classList.remove('opacity-100', 'translate-y-0');
      confirmContent.classList.add('opacity-0', 'translate-y-[-10px]');
      setTimeout(() => {
        confirmModal.classList.add('hidden');
        state.ui.pendingSerCreation = false;
        state.ui.pendingSerCreationEdit = false;
      }, 300);
    }
  }

  // Hide New SER confirmation modal if open
  hideConfirmNewSerModal();
}

/**
 * Hide confirmation modal for New SER creation (internal helper)
 */
function hideConfirmNewSerModal() {
  const modal = el('confirmNewSerModal');
  const modalContent = el('confirmNewSerModalContent');

  if (modal && modalContent) {
    modalContent.classList.remove('opacity-100', 'translate-y-0');
    modalContent.classList.add('opacity-0', 'translate-y-[-10px]');
    setTimeout(() => {
      modal.classList.add('hidden');
      state.ui.pendingSerCreation = false;
    }, 300);
  }
}

/**
 * Setup asterisk handlers for modal fields
 */
function setupModalAsteriskHandlers() {
  const modalFields = ['lineType', 'lineObjectNumberSearch', 'lineDescription', 'lineQuantity'];

  modalFields.forEach(fieldId => {
    const field = el(fieldId);
    if (!field) return;

    // Check initial state (Quantity defaults to '1', Price defaults to '0')
    updateRequiredAsterisk(fieldId);

    // Remove old listeners to prevent duplicates
    field.removeEventListener('input', handleModalFieldInput);
    field.removeEventListener('change', handleModalFieldInput);

    // Add fresh listeners (input for text fields, change for select dropdowns)
    field.addEventListener('input', handleModalFieldInput);
    field.addEventListener('change', handleModalFieldInput);
  });
}

/**
 * Handler for modal field input events
 */
function handleModalFieldInput(e) {
  updateRequiredAsterisk(e.target.id);
}

/**
 * Setup asterisk handlers for Edit Line modal fields
 */
export function setupEditModalAsteriskHandlers() {
  const editModalFields = ['editLineType', 'editLineObjectNumberSearch', 'editLineDescription', 'editLineQuantity'];

  editModalFields.forEach(fieldId => {
    const field = el(fieldId);
    if (!field) return;

    // Check initial state
    updateRequiredAsterisk(fieldId);

    // Remove old listeners to prevent duplicates
    field.removeEventListener('input', handleModalFieldInput);
    field.removeEventListener('change', handleModalFieldInput);

    // Add fresh listeners (input for text fields, change for select dropdowns)
    field.addEventListener('input', handleModalFieldInput);
    field.addEventListener('change', handleModalFieldInput);
  });
}

/**
 * Update line total preview in modal
 */
export function updateLineTotalPreview() {
  const quantity = parseFloat(el('lineQuantity')?.value || 0);
  const unitPrice = parseFloat(el('lineUnitPrice')?.value || 0);
  const discountAmount = parseFloat(el('lineDiscountAmount')?.value || 0);

  const total = (quantity * unitPrice) - discountAmount;

  if (el('lineTotalPreview')) {
    el('lineTotalPreview').textContent = formatCurrency(total);
  }
}

// ============================================================
// Date Picker (Flatpickr)
// ============================================================

/**
 * Initialize Flatpickr for date input fields
 * @param {string} inputId - The ID of the input field
 * @param {Object} options - Flatpickr configuration options
 */
export function initFlatpickr(inputId, options = {}) {
  const input = el(inputId);
  if (!input) return;

  // Default options
  const defaultOptions = {
    dateFormat: 'Y-m-d', // Format: YYYY-MM-DD (compatible with HTML5 date)
    disableMobile: false, // Allow native picker on mobile if preferred
    animate: true,
    ariaDateFormat: 'F j, Y', // Screen reader format
    ...options
  };

  // Initialize Flatpickr
  flatpickr(input, defaultOptions);

  // Trigger asterisk update on value change
  input.addEventListener('change', () => {
    updateRequiredAsterisk(inputId);
  });
}

// ============================================================
// Form Helpers
// ============================================================

/**
 * Get branch code from branch ID
 * Maps branch ID (1-6) to branch code
 */
export function getBranchCode(branchId) {
  const branchMapping = {
    1: 'URY',
    2: 'USB',
    3: 'USR',
    4: 'UKK',
    5: 'UPB',
    6: 'UCB'
  };
  return branchMapping[branchId] || '';
}

/**
 * Generate location code from branch code
 * Takes last 2 characters of branch code and appends "01"
 */
export function generateLocationCode(branchCode) {
  if (!branchCode || branchCode.length < 2) {
    return '';
  }
  return branchCode.slice(-2) + '01';
}

/**
 * Get quote form data
 */
export function getQuoteFormData() {
  return {
    quoteId: state.quote.id,
    quoteNumber: state.quote.number,
    quoteEtag: state.quote.etag,
    quoteStatus: state.quote.status,
    workStatus: el('workStatus')?.value || state.quote.workStatus || '',
    mode: state.quote.mode,
    customerId: state.quote.customerId,
    customerNo: state.quote.customerNo,
    customerName: state.quote.customerName,
    customer: state.quote.customer,
    orderDate: el('orderDate')?.value || '',
    requestedDeliveryDate: el('requestedDeliveryDate')?.value || '',
    workDescription: el('quoteWorkDescription')?.value || '',
    // New fields
    contact: el('contact')?.value || '',
    salesPhoneNo: el('salesPhoneNo')?.value || '',
    salesEmail: el('salesEmail')?.value || '',
    salespersonCode: state.quote.salespersonCode || '',
    salespersonName: state.quote.salespersonName || '',
    assignedUserId: state.quote.assignedUserId || '',
    serviceOrderType: el('serviceOrderType')?.value || '',
    division: el('division')?.value || 'MS1029',
    branch: el('branch')?.value || '',
    locationCode: el('locationCode')?.value || '',
    responsibilityCenter: el('responsibilityCenter')?.value || '',
    invoiceDiscount: parseFloat(el('invoiceDiscount')?.value || 0) || 0,
    invoiceDiscountPercent: parseFloat(el('invoiceDiscountPercent')?.value || 0) || 0,
    vatRate: parseFloat(el('vatRate')?.value || 7) || 7,
    sellTo: {
      address: getFieldValue('sellToAddress') || state.quote.sellTo?.address || '',
      address2: getFieldValue('sellToAddress2') || state.quote.sellTo?.address2 || '',
      city: getFieldValue('sellToCity') || state.quote.sellTo?.city || '',
      postCode: getFieldValue('sellToPostCode') || state.quote.sellTo?.postCode || '',
      vatRegNo: getFieldValue('sellToVatRegNo') || state.quote.sellTo?.vatRegNo || '',
      taxBranchNo: getFieldValue('sellToTaxBranchNo') || state.quote.sellTo?.taxBranchNo || ''
    },
    reportContext: state.quote.reportContext,
    lines: [...state.quote.lines]
  };
}

/**
 * Populate form with quote data
 */
export function populateQuoteForm(quote) {
  if (el('customerNoSearch')) el('customerNoSearch').value = quote.customerNo || '';
  if (el('customerName')) el('customerName').value = quote.customerName || '';
  if (el('workStatus')) el('workStatus').value = quote.workStatus || '';
  if (el('quoteWorkDescription')) el('quoteWorkDescription').value = quote.workDescription || '';
  if (el('invoiceDiscount')) el('invoiceDiscount').value = quote.invoiceDiscount ?? quote.discountAmount ?? 0;

  // New fields
  if (el('contact')) el('contact').value = quote.contact || '';
  if (el('salesPhoneNo')) el('salesPhoneNo').value = quote.salesPhoneNo || '';
  if (el('salesEmail')) el('salesEmail').value = quote.salesEmail || '';
  if (el('salespersonCodeSearch')) el('salespersonCodeSearch').value = quote.salespersonCode || '';
  if (el('salespersonName')) el('salespersonName').value = quote.salespersonName || '';
  if (el('assignedUserIdSearch')) el('assignedUserIdSearch').value = quote.assignedUserId || '';
  if (el('serviceOrderType')) el('serviceOrderType').value = quote.serviceOrderType || '';
  if (el('division')) el('division').value = quote.division || 'MS1029';

  // Branch fields
  if (el('branch')) el('branch').value = quote.branch || '';
  if (el('locationCode')) el('locationCode').value = quote.locationCode || '';
  if (el('responsibilityCenter')) el('responsibilityCenter').value = quote.responsibilityCenter || '';

  setFieldValue('sellToAddress', quote.sellTo?.address || '');
  setFieldValue('sellToAddress2', quote.sellTo?.address2 || '');
  setFieldValue('sellToCity', quote.sellTo?.city || '');
  setFieldValue('sellToPostCode', quote.sellTo?.postCode || '');
  setFieldValue('sellToVatRegNo', quote.sellTo?.vatRegNo || '');
  setFieldValue('sellToTaxBranchNo', quote.sellTo?.taxBranchNo || '');

  const sellToSection = el('sellToSection');
  if (sellToSection) {
    const hasSellToValues = Boolean(
      quote.sellTo?.address ||
      quote.sellTo?.address2 ||
      quote.sellTo?.city ||
      quote.sellTo?.postCode ||
      quote.sellTo?.vatRegNo ||
      quote.sellTo?.taxBranchNo
    );
    sellToSection.classList.toggle('hidden', !hasSellToValues);
  }

  if (quote.customer && quote.customer.name && quote.customer.number) {
    displaySelectedCustomer(quote.customer);
  }

  // Initialize date fields with Flatpickr
  initFlatpickr('orderDate', {
    defaultDate: quote.orderDate || 'today',
  });

  initFlatpickr('requestedDeliveryDate', {
    defaultDate: quote.requestedDeliveryDate || '',
    minDate: 'today',
  });

  renderTotals();
  updateQuoteEditorModeUi();

  // Update asterisks for populated fields
  setTimeout(() => {
    ['customerNoSearch', 'salespersonCodeSearch', 'assignedUserIdSearch', 'serviceOrderType', 'orderDate', 'requestedDeliveryDate', 'branch'].forEach(id => {
      const field = el(id);
      if (field && field.value) {
        updateRequiredAsterisk(id);
      }
    });
  }, 50);
}

/**
 * Clear quote form
 */
export function clearQuoteForm() {
  if (el('customerSearch')) el('customerSearch').value = '';
  if (el('customerNoSearch')) el('customerNoSearch').value = '';
  if (el('customerName')) el('customerName').value = '';
  if (el('workStatus')) el('workStatus').value = '';
  if (el('quoteWorkDescription')) el('quoteWorkDescription').value = '';
  if (el('invoiceDiscount')) el('invoiceDiscount').value = '0';
  if (el('invoiceDiscountPercent')) el('invoiceDiscountPercent').value = '0.0';

  // Clear new fields
  if (el('contact')) el('contact').value = '';
  if (el('salespersonCodeSearch')) el('salespersonCodeSearch').value = '';
  if (el('salespersonName')) el('salespersonName').value = '';
  if (el('assignedUserIdSearch')) el('assignedUserIdSearch').value = '';
  if (el('serviceOrderType')) el('serviceOrderType').value = '';
  if (el('division')) el('division').value = 'MS1029';

  // NOTE: Do NOT clear branch, locationCode, and responsibilityCenter
  // These are auto-populated from the user's session/branch data and should persist

  clearCustomerSelection();
  hideCustomerDropdown();

  // Initialize Flatpickr for date fields
  initDateFields();
  updateQuoteEditorModeUi();
}

function setCustomerNoFieldLockState(locked) {
  const customerNoField = el('customerNoSearch');
  const customerNoDropdown = el('customerNoDropdown');

  if (!customerNoField) {
    return;
  }

  customerNoField.readOnly = locked;
  customerNoField.classList.toggle('bg-slate-50', locked);
  customerNoField.classList.toggle('text-slate-600', locked);
  customerNoField.classList.toggle('cursor-not-allowed', locked);

  if (locked) {
    customerNoField.setAttribute('aria-readonly', 'true');
    customerNoField.setAttribute('title', 'Customer Number is locked for searched Sales Quotes');
    customerNoDropdown?.classList.add('hidden');
  } else {
    customerNoField.removeAttribute('aria-readonly');
    customerNoField.removeAttribute('title');
  }
}

/**
 * Update quote editor banner/button state for create vs edit mode
 */
export async function updateQuoteEditorModeUi() {
  const APPROVAL = await getApprovalStatus();
  const isEditMode = state.quote.mode === 'edit' && Boolean(state.quote.number);
  const isSearchSalesQuoteMode = isSearchSalesQuoteEditorMode();
  const banner = el('quoteEditorModeBanner');
  const title = el('quoteEditorModeTitle');
  const meta = el('quoteEditorModeMeta');
  const sendButton = el('sendQuoteBtn');
  const sendButtonText = el('sendQuoteBtnText');
  const printButton = el('printQuoteBtn');
  const workStatusFieldContainer = el('workStatusFieldContainer');
  const sendApprovalRequestBtn = el('sendApprovalRequestBtn');
  const requestRevisionBtn = el('requestRevisionBtn');
  const approvalStatus = state.quote.approvalStatus || state.approval.currentStatus;
  const pendingRevisionRequest = hasPendingRevisionRequestState();
  const quoteLocked = isSearchSalesQuoteMode && !isQuoteEditable();
  const lockMessage = quoteLocked ? getQuoteEditLockMessage() : '';

  setCustomerNoFieldLockState(isEditMode);
  updateQuoteEditorFormLockState(quoteLocked, lockMessage);
  renderQuoteLines();

  if (workStatusFieldContainer) {
    workStatusFieldContainer.classList.toggle('hidden', !isSearchSalesQuoteMode);
  }

  if (banner) {
    banner.classList.toggle('hidden', !isEditMode);
  }

  if (printButton) {
    printButton.classList.toggle('hidden', !isSearchSalesQuoteMode);
  }

  if (title) {
    title.textContent = isEditMode
      ? `Editing Sales Quote ${state.quote.number}`
      : 'Create a new Sales Quote';
  }

  if (meta) {
    const metaParts = [];
    if (state.quote.status) {
      metaParts.push(`Status: ${state.quote.status}`);
    }
    if (approvalStatus) {
      const statusLabel = pendingRevisionRequest ? 'Approved (Revision Requested)' :
        APPROVAL.SUBMITTED_TO_BC === approvalStatus ? 'Submitted to BC' :
        APPROVAL.REVISE === approvalStatus ? 'Revision Requested' :
        APPROVAL.PENDING_APPROVAL === approvalStatus ? 'Pending Approval' :
        APPROVAL.APPROVED === approvalStatus ? 'Approved' :
        APPROVAL.REJECTED === approvalStatus ? 'Rejected' :
        APPROVAL.BEING_REVISED === approvalStatus ? 'Being Revised' :
        APPROVAL.CANCELLED === approvalStatus ? 'Cancelled' :
        approvalStatus;
      metaParts.push(`Approval: ${statusLabel}`);
    }
    if (state.quote.customerName) {
      metaParts.push(`Customer: ${state.quote.customerName}`);
    }
    if (state.quote.branch) {
      metaParts.push(`Branch: ${state.quote.branch}`);
    }
    meta.textContent = metaParts.join(' | ');
    
    const commentConfig = approvalStatus === APPROVAL.REVISE
      ? {
          title: 'Revision Requested',
          containerClassName: 'mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg',
          iconClassName: 'w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5',
          titleClassName: 'text-sm font-semibold text-blue-900',
          textClassName: 'text-sm text-blue-700 mt-1 whitespace-pre-wrap',
          iconPath: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
        }
      : approvalStatus === APPROVAL.REJECTED
        ? {
            title: 'Rejected',
            containerClassName: 'mt-3 p-3 bg-red-50 border border-red-200 rounded-lg',
            iconClassName: 'w-5 h-5 text-red-600 flex-shrink-0 mt-0.5',
            titleClassName: 'text-sm font-semibold text-red-900',
            textClassName: 'text-sm text-red-700 mt-1 whitespace-pre-wrap',
            iconPath: 'M6 18L18 6M6 6l12 12'
          }
        : pendingRevisionRequest
          ? {
              title: 'Revision Request Pending Approval',
              containerClassName: 'mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg',
              iconClassName: 'w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5',
              titleClassName: 'text-sm font-semibold text-orange-900',
              textClassName: 'text-sm text-orange-700 mt-1 whitespace-pre-wrap',
              iconPath: 'M12 8v4m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z'
            }
        : null;

    if (state.approval.actionComment && commentConfig) {
      const escapedActionComment = escapeHtml(state.approval.actionComment);
      let approvalCommentDiv = el('approvalCommentDisplay');
      if (!approvalCommentDiv) {
        approvalCommentDiv = document.createElement('div');
        approvalCommentDiv.id = 'approvalCommentDisplay';
        banner.appendChild(approvalCommentDiv);
      }
      approvalCommentDiv.className = commentConfig.containerClassName;
      approvalCommentDiv.innerHTML = `
        <div class="flex items-start gap-2">
          <svg class="${commentConfig.iconClassName}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${commentConfig.iconPath}"></path>
          </svg>
          <div class="flex-1">
            <p class="${commentConfig.titleClassName}">${commentConfig.title}</p>
            <p class="${commentConfig.textClassName}">${escapedActionComment}</p>
          </div>
        </div>
      `;
      approvalCommentDiv.classList.remove('hidden');
    } else {
      const approvalCommentDiv = el('approvalCommentDisplay');
      if (approvalCommentDiv) {
        approvalCommentDiv.classList.add('hidden');
      }
    }
  }

  if (sendButton) {
    const disableSendButton = isEditMode && quoteLocked;
    sendButton.disabled = disableSendButton;
    sendButton.classList.toggle('opacity-60', disableSendButton);
    sendButton.classList.toggle('cursor-not-allowed', disableSendButton);

    if (disableSendButton && lockMessage) {
      sendButton.setAttribute('title', lockMessage);
    } else {
      sendButton.removeAttribute('title');
    }
  }

  if (sendButtonText) {
    sendButtonText.textContent = isEditMode
      ? 'Update Sales Quote'
      : 'Send to Business Central';
  }

  if (sendApprovalRequestBtn || requestRevisionBtn) {
    const invoiceDiscount = parseFloat(el('invoiceDiscount')?.value || 0);
    const vatRate = parseFloat(el('vatRate')?.value || 7) / 100;
    const subtotal = state.quote.lines.reduce((sum, line) => {
      const quantity = parseFloat(line.quantity) || 0;
      const unitPrice = parseFloat(line.unitPrice) || 0;
      const discountAmount = parseFloat(line.discountAmount) || 0;
      return sum + (quantity * unitPrice - discountAmount);
    }, 0);
    const afterDiscount = subtotal - invoiceDiscount;
    const total = afterDiscount + (afterDiscount * vatRate);

    const canRequestApproval = isSearchSalesQuoteMode &&
      (approvalStatus === null ||
       approvalStatus === APPROVAL.DRAFT ||
       approvalStatus === APPROVAL.SUBMITTED_TO_BC ||
       approvalStatus === APPROVAL.REVISE ||
       approvalStatus === APPROVAL.BEING_REVISED ||
       approvalStatus === APPROVAL.REJECTED) &&
      total > 0;
    const canUseRevisionRequest = isCurrentUserApprovalOwner();
    const showRequestRevision = isSearchSalesQuoteMode &&
      approvalStatus === APPROVAL.APPROVED &&
      canUseRevisionRequest &&
      !pendingRevisionRequest;

    logRequestRevisionVisibilityDecision({
      requestRevisionBtn,
      isSearchSalesQuoteMode,
      approvalStatus,
      approvedStatus: APPROVAL.APPROVED,
      canUseRevisionRequest,
      pendingRevisionRequest,
      showRequestRevision
    });

    if (sendApprovalRequestBtn) {
      sendApprovalRequestBtn.classList.toggle('hidden', !canRequestApproval);
    }

    if (requestRevisionBtn) {
      requestRevisionBtn.classList.toggle('hidden', !showRequestRevision);
      setActionButtonLocked(requestRevisionBtn, false, '');
    }
  }
}

/**
 * Initialize Flatpickr date fields
 */
export function initDateFields() {
  // Initialize Order Date with today's date as default
  initFlatpickr('orderDate', {
    defaultDate: 'today', // Set today as default
  });

  // Initialize Requested Delivery Date without default (only minDate restriction)
  initFlatpickr('requestedDeliveryDate', {
    minDate: 'today', // Prevent past dates
  });
}

// ============================================================
// Validation UI
// ============================================================

/**
 * Update required field asterisk visibility and background color based on field value
 * @param {string} fieldId - The ID of the input field
 */
export function updateRequiredAsterisk(fieldId) {
  const field = el(fieldId);
  if (!field) return;

  // Find the label containing this field
  const container = field.closest('.relative') || field.closest('div');
  if (!container) return;

  const label = container.querySelector('label');
  if (!label) return;

  const asterisk = label.querySelector('.required-asterisk');
  if (!asterisk) return;

  // Check if field has value
  // For numeric fields (number type or price/qty fields), treat 0 as empty
  let hasValue = field.value.trim() !== '';
  if (hasValue && (field.type === 'number' || fieldId.includes('Price') || fieldId.includes('Quantity') || fieldId.includes('Qty'))) {
    const numValue = parseFloat(field.value);
    hasValue = !isNaN(numValue) && numValue > 0;
  }

  // Toggle asterisk visibility
  if (hasValue) {
    asterisk.classList.add('hidden');
    // Remove red background when field has value
    field.classList.remove('field-required-empty');
  } else {
    asterisk.classList.remove('hidden');
    // Add red background when field is empty
    field.classList.add('field-required-empty');
  }
}

/**
 * Initialize required field asterisk handlers for a list of field IDs
 * @param {string[]} fieldIds - Array of field IDs to monitor
 */
export function setupRequiredAsteriskHandlers(fieldIds) {
  fieldIds.forEach(fieldId => {
    const field = el(fieldId);
    if (!field) return;

    // Check initial state
    updateRequiredAsterisk(fieldId);

    // Add event listeners for real-time updates
    field.addEventListener('input', () => updateRequiredAsterisk(fieldId));
    field.addEventListener('change', () => updateRequiredAsterisk(fieldId));
  });
}

/**
 * Display validation errors
 */
export function displayValidationErrors(errors) {
  // Remove existing error styles
  els('.bc-input').forEach(input => {
    input.classList.remove('border-red-500');
  });

  // Add error styles to invalid fields
  Object.keys(errors).forEach(field => {
    const input = el(field);
    if (input && field !== 'lines') {
      input.classList.add('border-red-500');
    }
  });

  // Show first error message as toast
  const firstError = Object.values(errors)[0];
  if (firstError) {
    if (typeof firstError === 'object') {
      showError(Object.values(firstError)[0]);
    } else {
      showError(firstError);
    }
  }
}

/**
 * Clear validation errors
 */
export function clearValidationErrors() {
  els('.bc-input').forEach(input => {
    input.classList.remove('border-red-500');
  });
}

// ============================================================
// Quote Created Success Modal
// ============================================================

/**
 * Show Quote Created Success modal with Quote Number and Service Order Nos
 * @param {string} quoteNumber - The Quote Number from Business Central
 * @param {string[]|null} serviceOrderNos - Array of Service Order Numbers (optional)
 */
async function ensureQuoteCreatedModalLoaded() {
  let modal = el('quoteCreatedModal');
  let modalContent = el('quoteCreatedModalContent');

  if (modal && modalContent) {
    return { modal, modalContent };
  }

  console.warn('[QUOTE-CREATED-MODAL] Modal not found in DOM, loading dynamically...');

  try {
    const { loadModal } = await import('./components/modal-loader.js');
    await loadModal('quoteCreatedModal');
  } catch (error) {
    console.error('[QUOTE-CREATED-MODAL] Failed to load modal dynamically:', error);
  }

  modal = el('quoteCreatedModal');
  modalContent = el('quoteCreatedModalContent');

  return { modal, modalContent };
}

async function ensureQuoteFailedModalLoaded() {
  let modal = el('quoteFailedModal');
  let modalContent = el('quoteFailedModalContent');

  if (modal && modalContent) {
    return { modal, modalContent };
  }

  console.warn('[QUOTE-FAILED-MODAL] Modal not found in DOM, loading dynamically...');

  try {
    const { loadModal } = await import('./components/modal-loader.js');
    await loadModal('quoteFailedModal');
  } catch (error) {
    console.error('[QUOTE-FAILED-MODAL] Failed to load modal dynamically:', error);
  }

  modal = el('quoteFailedModal');
  modalContent = el('quoteFailedModalContent');

  return { modal, modalContent };
}

async function ensureQuoteUpdatedModalLoaded() {
  let modal = el('quoteUpdatedModal');
  let modalContent = el('quoteUpdatedModalContent');

  if (modal && modalContent) {
    return { modal, modalContent };
  }

  console.warn('[QUOTE-UPDATED-MODAL] Modal not found in DOM, loading dynamically...');

  try {
    const { loadModal } = await import('./components/modal-loader.js');
    await loadModal('quoteUpdatedModal');
  } catch (error) {
    console.error('[QUOTE-UPDATED-MODAL] Failed to load modal dynamically:', error);
  }

  modal = el('quoteUpdatedModal');
  modalContent = el('quoteUpdatedModalContent');

  return { modal, modalContent };
}

function findFirstErrorString(node, seen = new WeakSet()) {
  if (typeof node === 'string') {
    const normalized = node.replace(/\s+/g, ' ').trim();
    return normalized || null;
  }

  if (!node || typeof node !== 'object') {
    return null;
  }

  if (seen.has(node)) {
    return null;
  }
  seen.add(node);

  if (Array.isArray(node)) {
    for (const item of node) {
      const message = findFirstErrorString(item, seen);
      if (message) {
        return message;
      }
    }
    return null;
  }

  const priorityKeys = [
    'message',
    'Message',
    'error',
    'Error',
    'errorMessage',
    'error_message',
    'detail',
    'details',
    'title',
    'description',
    'exceptionMessage'
  ];

  for (const key of priorityKeys) {
    if (key in node) {
      const message = findFirstErrorString(node[key], seen);
      if (message) {
        return message;
      }
    }
  }

  for (const value of Object.values(node)) {
    const message = findFirstErrorString(value, seen);
    if (message) {
      return message;
    }
  }

  return null;
}

function tryExtractStructuredError(rawMessage) {
  const trimmed = typeof rawMessage === 'string' ? rawMessage.trim() : '';
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = JSON.parse(trimmed);
    return findFirstErrorString(parsed) || trimmed;
  } catch {
    return trimmed;
  }
}

function stripHtmlToText(rawMessage) {
  const trimmed = typeof rawMessage === 'string' ? rawMessage.trim() : '';
  if (!trimmed) {
    return '';
  }

  if (!/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }

  const template = document.createElement('template');
  template.innerHTML = trimmed;
  const extracted = template.content.textContent?.replace(/\s+/g, ' ').trim();
  return extracted || trimmed;
}

function normalizeQuoteFailureMessage(errorOrMessage) {
  const fallbackMessage = 'Failed to send quote to Business Central. Please review the data and try again.';
  const rawMessage = errorOrMessage instanceof Error
    ? errorOrMessage.message
    : typeof errorOrMessage === 'string'
      ? errorOrMessage
      : '';

  if (!rawMessage || rawMessage.trim() === '') {
    return fallbackMessage;
  }

  const apiErrorMatch = rawMessage.match(/^API Error\s+(\d+):\s*([\s\S]*)$/i);
  const statusCode = apiErrorMatch?.[1] || null;
  const payloadMessage = apiErrorMatch?.[2] || rawMessage;

  let normalizedMessage = tryExtractStructuredError(payloadMessage);
  normalizedMessage = stripHtmlToText(normalizedMessage)
    .replace(/^Error:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalizedMessage) {
    normalizedMessage = fallbackMessage;
  }

  if (statusCode && !normalizedMessage.includes(`HTTP ${statusCode}`)) {
    normalizedMessage = `Business Central returned HTTP ${statusCode}. ${normalizedMessage}`;
  }

  if (normalizedMessage.length > 700) {
    normalizedMessage = `${normalizedMessage.slice(0, 697)}...`;
  }

  return normalizedMessage;
}

function renderServiceOrderList(container, serviceOrderNos) {
  if (!container) return;

  container.replaceChildren();
  delete container.dataset.copyValue;

  if (!Array.isArray(serviceOrderNos) || serviceOrderNos.length === 0) {
    return;
  }

  const fragment = document.createDocumentFragment();

  serviceOrderNos.forEach(soNo => {
    const item = document.createElement('div');
    item.className = 'quote-created-order-item';

    const value = document.createElement('span');
    value.className = 'quote-created-order-value';
    value.textContent = soNo;

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'quote-created-copy-btn quote-created-copy-btn-dark quote-created-copy-btn-inline';
    copyButton.title = `Copy ${soNo}`;
    copyButton.setAttribute('aria-label', `Copy service order number ${soNo}`);
    copyButton.innerHTML = `
      <svg class="quote-created-copy-icon w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
      </svg>
      <svg class="quote-created-copied-icon w-4 h-4 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
    `;

    copyButton.addEventListener('click', () => {
      const copyIcon = copyButton.querySelector('.quote-created-copy-icon');
      const copiedIcon = copyButton.querySelector('.quote-created-copied-icon');
      void copyTextWithFeedback(soNo, copyIcon, copiedIcon);
    });

    item.append(value, copyButton);
    fragment.appendChild(item);
  });

  container.appendChild(fragment);
  container.dataset.copyValue = serviceOrderNos.join('\n');
}

function resolveCopyIconElement(iconRef) {
  if (!iconRef) return null;
  return typeof iconRef === 'string' ? el(iconRef) : iconRef;
}

function updateCopyFeedback(copyIconRef, copiedIconRef) {
  const copyIcon = resolveCopyIconElement(copyIconRef);
  const copiedIcon = resolveCopyIconElement(copiedIconRef);

  copyIcon?.classList.add('hidden');
  copiedIcon?.classList.remove('hidden');

  setTimeout(() => {
    copyIcon?.classList.remove('hidden');
    copiedIcon?.classList.add('hidden');
  }, 2000);
}

async function copyTextWithFeedback(text, copyIconRef, copiedIconRef) {
  const normalizedText = typeof text === 'string' ? text.trim() : '';
  if (!normalizedText) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(normalizedText);
    } else {
      const fallbackInput = document.createElement('textarea');
      fallbackInput.value = normalizedText;
      fallbackInput.setAttribute('readonly', '');
      fallbackInput.style.position = 'absolute';
      fallbackInput.style.left = '-9999px';
      document.body.appendChild(fallbackInput);
      fallbackInput.select();
      document.execCommand('copy');
      fallbackInput.remove();
    }

    updateCopyFeedback(copyIconRef, copiedIconRef);
  } catch (error) {
    console.error('Failed to copy text:', error);
    showError('Failed to copy to clipboard');
  }
}

function openQuoteResponseModal(modal, modalContent) {
  if (!modal || !modalContent) {
    return;
  }

  modal.classList.remove('hidden');
  modal.style.zIndex = '160';
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => {
    modalContent.style.opacity = '1';
    modalContent.style.transform = 'translateY(0)';
  });
}

function closeQuoteResponseModal(modal, modalContent) {
  if (!modal || !modalContent) {
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
    return;
  }

  modalContent.style.opacity = '0';
  modalContent.style.transform = 'translateY(-8px)';

  setTimeout(() => {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }, 220);
}

export async function showQuoteCreatedSuccess(quoteNumber, serviceOrderNos = null) {
  const { modal, modalContent } = await ensureQuoteCreatedModalLoaded();
  const quoteNumberDisplay = el('quoteCreatedNumber');
  const serviceOrderNoDisplay = el('serviceOrderCreatedNumber');
  const serviceOrderNoSection = el('serviceOrderNoSection');
  const normalizedServiceOrderNos = Array.isArray(serviceOrderNos)
    ? serviceOrderNos
      .map(soNo => typeof soNo === 'string' ? soNo.trim() : '')
      .filter(soNo => soNo !== '')
    : typeof serviceOrderNos === 'string' && serviceOrderNos.trim() !== ''
      ? serviceOrderNos
        .split(/[\r\n,;]+/)
        .map(soNo => soNo.trim())
        .filter(soNo => soNo !== '')
      : [];

  if (!modal || !modalContent) {
    console.error('[QUOTE-CREATED-MODAL] Modal not available');
    showSuccess('Quote sent to Business Central successfully!');
    return false;
  }

  // Set the Quote Number
  if (quoteNumberDisplay) {
    quoteNumberDisplay.textContent = quoteNumber || 'N/A';
  }

  // Set Service Order Nos if available
  // Handle both array and single string (for backward compatibility)
  const hasServiceOrders = normalizedServiceOrderNos.length > 0;

  if (hasServiceOrders && serviceOrderNoDisplay) {
    renderServiceOrderList(serviceOrderNoDisplay, normalizedServiceOrderNos);
    if (serviceOrderNoSection) {
      serviceOrderNoSection.classList.remove('hidden');
    }
  } else {
    renderServiceOrderList(serviceOrderNoDisplay, []);
    if (serviceOrderNoSection) {
      serviceOrderNoSection.classList.add('hidden');
    }
  }

  const modalContainer = document.getElementById('modalContainer');
  if (modalContainer) {
    modalContainer.appendChild(modal);
  }

  openQuoteResponseModal(modal, modalContent);

  return true;
}

export async function showQuoteSendFailure(errorOrMessage) {
  const { modal, modalContent } = await ensureQuoteFailedModalLoaded();
  const messageElement = el('quoteFailedMessage');
  const normalizedMessage = normalizeQuoteFailureMessage(errorOrMessage);

  state.ui.error = normalizedMessage;
  console.error('UI Error:', normalizedMessage);

  if (!modal || !modalContent) {
    console.error('[QUOTE-FAILED-MODAL] Modal not available');
    showError(normalizedMessage);
    return false;
  }

  if (messageElement) {
    messageElement.textContent = normalizedMessage;
  }

  const modalContainer = document.getElementById('modalContainer');
  if (modalContainer) {
    modalContainer.appendChild(modal);
  }

  openQuoteResponseModal(modal, modalContent);

  return true;
}

/**
 * Close Quote Created Success modal
 */
export async function closeQuoteCreatedModal() {
  const modal = el('quoteCreatedModal');
  const modalContent = el('quoteCreatedModalContent');

  // Close the modal
  closeQuoteResponseModal(modal, modalContent);

  // Switch to My Records tab after modal closes and load records
  setTimeout(async () => {
    switchTab('records');
    // Load records after switching tabs so newly created quote appears
    const { loadQuoteSubmissionRecords } = await import('./records.js');
    await loadQuoteSubmissionRecords();
  }, 300);
}

export async function closeQuoteFailedModal() {
  const modal = el('quoteFailedModal');
  const modalContent = el('quoteFailedModalContent');

  // First close the modal
  closeQuoteResponseModal(modal, modalContent);

  // Then reload the quote after modal animation completes
  const { reloadCurrentQuote } = await import('./create-quote.js');
  setTimeout(async () => {
    await reloadCurrentQuote();
  }, 300); // Wait for modal close animation
}

export async function copyQuoteNumber() {
  await copyTextWithFeedback(
    el('quoteCreatedNumber')?.textContent,
    'copyQuoteIcon',
    'copiedQuoteIcon'
  );
}

/**
 * Show Quote Updated Success modal
 */
export async function showQuoteUpdatedSuccess(quoteNumber, serviceOrderNos = null) {
  const { modal, modalContent } = await ensureQuoteUpdatedModalLoaded();
  const quoteNumberDisplay = el('quoteUpdatedNumber');
  const serviceOrderNoDisplay = el('serviceOrderUpdatedNumber');
  const serviceOrderNoSection = el('serviceOrderUpdatedSection');
  const normalizedServiceOrderNos = Array.isArray(serviceOrderNos)
    ? serviceOrderNos
      .map(soNo => typeof soNo === 'string' ? soNo.trim() : '')
      .filter(soNo => soNo !== '')
    : typeof serviceOrderNos === 'string' && serviceOrderNos.trim() !== ''
      ? serviceOrderNos
        .split(/[\r\n,;]+/)
        .map(soNo => soNo.trim())
        .filter(soNo => soNo !== '')
      : [];

  if (!modal || !modalContent) {
    console.error('[QUOTE-UPDATED-MODAL] Modal not available');
    showSuccess(`Sales Quote ${quoteNumber} updated successfully!`);
    return false;
  }

  // Set the Quote Number
  if (quoteNumberDisplay) {
    quoteNumberDisplay.textContent = quoteNumber || 'N/A';
  }

  // Set Service Order Nos if available
  const hasServiceOrders = normalizedServiceOrderNos.length > 0;

  if (serviceOrderNoSection) {
    if (hasServiceOrders) {
      serviceOrderNoSection.classList.remove('hidden');
      renderServiceOrderList(serviceOrderNoDisplay, normalizedServiceOrderNos);
    } else {
      serviceOrderNoSection.classList.add('hidden');
      renderServiceOrderList(serviceOrderNoDisplay, []);
    }
  }

  const modalContainer = document.getElementById('modalContainer');
  if (modalContainer) {
    modalContainer.appendChild(modal);
  }

  openQuoteResponseModal(modal, modalContent);

  return true;
}

/**
 * Close Quote Updated Success modal
 */
export async function closeQuoteUpdatedModal() {
  const modal = el('quoteUpdatedModal');
  const modalContent = el('quoteUpdatedModalContent');

  // First close the modal
  closeQuoteResponseModal(modal, modalContent);

  // Then reload the quote after modal animation completes
  const { reloadCurrentQuote } = await import('./create-quote.js');
  setTimeout(async () => {
    await reloadCurrentQuote();
  }, 300); // Wait for modal close animation
}

/**
 * Copy updated quote number to clipboard
 */
export async function copyUpdatedQuoteNumber() {
  await copyTextWithFeedback(
    el('quoteUpdatedNumber')?.textContent,
    'copyUpdatedQuoteIcon',
    'copiedUpdatedQuoteIcon'
  );
}

// ============================================================
// Fullscreen Table Modal
// ============================================================

/**
 * Open fullscreen table modal
 */
export function openFullscreenTable() {
  const modal = el('fullscreenTableModal');
  const modalContent = el('fullscreenTableContent');
  if (!modal || !modalContent) return;

  // Close edit modal if open
  const editModal = el('editLineModal');
  if (editModal && !editModal.classList.contains('hidden')) {
    const content = el('editLineModalContent');
    content.classList.remove('opacity-100', 'translate-y-0');
    content.classList.add('opacity-0', 'translate-y-[-10px]');
    setTimeout(() => {
      editModal.classList.add('hidden');
      state.ui.editingLineId = null;
      // Reset SER creation flag for Edit modal
      state.ui.serCreatedEdit = false;
      state.ui.pendingSerCreationEdit = false;
    }, 300);
  }

  // Close confirmation modal if open
  const confirmModal = el('confirmNewSerModal');
  if (confirmModal && !confirmModal.classList.contains('hidden')) {
    const confirmContent = el('confirmNewSerModalContent');
    confirmContent.classList.remove('opacity-100', 'translate-y-0');
    confirmContent.classList.add('opacity-0', 'translate-y-[-10px]');
    setTimeout(() => {
      confirmModal.classList.add('hidden');
      state.ui.pendingSerCreation = false;
      state.ui.pendingSerCreationEdit = false;
    }, 300);
  }

  // Sync table content
  updateFullscreenTable();

  // Show modal
  modal.classList.remove('hidden');

  // Trigger animation
  setTimeout(() => {
    modalContent.classList.remove('opacity-0', 'translate-y-[-10px]');
    modalContent.classList.add('opacity-100', 'translate-y-0');
  }, 10);

  // Add ESC key listener
  document.addEventListener('keydown', handleFullscreenEsc);
}

/**
 * Close fullscreen table modal
 */
export function closeFullscreenTable() {
  const modal = el('fullscreenTableModal');
  const modalContent = el('fullscreenTableContent');
  if (!modal || !modalContent) return;

  // Start closing animation
  modalContent.classList.remove('opacity-100', 'translate-y-0');
  modalContent.classList.add('opacity-0', 'translate-y-[-10px]');

  // Hide modal after animation
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);

  // Remove ESC key listener
  document.removeEventListener('keydown', handleFullscreenEsc);
}

/**
 * Handle ESC key in fullscreen mode
 */
function handleFullscreenEsc(event) {
  if (event.key === 'Escape' && !el('fullscreenTableModal')?.classList.contains('hidden')) {
    closeFullscreenTable();
  }
}

/**
 * Sync fullscreen table with main table
 */
function syncFullscreenTable() {
  renderQuoteLineHeaders();
  renderQuoteLineBody('fullscreenLinesTableBody', 'fullscreenNoLinesMessage');
}

/**
 * Update fullscreen table when lines change
 */
export function updateFullscreenTable() {
  syncFullscreenTable();
}

// ============================================================
// Clear Quote Confirmation Modal
// ============================================================

/**
 * Show clear quote confirmation modal
 */
export function showConfirmClearQuoteModal() {
  const modal = el('confirmClearQuoteModal');
  const modalContent = el('confirmClearQuoteModalContent');
  if (modal && modalContent) {
    modal.classList.remove('hidden');
    setTimeout(() => {
      modalContent.classList.remove('opacity-0', 'translate-y-[-10px]');
      modalContent.classList.add('opacity-100', 'translate-y-0');
    }, 10);
  }
}

/**
 * Hide clear quote confirmation modal
 */
export function hideConfirmClearQuoteModal() {
  const modal = el('confirmClearQuoteModal');
  const modalContent = el('confirmClearQuoteModalContent');
  if (modal && modalContent) {
    modalContent.classList.remove('opacity-100', 'translate-y-0');
    modalContent.classList.add('opacity-0', 'translate-y-[-10px]');
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 300);
  }
}

/**
 * Show No Branch Assigned modal
 * FREEZES the page - user cannot interact with anything until they refresh
 * Includes fallback to load modal on-demand if not already in DOM
 */
function updateNoBranchModalUserEmail(userEmail = '') {
  const emailBox = el('noBranchUserEmailBox');
  const emailText = el('noBranchUserEmail');
  const normalizedEmail = typeof userEmail === 'string' ? userEmail.trim() : '';

  if (!emailBox || !emailText) {
    return normalizedEmail;
  }

  if (normalizedEmail) {
    emailText.textContent = normalizedEmail;
    emailBox.classList.remove('hidden');
  } else {
    emailText.textContent = '';
    emailBox.classList.add('hidden');
  }

  return normalizedEmail;
}

export async function showNoBranchModal(userEmail = '') {
  let modal = el('noBranchModal');
  let modalContent = el('noBranchModalContent');
  let resolvedUserEmail = typeof userEmail === 'string' ? userEmail.trim() : '';

  // Fallback: if modal not in DOM, load it dynamically
  if (!modal || !modalContent) {
    console.warn('[NO-BRANCH-MODAL] Modal not found in DOM, loading dynamically...');
    try {
      const { loadModal } = await import('./components/modal-loader.js');
      await loadModal('noBranchModal');
      modal = el('noBranchModal');
      modalContent = el('noBranchModalContent');
      console.log('[NO-BRANCH-MODAL] Modal loaded dynamically');
    } catch (err) {
      console.error('[NO-BRANCH-MODAL] Failed to load modal:', err);
      // Fallback: use browser alert as last resort
      const emailMessage = resolvedUserEmail ? `\nEmail: ${resolvedUserEmail}` : '';
      alert(`คุณยังไม่มี Branch ที่กำหนด${emailMessage}\nกรุณาติดต่อผู้ดูแลระบบเพื่อ Assign Branch\n\nYou do not have an assigned Branch.\nPlease contact the administrator.`);
      return;
    }
  }

  if (modal && modalContent) {
    resolvedUserEmail = updateNoBranchModalUserEmail(resolvedUserEmail);
    modal.classList.remove('hidden');
    modal.style.zIndex = '9999'; // Highest priority - above everything
    setTimeout(() => {
      modalContent.classList.remove('opacity-0', 'translate-y-[-10px]');
      modalContent.classList.add('opacity-100', 'translate-y-0');
    }, 10);

    // Freeze the entire page - prevent any interaction
    document.body.style.pointerEvents = 'none';
    document.body.style.overflow = 'hidden';
    // But allow interaction with the modal itself
    if (modal) {
      modal.style.pointerEvents = 'auto';
    }
  } else {
    // Last resort fallback if modal still not available
    console.error('[NO-BRANCH-MODAL] Modal still not available after loading');
    const emailMessage = resolvedUserEmail ? `\nEmail: ${resolvedUserEmail}` : '';
    alert(`คุณยังไม่มี Branch ที่กำหนด${emailMessage}\nกรุณาติดต่อผู้ดูแลระบบเพื่อ Assign Branch\n\nYou do not have an assigned Branch.\nPlease contact the administrator.`);
  }
}

/**
 * Hide No Branch Assigned modal
 * Only used if page is refreshed (this function won't normally be called)
 */
export function hideNoBranchModal() {
  const modal = el('noBranchModal');
  const modalContent = el('noBranchModalContent');
  if (modal && modalContent) {
    modalContent.classList.remove('opacity-100', 'translate-y-0');
    modalContent.classList.add('opacity-0', 'translate-y-[-10px]');
    setTimeout(() => {
      modal.classList.add('hidden');
      // Unfreeze the page
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
    }, 300);
  }
}

function updateBranchMismatchModalDetails({ quoteNumber = '', quoteBranch = '', userBranch = '' } = {}) {
  const quoteNumberText = typeof quoteNumber === 'string' ? quoteNumber.trim() : '';
  const quoteBranchText = typeof quoteBranch === 'string' ? quoteBranch.trim() : '';
  const userBranchText = typeof userBranch === 'string' ? userBranch.trim() : '';

  const quoteNumberEl = el('branchMismatchQuoteNumber');
  const quoteBranchEl = el('branchMismatchQuoteBranch');
  const userBranchEl = el('branchMismatchUserBranch');

  if (quoteNumberEl) {
    quoteNumberEl.textContent = quoteNumberText || '-';
  }

  if (quoteBranchEl) {
    quoteBranchEl.textContent = quoteBranchText || '-';
  }

  if (userBranchEl) {
    userBranchEl.textContent = userBranchText || '-';
  }
}

export async function showBranchMismatchModal({ quoteNumber = '', quoteBranch = '', userBranch = '' } = {}) {
  let modal = el('branchMismatchModal');
  let modalContent = el('branchMismatchModalContent');

  if (!modal || !modalContent) {
    console.warn('[BRANCH-MISMATCH-MODAL] Modal not found in DOM, loading dynamically...');
    try {
      const { loadModal } = await import('./components/modal-loader.js');
      await loadModal('branchMismatchModal');
      modal = el('branchMismatchModal');
      modalContent = el('branchMismatchModalContent');
    } catch (error) {
      console.error('[BRANCH-MISMATCH-MODAL] Failed to load modal:', error);
      alert(
        `Sales Quote นี้อยู่คนละสาขา\nSales Quote No.: ${quoteNumber || '-'}\nBranch ของเอกสาร: ${quoteBranch || '-'}\nBranch ของผู้ใช้งาน: ${userBranch || '-'}`
      );
      return false;
    }
  }

  if (!modal || !modalContent) {
    console.error('[BRANCH-MISMATCH-MODAL] Modal still not available after loading');
    alert(
      `Sales Quote นี้อยู่คนละสาขา\nSales Quote No.: ${quoteNumber || '-'}\nBranch ของเอกสาร: ${quoteBranch || '-'}\nBranch ของผู้ใช้งาน: ${userBranch || '-'}`
    );
    return false;
  }

  updateBranchMismatchModalDetails({ quoteNumber, quoteBranch, userBranch });

  if (modal.dataset.bound !== 'true') {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        hideBranchMismatchModal();
      }
    });
    modal.dataset.bound = 'true';
  }

  const modalContainer = el('modalContainer');
  if (modalContainer) {
    modalContainer.appendChild(modal);
  }

  modal.classList.remove('hidden');
  modal.style.zIndex = '180';
  modalContent.style.opacity = '0';
  modalContent.style.transform = 'translateY(-10px)';

  setTimeout(() => {
    modalContent.style.opacity = '1';
    modalContent.style.transform = 'translateY(0)';
  }, 10);

  return true;
}

export function hideBranchMismatchModal() {
  const modal = el('branchMismatchModal');
  const modalContent = el('branchMismatchModalContent');

  if (!modal || !modalContent) {
    return;
  }

  modalContent.style.opacity = '0';
  modalContent.style.transform = 'translateY(-10px)';

  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

// ============================================================
// Export functions to window for onclick handlers
// ============================================================

if (typeof window !== 'undefined') {
  window.switchTab = switchTab;
  window.openAddLineModal = openAddLineModal;
  window.openInsertLineModal = openInsertLineModal;
  window.closeAddLineModal = closeAddLineModal;
  window.closeQuoteCreatedModal = closeQuoteCreatedModal;
  window.closeQuoteFailedModal = closeQuoteFailedModal;
  window.copyQuoteNumber = copyQuoteNumber;
  window.closeQuoteUpdatedModal = closeQuoteUpdatedModal;
  window.copyUpdatedQuoteNumber = copyUpdatedQuoteNumber;
  window.openFullscreenTable = openFullscreenTable;
  window.closeFullscreenTable = closeFullscreenTable;
  window.resetQuoteLineColumns = resetQuoteLineColumnOrder;
  window.showConfirmClearQuoteModal = showConfirmClearQuoteModal;
  window.hideConfirmClearQuoteModal = hideConfirmClearQuoteModal;
  window.closeNoBranchModal = hideNoBranchModal;
  window.closeBranchMismatchModal = hideBranchMismatchModal;
}
