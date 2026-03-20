/**
 * Sales Quotes Approval Workflow Module
 * Handles multi-stage approval workflow for Sales Quotes
 */

import { state } from './state.js';
import { authState } from '../state.js';
import { ROLE, MODE } from '../core/config.js';
import { el, show, hide, showToast, showLoading, hideLoading } from './ui.js';
import { fetchSalespersonSignature } from './print-quote.js';

// ============================================================
// Constants
// ============================================================

const APPROVAL_STATUS = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'PendingApproval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  REVISE: 'Revise',
  CANCELLED: 'Cancelled'
};

const STATUS_LABELS = {
  Draft: 'Draft',
  PendingApproval: 'Pending Approval',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Revise: 'Revision Requested',
  Cancelled: 'Cancelled'
};

const STATUS_BADGE_CLASSES = {
  Draft: 'bg-gray-100 text-gray-700',
  PendingApproval: 'bg-amber-100 text-amber-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Revise: 'bg-blue-100 text-blue-700',
  Cancelled: 'bg-slate-100 text-slate-600'
};

// ============================================================
// API Helpers
// ============================================================

async function fetchWithAuth(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// ============================================================
// Tab Visibility
// ============================================================

/**
 * Initialize approvals tab - show/hide based on user role
 */
export async function initializeApprovalsTab() {
  const userRole = authState.user?.effectiveRole;
  const tabApprovals = el('tabApprovals');
  const approvalsBadge = el('approvalsBadge');

  // Show tab for Sales Directors and Executives
  const canApprove = userRole === ROLE.SALES_DIRECTOR || userRole === ROLE.EXECUTIVE;

  if (canApprove && tabApprovals) {
    show('tabApprovals');
    if (approvalsBadge) show('approvalsBadge');
    await updatePendingApprovalsBadge();
  } else {
    hide('tabApprovals');
    if (approvalsBadge) hide('approvalsBadge');
  }
}

/**
 * Update pending approvals badge count
 */
export async function updatePendingApprovalsBadge() {
  const badge = el('approvalsBadge');
  if (!badge) return 0;

  try {
    const response = await fetchWithAuth('/api/salesquotes/approvals/list/pending');
    const count = response.count || 0;

    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    return count;
  } catch (error) {
    console.error('Failed to fetch pending approvals count:', error);
    return 0;
  }
}

// ============================================================
// Load Approvals List
// ============================================================

/**
 * Load pending approvals list for Sales Directors
 */
export async function loadPendingApprovals() {
  const container = el('pendingApprovalsList');
  const countEl = el('pendingApprovalsCount');

  if (!container) return;

  if (countEl) countEl.textContent = '0';

  container.innerHTML = `
    <tr>
      <td colspan="6" class="px-4 py-10 text-center text-slate-500">
        Loading pending approvals...
      </td>
    </tr>
  `;

  try {
    const response = await fetchWithAuth('/api/salesquotes/approvals/list/pending');

    if (countEl) countEl.textContent = `${response.count || 0}`;

    if (!response.approvals || response.approvals.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6" class="px-4 py-10 text-center text-slate-500">
            No pending approvals found.
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = response.approvals.map(approval => renderApprovalRow(approval)).join('');

    // Attach click handlers
    container.querySelectorAll('[data-action="open-approval-preview"]').forEach(button => {
      button.addEventListener('click', () => {
        const quoteNumber = button.getAttribute('data-quote-number');
        openApprovalPreviewModal(quoteNumber);
      });
    });

  } catch (error) {
    console.error('Failed to load pending approvals:', error);
    container.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-10 text-center text-red-500">
          Failed to load pending approvals. ${error.message}
        </td>
      </tr>
    `;
  }
}

/**
 * Load my approval requests for Sales users
 */
export async function loadMyApprovalRequests() {
  const container = el('myApprovalsList');
  const countEl = el('myApprovalsCount');

  if (!container) return;

  if (countEl) countEl.textContent = '0';

  container.innerHTML = `
    <tr>
      <td colspan="6" class="px-4 py-10 text-center text-slate-500">
        Loading your approval requests...
      </td>
    </tr>
  `;

  try {
    const response = await fetchWithAuth('/api/salesquotes/approvals/list/my-requests');

    if (countEl) countEl.textContent = `${response.count || 0}`;

    if (!response.approvals || response.approvals.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6" class="px-4 py-10 text-center text-slate-500">
            No approval requests found.
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = response.approvals.map(approval => renderMyApprovalRow(approval)).join('');

    // Attach click handlers for quote numbers
    container.querySelectorAll('[data-action="view-quote"]').forEach(button => {
      button.addEventListener('click', () => {
        const quoteNumber = button.getAttribute('data-quote-number');
        window.switchTab('search');
        setTimeout(() => {
          const searchInput = el('searchSalesQuoteNumber');
          if (searchInput) {
            searchInput.value = quoteNumber;
            window.searchSalesQuote();
          }
        }, 50);
      });
    });

  } catch (error) {
    console.error('Failed to load my approval requests:', error);
    container.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-10 text-center text-red-500">
          Failed to load your requests. ${error.message}
        </td>
      </tr>
    `;
  }
}

function renderApprovalRow(approval) {
  const submittedAt = approval.submittedForApprovalAt
    ? new Date(approval.submittedForApprovalAt).toLocaleString()
    : '-';

  const total = parseFloat(approval.totalAmount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return `
    <tr class="hover:bg-slate-50 cursor-pointer" data-action="open-approval-preview" data-quote-number="${escapeHtml(approval.salesQuoteNumber)}">
      <td class="px-4 py-3 font-medium text-blue-600">
        ${escapeHtml(approval.salesQuoteNumber)}
      </td>
      <td class="px-4 py-3">${escapeHtml(approval.customerName || '-')}</td>
      <td class="px-4 py-3">${escapeHtml(approval.salespersonName || approval.salespersonEmail)}</td>
      <td class="px-4 py-3 text-right">${total}</td>
      <td class="px-4 py-3 whitespace-nowrap">${submittedAt}</td>
      <td class="px-4 py-3">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASSES[approval.approvalStatus]}">
          ${STATUS_LABELS[approval.approvalStatus] || approval.approvalStatus}
        </span>
      </td>
    </tr>
  `;
}

function renderMyApprovalRow(approval) {
  const submittedAt = approval.submittedForApprovalAt
    ? new Date(approval.submittedForApprovalAt).toLocaleString()
    : '-';

  const total = parseFloat(approval.totalAmount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  // Show action button based on status
  let actionButton = '';
  if (approval.approvalStatus === APPROVAL_STATUS.PENDING_APPROVAL) {
    actionButton = `
      <button
        type="button"
        class="text-sm text-red-600 hover:text-red-800 hover:underline"
        data-action="cancel-request"
        data-quote-number="${escapeHtml(approval.salesQuoteNumber)}"
      >
        Cancel
      </button>
    `;
  } else if (approval.approvalStatus === APPROVAL_STATUS.REVISE) {
    actionButton = `
      <button
        type="button"
        class="text-sm text-blue-600 hover:text-blue-800 hover:underline"
        data-action="view-quote"
        data-quote-number="${escapeHtml(approval.salesQuoteNumber)}"
      >
        Edit & Resubmit
      </button>
    `;
  } else if (approval.approvalStatus === APPROVAL_STATUS.REJECTED) {
    actionButton = '<span class="text-sm text-slate-400">Cannot resubmit</span>';
  }

  return `
    <tr class="hover:bg-slate-50">
      <td class="px-4 py-3 font-medium">
        <button
          type="button"
          class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
          data-action="view-quote"
          data-quote-number="${escapeHtml(approval.salesQuoteNumber)}"
        >
          ${escapeHtml(approval.salesQuoteNumber)}
        </button>
      </td>
      <td class="px-4 py-3">${escapeHtml(approval.customerName || '-')}</td>
      <td class="px-4 py-3 text-right">${total}</td>
      <td class="px-4 py-3">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASSES[approval.approvalStatus]}">
          ${STATUS_LABELS[approval.approvalStatus] || approval.approvalStatus}
        </span>
      </td>
      <td class="px-4 py-3">${submittedAt}</td>
      <td class="px-4 py-3">${actionButton}</td>
    </tr>
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// Submit for Approval
// ============================================================

/**
 * Submit current quote for approval (called after successful BC creation)
 */
export async function submitForApproval(quoteData) {
  const { salesQuoteNumber, salespersonCode, salespersonName, customerName, workDescription, totalAmount } = quoteData;

  if (!salesQuoteNumber) {
    showToast('Sales Quote number is required', 'error');
    return false;
  }

  // Check if total amount requires approval (only if > 0)
  const total = parseFloat(totalAmount) || 0;
  if (total <= 0) {
    console.log('[Approval] Quote total is zero or negative, skipping approval');
    state.approval.currentStatus = APPROVAL_STATUS.APPROVED;
    return true;
  }

  showLoading('Submitting for approval...', 'Sending Approval Request');

  try {
    const response = await fetchWithAuth('/api/salesquotes/approvals', {
      method: 'POST',
      body: JSON.stringify({
        salesQuoteNumber,
        salespersonCode,
        salespersonName,
        customerName,
        workDescription,
        totalAmount: total
      })
    });

    state.approval.currentStatus = response.approval?.approvalStatus || APPROVAL_STATUS.PENDING_APPROVAL;

    hideLoading();

    if (state.approval.currentStatus === APPROVAL_STATUS.APPROVED) {
      showToast('Quote approved automatically', 'success');
    } else {
      showToast('Quote submitted for approval', 'success');
    }

    return true;
  } catch (error) {
    hideLoading();
    console.error('Failed to submit for approval:', error);
    showToast(`Failed to submit: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Cancel pending approval request
 */
export async function cancelApprovalRequest(quoteNumber) {
  if (!confirm('Are you sure you want to cancel this approval request?')) {
    return false;
  }

  showLoading('Cancelling request...', 'Cancelling');

  try {
    const response = await fetchWithAuth(`/api/salesquotes/approvals/${quoteNumber}/cancel`, {
      method: 'POST'
    });

    hideLoading();
    showToast('Approval request cancelled', 'success');

    // Reload the list
    await loadMyApprovalRequests();

    // Update local state
    if (state.quote.number === quoteNumber) {
      state.approval.currentStatus = APPROVAL_STATUS.CANCELLED;
      state.approval.canEdit = true;
    }

    return true;
  } catch (error) {
    hideLoading();
    console.error('Failed to cancel approval request:', error);
    showToast(`Failed to cancel: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Resubmit quote after revision
 */
export async function resubmitForApproval(quoteNumber, quoteData) {
  showLoading('Resubmitting...', 'Resubmitting');

  try {
    const response = await fetchWithAuth(`/api/salesquotes/approvals/${quoteNumber}/resubmit`, {
      method: 'POST',
      body: JSON.stringify({
        totalAmount: quoteData.totalAmount,
        customerName: quoteData.customerName,
        workDescription: quoteData.workDescription
      })
    });

    hideLoading();
    showToast('Quote resubmitted for approval', 'success');

    state.approval.currentStatus = APPROVAL_STATUS.PENDING_APPROVAL;

    await loadMyApprovalRequests();
    return true;
  } catch (error) {
    hideLoading();
    console.error('Failed to resubmit:', error);
    showToast(`Failed to resubmit: ${error.message}`, 'error');
    return false;
  }
}

// ============================================================
// Director Actions (Approve/Reject/Revise)
// ============================================================

/**
 * Approve a quote (Sales Director/Executive only)
 */
export async function approveQuote(quoteNumber) {
  showLoading('Approving quote...', 'Processing');

  try {
    const response = await fetchWithAuth(`/api/salesquotes/approvals/${quoteNumber}/approve`, {
      method: 'POST'
    });

    hideLoading();
    showToast('Quote approved successfully', 'success');

    // Close modal and reload list
    closeApprovalPreviewModal();
    await loadPendingApprovals();
    await updatePendingApprovalsBadge();

    return true;
  } catch (error) {
    hideLoading();
    console.error('Failed to approve quote:', error);
    showToast(`Failed to approve: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Reject a quote (Sales Director/Executive only)
 */
export async function rejectQuote(quoteNumber, comment) {
  if (!comment || !comment.trim()) {
    showToast('Please provide a reason for rejection', 'error');
    return false;
  }

  showLoading('Rejecting quote...', 'Processing');

  try {
    const response = await fetchWithAuth(`/api/salesquotes/approvals/${quoteNumber}/reject`, {
      method: 'POST',
      body: JSON.stringify({ comment: comment.trim() })
    });

    hideLoading();
    showToast('Quote rejected', 'success');

    closeApprovalPreviewModal();
    await loadPendingApprovals();
    await updatePendingApprovalsBadge();

    return true;
  } catch (error) {
    hideLoading();
    console.error('Failed to reject quote:', error);
    showToast(`Failed to reject: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Request revision for a quote (Sales Director/Executive only)
 */
export async function requestRevision(quoteNumber, comment) {
  if (!comment || !comment.trim()) {
    showToast('Please provide comments for the requested revision', 'error');
    return false;
  }

  showLoading('Requesting revision...', 'Processing');

  try {
    const response = await fetchWithAuth(`/api/salesquotes/approvals/${quoteNumber}/revise`, {
      method: 'POST',
      body: JSON.stringify({ comment: comment.trim() })
    });

    hideLoading();
    showToast('Revision requested. Salesperson can now edit and resubmit.', 'success');

    closeApprovalPreviewModal();
    await loadPendingApprovals();
    await updatePendingApprovalsBadge();

    return true;
  } catch (error) {
    hideLoading();
    console.error('Failed to request revision:', error);
    showToast(`Failed to request revision: ${error.message}`, 'error');
    return false;
  }
}

// ============================================================
// Approval Preview Modal
// ============================================================

let currentPreviewQuoteNumber = null;

/**
 * Open approval preview modal
 */
export async function openApprovalPreviewModal(quoteNumber) {
  currentPreviewQuoteNumber = quoteNumber;

  // Load modal HTML dynamically
  const modalContainer = el('modalContainer');
  if (!modalContainer) return;

  try {
    const response = await fetch('/salesquotes/components/modals/approval-preview-modal.html');
    const modalHtml = await response.text();

    // Create modal element
    const modalWrapper = document.createElement('div');
    modalWrapper.innerHTML = modalHtml;
    const modal = modalWrapper.firstElementChild;

    // Move modal to end of container for proper stacking
    modalContainer.appendChild(modal);

    // Load quote data
    await loadQuoteForPreview(quoteNumber);

    // Show modal with animation
    setTimeout(() => {
      modal.classList.remove('opacity-0');
    }, 10);

  } catch (error) {
    console.error('Failed to load approval preview modal:', error);
    showToast('Failed to open preview', 'error');
  }
}

/**
 * Close approval preview modal
 */
export function closeApprovalPreviewModal() {
  const modal = el('approvalPreviewModal');
  if (!modal) return;

  modal.classList.add('opacity-0');

  setTimeout(() => {
    modal.remove();
    currentPreviewQuoteNumber = null;
  }, 300);
}

/**
 * Load quote data for preview modal
 */
async function loadQuoteForPreview(quoteNumber) {
  const previewContainer = el('approvalPreviewContent');
  const actionsContainer = el('approvalPreviewActions');

  if (!previewContainer) return;

  previewContainer.innerHTML = `
    <div class="flex items-center justify-center py-12">
      <div class="spinner"></div>
      <span class="ml-3 text-slate-600">Loading quote...</span>
    </div>
  `;

  try {
    // Fetch approval status
    const approvalResponse = await fetchWithAuth(`/api/salesquotes/approvals/${quoteNumber}`);
    const approval = approvalResponse.approval;

    // Fetch quote details from BC
    const bcResponse = await fetch(`/api/business-central/sales-quotes/${quoteNumber}`);
    if (!bcResponse.ok) throw new Error('Failed to fetch quote details');
    const quoteData = await bcResponse.json();

    // Fetch Sales Director signature if approved
    let directorSignature = null;
    if (approval.approvalStatus === APPROVAL_STATUS.APPROVED && approval.salesDirectorEmail) {
      // Get director's salesperson code (would need to be stored or looked up)
      // For now, use a special code format
      directorSignature = await fetchSalespersonSignature('DIRECTOR');
    }

    // Render preview
    renderQuotePreview(previewContainer, quoteData, approval, directorSignature);

    // Render action buttons based on status
    renderActionButtons(actionsContainer, approval);

  } catch (error) {
    console.error('Failed to load quote for preview:', error);
    previewContainer.innerHTML = `
      <div class="text-center py-12 text-red-500">
        Failed to load quote preview: ${error.message}
      </div>
    `;
    if (actionsContainer) actionsContainer.innerHTML = '';
  }
}

/**
 * Render quote preview content
 */
function renderQuotePreview(container, quoteData, approval, directorSignature) {
  const lines = quoteData.salesQuoteLines || quoteData.lines || [];
  const total = parseFloat(quoteData.totalAmount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  container.innerHTML = `
    <div class="space-y-4 p-6">
      <!-- Quote Header -->
      <div class="border-b pb-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-slate-900">${escapeHtml(quoteData.sellToCustomerName || quoteData.customerName || 'N/A')}</h3>
            <p class="text-sm text-slate-500">Quote No: ${escapeHtml(quoteData.number || quoteNumber)}</p>
          </div>
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_BADGE_CLASSES[approval.approvalStatus]}">
            ${STATUS_LABELS[approval.approvalStatus] || approval.approvalStatus}
          </span>
        </div>
      </div>

      <!-- Quote Details -->
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span class="text-slate-500">Salesperson:</span>
          <span class="ml-2 font-medium">${escapeHtml(approval.salespersonName || approval.salespersonEmail)}</span>
        </div>
        <div>
          <span class="text-slate-500">Total Amount:</span>
          <span class="ml-2 font-semibold">${total}</span>
        </div>
        <div>
          <span class="text-slate-500">Submitted:</span>
          <span class="ml-2">${approval.submittedForApprovalAt ? new Date(approval.submittedForApprovalAt).toLocaleString() : '-'}</span>
        </div>
      </div>

      <!-- Work Description -->
      ${approval.workDescription ? `
        <div class="bg-slate-50 rounded-lg p-3">
          <p class="text-xs text-slate-500 mb-1">Work Description:</p>
          <p class="text-sm text-slate-700 whitespace-pre-wrap">${escapeHtml(approval.workDescription)}</p>
        </div>
      ` : ''}

      <!-- Action Comment (if any) -->
      ${approval.actionComment ? `
        <div class="bg-blue-50 rounded-lg p-3">
          <p class="text-xs text-blue-600 mb-1">Director Comments:</p>
          <p class="text-sm text-blue-800 whitespace-pre-wrap">${escapeHtml(approval.actionComment)}</p>
        </div>
      ` : ''}

      <!-- Line Items -->
      <div>
        <h4 class="text-sm font-semibold text-slate-700 mb-2">Line Items</h4>
        <div class="overflow-x-auto border rounded-lg">
          <table class="w-full text-sm">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-3 py-2 text-left font-medium text-slate-600">No</th>
                <th class="px-3 py-2 text-left font-medium text-slate-600">Description</th>
                <th class="px-3 py-2 text-right font-medium text-slate-600">Qty</th>
                <th class="px-3 py-2 text-right font-medium text-slate-600">Unit Price</th>
                <th class="px-3 py-2 text-right font-medium text-slate-600">Line Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${lines.slice(0, 10).map(line => {
                const lineTotal = (parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0);
                return `
                  <tr>
                    <td class="px-3 py-2">${escapeHtml(line.lineObjectNumber || line.no || '-')}</td>
                    <td class="px-3 py-2">${escapeHtml(line.description || '-')}</td>
                    <td class="px-3 py-2 text-right">${parseFloat(line.quantity || 0)}</td>
                    <td class="px-3 py-2 text-right">${(parseFloat(line.unitPrice) || 0).toFixed(2)}</td>
                    <td class="px-3 py-2 text-right">${lineTotal.toFixed(2)}</td>
                  </tr>
                `;
              }).join('')}
              ${lines.length > 10 ? `
                <tr>
                  <td colspan="5" class="px-3 py-2 text-center text-slate-500 text-xs">
                    ... and ${lines.length - 10} more lines
                  </td>
                </tr>
              ` : ''}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Signature Preview (if approved) -->
      ${directorSignature ? `
        <div class="border-t pt-4">
          <p class="text-xs text-slate-500 mb-2">Approved by Sales Director:</p>
          <img src="${directorSignature}" alt="Director Signature" class="max-h-16" />
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render action buttons based on approval status
 */
function renderActionButtons(container, approval) {
  if (!container) return;

  const canApprove = authState.user?.effectiveRole === ROLE.SALES_DIRECTOR ||
                      authState.user?.effectiveRole === ROLE.EXECUTIVE;

  let buttons = '';

  if (canApprove && approval.approvalStatus === APPROVAL_STATUS.PENDING_APPROVAL) {
    buttons = `
      <button
        id="btnApproveQuote"
        type="button"
        class="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        Approve
      </button>
      <button
        id="btnRequestRevision"
        type="button"
        class="inline-flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-600 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
        </svg>
        Request Revision
      </button>
      <button
        id="btnRejectQuote"
        type="button"
        class="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
        Reject
      </button>
    `;
  }

  buttons += `
    <button
      id="btnClosePreview"
      type="button"
      class="inline-flex items-center gap-2 bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-300 transition-colors"
    >
      Close
    </button>
  `;

  container.innerHTML = `
    <div class="flex flex-wrap items-center justify-end gap-3 p-4 border-t bg-slate-50">
      ${buttons}
    </div>
  `;

  // Attach event listeners
  const btnApprove = el('btnApproveQuote');
  const btnRevise = el('btnRequestRevision');
  const btnReject = el('btnRejectQuote');
  const btnClose = el('btnClosePreview');

  if (btnApprove) {
    btnApprove.addEventListener('click', () => {
      if (currentPreviewQuoteNumber) {
        approveQuote(currentPreviewQuoteNumber);
      }
    });
  }

  if (btnRevise) {
    btnRevise.addEventListener('click', () => {
      const comment = prompt('Please enter revision comments:');
      if (comment && currentPreviewQuoteNumber) {
        requestRevision(currentPreviewQuoteNumber, comment);
      }
    });
  }

  if (btnReject) {
    btnReject.addEventListener('click', () => {
      const comment = prompt('Please enter rejection reason:');
      if (comment && currentPreviewQuoteNumber) {
        rejectQuote(currentPreviewQuoteNumber, comment);
      }
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', closeApprovalPreviewModal);
  }
}

// ============================================================
// Check Approval Status
// ============================================================

/**
 * Check approval status for a quote
 */
export async function checkApprovalStatus(quoteNumber) {
  try {
    const response = await fetchWithAuth(`/api/salesquotes/approvals/${quoteNumber}`);
    const approval = response.approval;

    if (approval) {
      state.approval.currentStatus = approval.approvalStatus;
      state.approval.canEdit = approval.approvalStatus === APPROVAL_STATUS.DRAFT ||
                               approval.approvalStatus === APPROVAL_STATUS.REVISE ||
                               approval.approvalStatus === APPROVAL_STATUS.CANCELLED;
      state.approval.canPrint = approval.approvalStatus === APPROVAL_STATUS.APPROVED ||
                               authState.user?.effectiveRole === ROLE.EXECUTIVE;
      state.approval.actionComment = approval.actionComment;
      state.approval.submittedAt = approval.submittedForApprovalAt;
      state.approval.directorActionAt = approval.salesDirectorActionAt;
    }

    return approval;
  } catch (error) {
    // No approval record exists - quote is in draft state
    state.approval.currentStatus = null;
    state.approval.canEdit = true;
    state.approval.canPrint = true;
    return null;
  }
}

// ============================================================
// Export Constants
// ============================================================

export { APPROVAL_STATUS, STATUS_LABELS, STATUS_BADGE_CLASSES };
