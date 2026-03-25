/**
 * Sales Quotes Approval Workflow Module
 * Handles multi-stage approval workflow for Sales Quotes
 */

import { state } from './state.js';
import { authState } from '../state.js';
import { ROLE, MODE } from '../core/config.js';
import { GATEWAY_API } from './config.js';
import { el, show, hide, showToast, showLoading, hideLoading, updateQuoteEditorModeUi } from './ui.js';
import { fetchSalesDirectorSignature } from './print-quote.js';
import { canApproveQuotes } from '../auth/mode-detection.js';
import { loadModal } from './components/modal-loader.js';

// ============================================================
// Constants
// ============================================================

const APPROVAL_STATUS = {
  DRAFT: 'Draft',
  SUBMITTED_TO_BC: 'SubmittedToBC',
  PENDING_APPROVAL: 'PendingApproval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  REVISE: 'Revise',
  CANCELLED: 'Cancelled',
  BEING_REVISED: 'BeingRevised'
};

const STATUS_LABELS = {
  Draft: 'Draft',
  SubmittedToBC: 'Submitted to BC',
  PendingApproval: 'Pending Approval',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Revise: 'Revision Requested',
  Cancelled: 'Cancelled',
  BeingRevised: 'Being Revised'
};

const STATUS_BADGE_CLASSES = {
  Draft: 'sq-status-badge-draft',
  SubmittedToBC: 'sq-status-badge-submitted',
  PendingApproval: 'sq-status-badge-pending',
  Approved: 'sq-status-badge-approved',
  Rejected: 'sq-status-badge-rejected',
  Revise: 'sq-status-badge-revise',
  Cancelled: 'sq-status-badge-cancelled',
  BeingRevised: 'sq-status-badge-being-revised'
};

const PENDING_REVISION_THRESHOLD_MS = 1000;
const APPROVAL_ACTION_STATUS_CLASS_MAP = {
  danger: 'sales-alert-status sales-alert-status-danger',
  warning: 'sales-alert-status sales-alert-status-warning',
  info: 'sales-alert-status sales-alert-status-info',
  neutral: 'sales-alert-status sales-alert-status-neutral'
};

const APPROVAL_ACTION_CONFIRM_CLASS_MAP = {
  primary: 'sales-alert-btn sales-alert-btn-primary',
  danger: 'sales-alert-btn sales-alert-btn-danger',
  warning: 'sales-alert-btn sales-alert-btn-warning',
  neutral: 'sales-alert-btn'
};

let approvalActionModalResolver = null;
let approvalActionModalConfig = null;
let approvalActionModalHideTimer = null;
let pendingApprovalsLoadSequence = 0;
let myApprovalsLoadSequence = 0;

function normalizePreviewLineType(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    return 'Item';
  }

  const canonical = normalized.toLowerCase();
  if (canonical === 'comment' || canonical === '_x2000_' || canonical === '_x0020_') {
    return 'Comment';
  }

  if (canonical === 'item') {
    return 'Item';
  }

  return normalized;
}

async function refreshApprovalsView() {
  const tasks = [loadMyApprovalRequests()];

  if (canApproveQuotes()) {
    tasks.unshift(loadPendingApprovals(), updatePendingApprovalsBadge());
  }

  await Promise.all(tasks);
}

function bindApprovalsTabEventListeners() {
  const refreshButton = el('pendingApprovalsRefreshBtn');

  if (refreshButton && refreshButton.dataset.bound !== 'true') {
    refreshButton.addEventListener('click', async () => {
      try {
        await refreshApprovalsView();
        showToast('Approvals refreshed', 'success');
      } catch (error) {
        console.error('Failed to refresh approvals view:', error);
        showToast(`Failed to refresh approvals. ${error.message}`, 'error');
      }
    });

    refreshButton.dataset.bound = 'true';
  }
}

function normalizeTimestamp(value) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function hasPendingRevisionRequest(approval) {
  if (typeof approval?.hasPendingRevisionRequest === 'boolean') {
    return approval.hasPendingRevisionRequest;
  }

  return approval?.approvalStatus === APPROVAL_STATUS.APPROVED &&
    typeof approval?.actionComment === 'string' &&
    approval.actionComment.trim() !== '' &&
    (() => {
      const updatedAtMs = normalizeTimestamp(approval?.updatedAt);
      const directorActionAtMs = normalizeTimestamp(approval?.salesDirectorActionAt);

      if (updatedAtMs === null || directorActionAtMs === null) {
        return false;
      }

      return (updatedAtMs - directorActionAtMs) > PENDING_REVISION_THRESHOLD_MS;
    })();
}

function getApprovalStatusPresentation(approval) {
  if (hasPendingRevisionRequest(approval)) {
    return {
      label: 'Revision Request Pending',
      badgeClass: 'sq-status-badge-pending-revision'
    };
  }

  return {
    label: STATUS_LABELS[approval?.approvalStatus] || approval?.approvalStatus || '-',
    badgeClass: STATUS_BADGE_CLASSES[approval?.approvalStatus] || 'sq-status-badge-draft'
  };
}

function renderApprovalRowsSkeleton(rowCount = 4) {
  return Array.from({ length: rowCount }, (_, index) => `
    <tr class="${index % 2 === 0 ? 'bg-white/70' : 'bg-slate-50/40'}">
      <td class="px-4 py-4"><span class="sq-records-skeleton-line sq-records-skeleton-line-sm"></span></td>
      <td class="px-4 py-4"><span class="sq-records-skeleton-line sq-records-skeleton-line-md"></span></td>
      <td class="px-4 py-4"><span class="sq-records-skeleton-line sq-records-skeleton-line-md"></span></td>
      <td class="px-4 py-4"><span class="sq-records-skeleton-line sq-records-skeleton-line-sm ml-auto"></span></td>
      <td class="px-4 py-4"><span class="sq-records-skeleton-line sq-records-skeleton-line-md"></span></td>
      <td class="px-4 py-4"><span class="sq-records-skeleton-line sq-records-skeleton-line-sm"></span></td>
    </tr>
  `).join('');
}

function setPendingApprovalsLoadingState(isLoading) {
  const banner = el('pendingApprovalsLoadingBanner');
  const countEl = el('pendingApprovalsCount');
  const refreshButton = el('pendingApprovalsRefreshBtn');

  banner?.classList.toggle('hidden', !isLoading);

  if (countEl && isLoading) {
    countEl.textContent = 'Loading...';
  }

  if (refreshButton) {
    refreshButton.disabled = isLoading;
    refreshButton.classList.toggle('opacity-60', isLoading);
    refreshButton.classList.toggle('cursor-not-allowed', isLoading);
  }
}

function setMyApprovalsLoadingState(isLoading) {
  const banner = el('myApprovalsLoadingBanner');
  const countEl = el('myApprovalsCount');

  banner?.classList.toggle('hidden', !isLoading);

  if (countEl && isLoading) {
    countEl.textContent = 'Loading...';
  }
}

function getApprovalActionModalElements() {
  return {
    modal: el('approvalActionModal'),
    modalContent: el('approvalActionModalContent'),
    status: el('approvalActionModalStatus'),
    title: el('approvalActionModalTitle'),
    text: el('approvalActionModalText'),
    contextSection: el('approvalActionModalContextSection'),
    contextLabel: el('approvalActionModalContextLabel'),
    contextValue: el('approvalActionModalContextValue'),
    inputSection: el('approvalActionModalInputSection'),
    inputLabel: el('approvalActionModalInputLabel'),
    textarea: el('approvalActionModalTextarea'),
    inputHint: el('approvalActionModalInputHint'),
    error: el('approvalActionModalError'),
    cancelBtn: el('approvalActionModalCancelBtn'),
    confirmBtn: el('approvalActionModalConfirmBtn')
  };
}

function clearApprovalActionModalError() {
  const { textarea, error } = getApprovalActionModalElements();

  if (textarea) {
    textarea.setAttribute('aria-invalid', 'false');
  }

  if (error) {
    error.textContent = '';
    error.classList.add('hidden');
  }
}

function setApprovalActionModalError(message) {
  const { textarea, error } = getApprovalActionModalElements();

  if (textarea) {
    textarea.setAttribute('aria-invalid', 'true');
  }

  if (error) {
    error.textContent = message;
    error.classList.remove('hidden');
  }
}

function hideApprovalActionModal() {
  const { modal, modalContent, textarea, inputHint, inputSection, contextSection } = getApprovalActionModalElements();
  if (!modal || !modalContent) {
    return;
  }

  modalContent.style.opacity = '0';
  modalContent.style.transform = 'translateY(-10px)';

  if (approvalActionModalHideTimer) {
    window.clearTimeout(approvalActionModalHideTimer);
  }

  approvalActionModalHideTimer = window.setTimeout(() => {
    modal.classList.add('hidden');

    if (textarea) {
      textarea.value = '';
    }

    if (inputHint) {
      inputHint.textContent = '';
      inputHint.classList.add('hidden');
    }

    if (inputSection) {
      inputSection.classList.add('hidden');
    }

    if (contextSection) {
      contextSection.classList.add('hidden');
    }

    clearApprovalActionModalError();
    approvalActionModalHideTimer = null;
  }, 180);
}

function resolveApprovalActionModal(result) {
  const resolver = approvalActionModalResolver;

  approvalActionModalResolver = null;
  approvalActionModalConfig = null;
  hideApprovalActionModal();

  if (typeof resolver === 'function') {
    resolver(result);
  }
}

function handleApprovalActionModalCancel() {
  if (!approvalActionModalResolver) {
    return;
  }

  resolveApprovalActionModal({ confirmed: false, comment: '' });
}

function handleApprovalActionModalConfirm() {
  if (!approvalActionModalResolver) {
    return;
  }

  const { textarea } = getApprovalActionModalElements();
  const requireComment = approvalActionModalConfig?.requireComment === true;
  const comment = textarea?.value?.trim?.() || '';

  if (requireComment && !comment) {
    setApprovalActionModalError('Please provide a comment before continuing.');
    textarea?.focus();
    return;
  }

  resolveApprovalActionModal({ confirmed: true, comment });
}

function handleApprovalActionModalKeydown(event) {
  if (event.key === 'Escape' && approvalActionModalResolver) {
    event.preventDefault();
    handleApprovalActionModalCancel();
  }
}

function bindApprovalActionModalEvents() {
  const { modal, cancelBtn, confirmBtn, textarea } = getApprovalActionModalElements();

  if (!modal || modal.dataset.bound === 'true') {
    return;
  }

  cancelBtn?.addEventListener('click', handleApprovalActionModalCancel);
  confirmBtn?.addEventListener('click', handleApprovalActionModalConfirm);
  textarea?.addEventListener('input', clearApprovalActionModalError);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      handleApprovalActionModalCancel();
    }
  });
  document.addEventListener('keydown', handleApprovalActionModalKeydown);

  modal.dataset.bound = 'true';
}

function getApprovalActionModalHost() {
  const previewModal = el('approvalPreviewModal');
  if (previewModal && previewModal.open) {
    return previewModal;
  }

  return el('modalContainer');
}

async function ensureApprovalActionModal() {
  let modal = el('approvalActionModal');

  if (!modal) {
    try {
      const loaded = await loadModal('approvalActionModal');
      if (!loaded) {
        throw new Error('Modal could not be loaded');
      }
      modal = el('approvalActionModal');
    } catch (error) {
      console.error('Failed to load approval action modal:', error);
      showToast('Failed to open approval dialog. Please try again.', 'error');
      return false;
    }
  }

  bindApprovalActionModalEvents();
  return modal !== null;
}

export async function showApprovalActionModal(options = {}) {
  const ready = await ensureApprovalActionModal();
  if (!ready || approvalActionModalResolver) {
    return { confirmed: false, comment: '' };
  }

  const {
    modal,
    modalContent,
    status,
    title,
    text,
    contextSection,
    contextLabel,
    contextValue,
    inputSection,
    inputLabel,
    textarea,
    inputHint,
    cancelBtn,
    confirmBtn
  } = getApprovalActionModalElements();

  if (!modal || !modalContent || !status || !title || !text || !cancelBtn || !confirmBtn) {
    showToast('Approval dialog is unavailable. Please refresh the page.', 'error');
    return { confirmed: false, comment: '' };
  }

  const statusTone = APPROVAL_ACTION_STATUS_CLASS_MAP[options.statusTone] ? options.statusTone : 'neutral';
  const confirmVariant = APPROVAL_ACTION_CONFIRM_CLASS_MAP[options.confirmVariant] ? options.confirmVariant : 'primary';
  const normalizedContextValue = String(options.contextValue ?? '').trim();
  const requireComment = options.requireComment === true;

  approvalActionModalConfig = { requireComment };

  status.className = APPROVAL_ACTION_STATUS_CLASS_MAP[statusTone];
  status.textContent = options.status || 'Approval Action';

  title.textContent = options.title || 'Confirm action';
  text.textContent = options.message || 'Please review the details before continuing.';

  if (contextSection && contextLabel && contextValue) {
    if (normalizedContextValue) {
      contextLabel.textContent = options.contextLabel || 'Sales Quote';
      contextValue.textContent = normalizedContextValue;
      contextSection.className = 'sales-alert-section sales-alert-section-info';
      contextSection.classList.remove('hidden');
    } else {
      contextValue.textContent = '';
      contextSection.classList.add('hidden');
    }
  }

  if (inputSection && inputLabel && textarea) {
    if (requireComment) {
      inputLabel.textContent = options.commentLabel || 'Comments';
      textarea.placeholder = options.commentPlaceholder || 'Enter details...';
      textarea.rows = Number.isInteger(options.commentRows) && options.commentRows > 1
        ? options.commentRows
        : 4;
      textarea.value = typeof options.initialComment === 'string' ? options.initialComment : '';
      inputSection.classList.remove('hidden');
    } else {
      textarea.value = '';
      inputSection.classList.add('hidden');
    }
  }

  if (inputHint) {
    const helperText = typeof options.commentHint === 'string' ? options.commentHint.trim() : '';
    inputHint.textContent = helperText;
    inputHint.classList.toggle('hidden', helperText.length === 0 || !requireComment);
  }

  clearApprovalActionModalError();
  cancelBtn.textContent = options.cancelText || 'Cancel';
  confirmBtn.textContent = options.confirmText || 'Confirm';
  confirmBtn.className = APPROVAL_ACTION_CONFIRM_CLASS_MAP[confirmVariant];

  if (approvalActionModalHideTimer) {
    window.clearTimeout(approvalActionModalHideTimer);
    approvalActionModalHideTimer = null;
  }

  const modalHost = getApprovalActionModalHost();
  if (modalHost) {
    // Keep the confirmation dialog inside the browser top-layer dialog when
    // the approval preview is open, otherwise it can render behind the preview.
    modalHost.appendChild(modal);
  }

  modal.style.zIndex = '160';
  modal.classList.remove('hidden');
  modalContent.style.opacity = '0';
  modalContent.style.transform = 'translateY(-10px)';

  const resultPromise = new Promise((resolve) => {
    approvalActionModalResolver = resolve;
  });

  window.requestAnimationFrame(() => {
    modalContent.style.opacity = '1';
    modalContent.style.transform = 'translateY(0)';
  });

  window.setTimeout(() => {
    if (requireComment && textarea) {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    } else {
      confirmBtn.focus();
    }
  }, 30);

  return resultPromise;
}

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

function isExplicitApiFailure(value) {
  return value === false || value === 'false' || value === 'False';
}

function extractGatewayFailureMessage(responseData) {
  if (!responseData || typeof responseData !== 'object') {
    return 'PatchSalesQuote request failed';
  }

  return responseData.error ||
    responseData.message ||
    responseData.result?.error ||
    responseData.result?.message ||
    'PatchSalesQuote request failed';
}

async function syncQuoteStatusToPendingApprovalInBc(salesQuoteNumber) {
  if (!salesQuoteNumber) {
    return;
  }

  try {
    const response = await fetch(GATEWAY_API.PATCH_SALES_QUOTE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        salesQuoteNo: salesQuoteNumber,
        status: 'Pending Approval'
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}${errorText ? `: ${errorText}` : ''}`);
    }

    const responseData = await response.json().catch(() => ({}));
    const gatewayReportedFailure = [
      responseData?.success,
      responseData?.Success,
      responseData?.result?.success,
      responseData?.result?.Success
    ].some(isExplicitApiFailure);

    if (gatewayReportedFailure) {
      throw new Error(extractGatewayFailureMessage(responseData));
    }
  } catch (error) {
    console.warn('[Approval] Silent BC Pending Approval patch failed:', {
      salesQuoteNumber,
      error: error?.message || error
    });
  }
}

function resetApprovalState() {
  state.quote.approvalStatus = null;
  state.approval.currentStatus = null;
  state.approval.canEdit = true;
  state.approval.canPrint = true;
  state.approval.approvalOwnerEmail = null;
  state.approval.salespersonEmail = null;
  state.approval.actionComment = null;
  state.approval.hasPendingRevisionRequest = false;
  state.approval.submittedAt = null;
  state.approval.directorActionAt = null;
  state.approval.updatedAt = null;
}

function applyApprovalIdentity(approval) {
  if (!approval) {
    return;
  }

  state.approval.approvalOwnerEmail = approval.approvalOwnerEmail || approval.salespersonEmail || null;
  state.approval.salespersonEmail = approval.salespersonEmail || null;
}

// ============================================================
// Tab Visibility
// ============================================================

/**
 * Initialize visibility of approvals sections based on user role
 * - Pending Approvals: Sales Director/Executive only
 * - My Approval Requests: All authenticated users
 */
export function initializeApprovalsSectionVisibility() {
  const pendingSection = el('pendingApprovalsSection');
  const myApprovalsSection = el('myApprovalsSection');

  // Pending Approvals section - only for directors/executives
  if (pendingSection) {
    if (canApproveQuotes()) {
      show('pendingApprovalsSection');
    } else {
      hide('pendingApprovalsSection');
    }
  }

  // My Approval Requests section - always show for authenticated users
  if (myApprovalsSection) {
    show('myApprovalsSection');
  }
}

/**
 * Initialize approvals tab - show/hide based on user role
 */
export async function initializeApprovalsTab() {
  const userRole = authState.user?.effectiveRole;
  const tabApprovals = el('tabApprovals');
  const approvalsBadge = el('approvalsBadge');

  // Hide tab for unauthenticated users or NoRole
  const hasRole = userRole && userRole !== ROLE.NO_ROLE;

  if (hasRole && tabApprovals) {
    show('tabApprovals');
    if (approvalsBadge) show('approvalsBadge');
    bindApprovalsTabEventListeners();

    // Initialize section visibility
    initializeApprovalsSectionVisibility();

    // Only update badge for directors/executives
    if (canApproveQuotes()) {
      // Graceful error handling - badge update is non-critical
      try {
        await updatePendingApprovalsBadge();
      } catch (error) {
        console.warn('[Approvals] Could not update badge (auth state may differ from backend):', error.message);
      }
    } else {
      // Hide badge for non-directors
      if (approvalsBadge) hide('approvalsBadge');
    }
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
  const currentLoadSequence = ++pendingApprovalsLoadSequence;

  if (!container) return;

  setPendingApprovalsLoadingState(true);
  container.innerHTML = renderApprovalRowsSkeleton();

  try {
    const response = await fetchWithAuth('/api/salesquotes/approvals/list/pending');
    if (currentLoadSequence !== pendingApprovalsLoadSequence) {
      return;
    }

    const countEl = el('pendingApprovalsCount');

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
    if (currentLoadSequence !== pendingApprovalsLoadSequence) {
      return;
    }

    console.error('Failed to load pending approvals:', error);
    container.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-10 text-center text-red-500">
          Failed to load pending approvals. ${error.message}
        </td>
      </tr>
    `;
  } finally {
    if (currentLoadSequence === pendingApprovalsLoadSequence) {
      setPendingApprovalsLoadingState(false);
    }
  }
}

/**
 * Load my approval requests for Sales users
 */
export async function loadMyApprovalRequests() {
  const container = el('myApprovalsList');
  const currentLoadSequence = ++myApprovalsLoadSequence;

  if (!container) return;

  setMyApprovalsLoadingState(true);
  container.innerHTML = renderApprovalRowsSkeleton();

  try {
    const response = await fetchWithAuth('/api/salesquotes/approvals/list/my-requests');
    if (currentLoadSequence !== myApprovalsLoadSequence) {
      return;
    }

    const countEl = el('myApprovalsCount');

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

    container.querySelectorAll('[data-action="cancel-request"]').forEach(button => {
      button.addEventListener('click', () => {
        const quoteNumber = button.getAttribute('data-quote-number');
        if (quoteNumber) {
          cancelApprovalRequest(quoteNumber);
        }
      });
    });

  } catch (error) {
    if (currentLoadSequence !== myApprovalsLoadSequence) {
      return;
    }

    console.error('Failed to load my approval requests:', error);
    container.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-10 text-center text-red-500">
          Failed to load your requests. ${error.message}
        </td>
      </tr>
    `;
  } finally {
    if (currentLoadSequence === myApprovalsLoadSequence) {
      setMyApprovalsLoadingState(false);
    }
  }
}

function renderApprovalRow(approval) {
  const submittedAt = approval.submittedForApprovalAt
    ? new Date(approval.submittedForApprovalAt).toLocaleString()
    : '-';
  const statusPresentation = getApprovalStatusPresentation(approval);

  const total = parseFloat(approval.totalAmount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return `
    <tr class="hover:bg-slate-50 cursor-pointer" data-action="open-approval-preview" data-quote-number="${escapeHtml(approval.salesQuoteNumber)}">
      <td class="px-4 py-3 font-medium">
        <span class="sq-link-action">${escapeHtml(approval.salesQuoteNumber)}</span>
      </td>
      <td class="px-4 py-3">${escapeHtml(approval.customerName || '-')}</td>
      <td class="px-4 py-3">${escapeHtml(approval.salespersonName || approval.salespersonEmail)}</td>
      <td class="px-4 py-3 text-right">${total}</td>
      <td class="px-4 py-3 whitespace-nowrap">${submittedAt}</td>
      <td class="px-4 py-3">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusPresentation.badgeClass}">
          ${statusPresentation.label}
        </span>
      </td>
    </tr>
  `;
}

function renderMyApprovalRow(approval) {
  const submittedAt = approval.submittedForApprovalAt
    ? new Date(approval.submittedForApprovalAt).toLocaleString()
    : '-';
  const statusPresentation = getApprovalStatusPresentation(approval);
  const pendingRevisionRequest = hasPendingRevisionRequest(approval);

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
  } else if (approval.approvalStatus === APPROVAL_STATUS.REVISE ||
             approval.approvalStatus === APPROVAL_STATUS.REJECTED ||
             approval.approvalStatus === APPROVAL_STATUS.BEING_REVISED) {
    actionButton = `
      <button
        type="button"
        class="text-sm sq-link-action hover:underline"
        data-action="view-quote"
        data-quote-number="${escapeHtml(approval.salesQuoteNumber)}"
      >
        Edit & Resubmit
      </button>
    `;
  } else if (pendingRevisionRequest) {
    actionButton = `
      <span class="sq-chip sq-chip-warning">
        Awaiting revision approval
      </span>
    `;
  }

  return `
    <tr class="hover:bg-slate-50">
      <td class="px-4 py-3 font-medium">
        <button
          type="button"
          class="inline-flex items-center gap-1 sq-link-action hover:underline"
          data-action="view-quote"
          data-quote-number="${escapeHtml(approval.salesQuoteNumber)}"
        >
          ${escapeHtml(approval.salesQuoteNumber)}
        </button>
      </td>
      <td class="px-4 py-3">${escapeHtml(approval.customerName || '-')}</td>
      <td class="px-4 py-3 text-right">${total}</td>
      <td class="px-4 py-3">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusPresentation.badgeClass}">
          ${statusPresentation.label}
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
// Create Approval Record
// ============================================================

/**
 * Create approval record in "Submitted to BC" status
 * This creates the record without submitting for approval
 */
export async function createApprovalRecord(quoteData) {
  const { salesQuoteNumber, salespersonCode, salespersonName, customerName, workDescription, totalAmount } = quoteData;

  if (!salesQuoteNumber) {
    console.error('[Approval] Sales Quote number is required for approval record creation');
    return false;
  }

  // Auto-approval removed - always create the record regardless of total amount
  try {
    const response = await fetchWithAuth('/api/salesquotes/approvals/initialize', {
      method: 'POST',
      body: JSON.stringify({
        salesQuoteNumber,
        salespersonCode,
        salespersonName,
        customerName,
        workDescription,
        totalAmount
      })
    });

    state.approval.currentStatus = response.approval?.approvalStatus || APPROVAL_STATUS.SUBMITTED_TO_BC;
    applyApprovalIdentity(response.approval);

    console.log('[Approval] Approval record created in SubmittedToBC status');
    return true;
  } catch (error) {
    console.error('Failed to create approval record:', error);
    // Don't show error to user - quote creation succeeded, just approval record creation failed
    return false;
  }
}

/**
 * Send approval request (transition from SubmittedToBC to PendingApproval)
 * This is called manually when user clicks "Send Approval Request" button
 */
export async function sendApprovalRequest(quoteData) {
  const { salesQuoteNumber, salespersonCode, salespersonName, customerName, workDescription, totalAmount } = quoteData;

  if (!salesQuoteNumber) {
    showToast('Sales Quote number is required', 'error');
    return false;
  }

  // Auto-approval removed - always submit for approval regardless of total amount
  showLoading('Sending Approval Request', 'Submitting to Sales Director...');

  try {
    const response = await fetchWithAuth('/api/salesquotes/approvals', {
      method: 'POST',
      body: JSON.stringify({
        salesQuoteNumber,
        salespersonCode,
        salespersonName,
        customerName,
        workDescription,
        totalAmount
      })
    });

    state.approval.currentStatus = response.approval?.approvalStatus || APPROVAL_STATUS.PENDING_APPROVAL;
    applyApprovalIdentity(response.approval);

    hideLoading();

    showToast('Quote submitted for approval', 'success');

    // Update UI to reflect new status (hide "Send Approval Request" button, update badge)
    await updateQuoteEditorModeUi();
    void syncQuoteStatusToPendingApprovalInBc(salesQuoteNumber);

    return true;
  } catch (error) {
    hideLoading();
    console.error('Failed to send approval request:', error);
    showToast(`Failed to send approval request: ${error.message}`, 'error');
    return false;
  }
}

// ============================================================
// Submit for Approval (legacy - kept for backward compatibility)
// ============================================================

/**
 * Submit current quote for approval (called after successful BC creation)
 * NOTE: This function is kept for backward compatibility but should not be used
 * for new quotes. Use createApprovalRecord() instead.
 */
export async function submitForApproval(quoteData) {
  const { salesQuoteNumber, salespersonCode, salespersonName, customerName, workDescription, totalAmount } = quoteData;

  if (!salesQuoteNumber) {
    showToast('Sales Quote number is required', 'error');
    return false;
  }

  // Auto-approval removed - always submit for approval regardless of total amount
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
        totalAmount
      })
    });

    state.approval.currentStatus = response.approval?.approvalStatus || APPROVAL_STATUS.PENDING_APPROVAL;
    applyApprovalIdentity(response.approval);

    hideLoading();

    showToast('Quote submitted for approval', 'success');
    void syncQuoteStatusToPendingApprovalInBc(salesQuoteNumber);

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
  const modalResult = await showApprovalActionModal({
    status: 'Pending Approval',
    statusTone: 'warning',
    title: 'Cancel approval request?',
    message: 'This quote will be removed from the current approval queue. You can send a new request again later.',
    contextLabel: 'Sales Quote',
    contextValue: quoteNumber,
    confirmText: 'Cancel Request',
    confirmVariant: 'danger'
  });

  if (!modalResult.confirmed) {
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
    applyApprovalIdentity(response.approval);
    void syncQuoteStatusToPendingApprovalInBc(quoteNumber);

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
    showToast('Quote rejected. Salesperson can now edit and resubmit.', 'success');

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
 * NOTE: This function is for SD requesting revision on PendingApproval quotes
 * For Sales users requesting revision on Approved quotes, use requestRevisionForApprovedQuote()
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

/**
 * Request revision for an Approved quote (Sales user)
 * This is used when Sales user needs to modify an already-approved quote
 * Requires SD approval to proceed
 */
export async function requestRevisionForApprovedQuote(quoteNumber, comment) {
  if (!comment || !comment.trim()) {
    showToast('Please provide a reason for the revision request', 'error');
    return false;
  }

  showLoading('Submitting revision request...', 'Processing');

  try {
    const response = await fetchWithAuth(`/api/salesquotes/approvals/${quoteNumber}/request-revision`, {
      method: 'POST',
      body: JSON.stringify({ comment: comment.trim() })
    });

    hideLoading();
    showToast('Revision request submitted. Awaiting Sales Director approval.', 'success');

    // Refresh approval status
    if (state.quote.number === quoteNumber) {
      await checkApprovalStatus(quoteNumber);
      await updateQuoteEditorModeUi();
    }

    await loadMyApprovalRequests();

    return true;
  } catch (error) {
    hideLoading();
    console.error('Failed to submit revision request:', error);
    showToast(`Failed to submit revision request: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Approve a revision request (Sales Director/Executive only)
 * Transitions quote from Approved to BeingRevised
 */
export async function approveRevisionRequest(quoteNumber) {
  const modalResult = await showApprovalActionModal({
    status: 'Revision Request',
    statusTone: 'info',
    title: 'Approve revision request?',
    message: 'The quote will move to Being Revised and become editable by the Sales user.',
    contextLabel: 'Sales Quote',
    contextValue: quoteNumber,
    confirmText: 'Approve Request',
    confirmVariant: 'primary'
  });

  if (!modalResult.confirmed) {
    return false;
  }

  showLoading('Approving revision request...', 'Processing');

  try {
    const response = await fetchWithAuth(`/api/salesquotes/approvals/${quoteNumber}/approve-revision`, {
      method: 'POST'
    });

    hideLoading();
    showToast('Revision request approved. Quote is now editable.', 'success');

    closeApprovalPreviewModal();
    await loadPendingApprovals();
    await updatePendingApprovalsBadge();

    return true;
  } catch (error) {
    hideLoading();
    console.error('Failed to approve revision request:', error);
    showToast(`Failed to approve revision: ${error.message}`, 'error');
    return false;
  }
}

// ============================================================
// Approval Preview Modal
// ============================================================

let currentPreviewQuoteNumber = null;

function formatPreviewMoney(value) {
  return (Number.isFinite(value) ? value : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatPreviewNumber(value, fractionDigits = 2) {
  return (Number.isFinite(value) ? value : 0).toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
}

function toPreviewNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const normalized = typeof value === 'string'
    ? value.replace(/,/g, '').trim()
    : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPreviewDateTime(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

function formatPreviewDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString();
  }

  return String(value);
}

function getPreviewSources(quoteData) {
  const reportRoot = quoteData?.NavWordReportXmlPart && typeof quoteData.NavWordReportXmlPart === 'object'
    ? quoteData.NavWordReportXmlPart
    : null;
  const salesHeader = reportRoot?.Sales_Header && typeof reportRoot.Sales_Header === 'object'
    ? reportRoot.Sales_Header
    : null;

  return [quoteData, reportRoot, salesHeader].filter(Boolean);
}

function pickPreviewValue(quoteData, keys, fallback = '') {
  const sources = getPreviewSources(quoteData);

  for (const source of sources) {
    for (const key of keys) {
      const value = source?.[key];
      if (value !== null && value !== undefined && value !== '') {
        return value;
      }
    }
  }

  return fallback;
}

function normalizePreviewLine(line, index) {
  const quantity = toPreviewNumber(line?.quantity ?? line?.Quantity ?? line?.qty ?? line?.Qty_SaleLine);
  const unitPrice = toPreviewNumber(line?.unitPrice ?? line?.Unit_Price);
  const discountAmount = toPreviewNumber(line?.discountAmount ?? line?.lineDiscountAmount ?? line?.Line_Discount_Amount ?? line?.Discount);
  const discountPercent = toPreviewNumber(line?.discountPercent ?? line?.lineDiscountPercent);
  const amountExcludingTax = toPreviewNumber(line?.amountExcludingTax ?? line?.lineAmount ?? line?.Line_Amount, NaN);
  const lineTotal = Number.isFinite(amountExcludingTax)
    ? amountExcludingTax
    : (quantity * unitPrice) - discountAmount;

  return {
    sequence: index + 1,
    type: normalizePreviewLineType(line?.lineType ?? line?.type ?? line?.Type) || '-',
    groupNo: String(line?.usvtGroupNo ?? line?.groupNo ?? line?.USVT_Group_No_ ?? '').trim() || '-',
    no: String(line?.lineObjectNumber ?? line?.itemNo ?? line?.ItemNo_SaleLine ?? line?.no ?? line?.No_ ?? line?.number ?? '').trim() || '-',
    description: String(line?.description ?? line?.Description_SaleLine ?? '').trim() || '-',
    quantity,
    unitOfMeasureCode: String(line?.unitOfMeasureCode ?? line?.Unit_of_Measure ?? '').trim() || '-',
    unitPrice,
    discountPercent,
    discountAmount,
    lineTotal,
    serviceItemNo: String(line?.usvtServiceItemNo ?? line?.serviceItemNo ?? '').trim() || '-',
    serviceStatus: String(line?.usvtUServiceStatus ?? line?.uServiceStatus ?? '').trim() || '-',
    refServiceOrderNo: String(line?.usvtRefServiceOrderNo ?? line?.refServiceOrderNo ?? '').trim() || '-',
    showInDocument: Boolean(line?.usvtShowInDocument ?? line?.showInDocument ?? line?.USVT_Show_in_Document ?? true),
    isHeader: Boolean(line?.usvtHeader ?? line?.header ?? line?.USVT_Header ?? false),
    isFooter: Boolean(line?.usvtFooter ?? line?.footer ?? line?.USVT_Footer ?? false)
  };
}

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
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    }
    modal.querySelector('#btnCloseApprovalPreview')?.addEventListener('click', closeApprovalPreviewModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal && typeof modal.close !== 'function') {
        closeApprovalPreviewModal();
      }
    });

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
    if (typeof modal.close === 'function' && modal.open) {
      modal.close();
    }
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
    <div class="sq-inline-loading flex items-center justify-center py-12">
      <div class="spinner sq-spinner"></div>
      <span class="ml-3 text-slate-600">Loading quote...</span>
    </div>
  `;

  try {
    // Fetch approval status
    const approvalResponse = await fetchWithAuth(`/api/salesquotes/approvals/${quoteNumber}`);
    const approval = approvalResponse.approval;

    // Fetch quote details from BC using the correct gateway endpoint
    const bcResponse = await fetch(`${GATEWAY_API.GET_SALES_QUOTES_FROM_NUMBER}?salesQuoteNumber=${encodeURIComponent(quoteNumber)}`);
    if (!bcResponse.ok) throw new Error('Failed to fetch quote details');
    const bcResponseData = await bcResponse.json();
    
    // Extract quote data from gateway response format (result.data wrapper)
    const quoteData = bcResponseData.data || bcResponseData.result?.data || bcResponseData.result;

    // Fetch Sales Director signature if approved
    let directorSignature = null;
    if (approval.approvalStatus === APPROVAL_STATUS.APPROVED) {
      const signature = await fetchSalesDirectorSignature();
      directorSignature = signature?.signatureData || null;
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
  const lines = (quoteData.salesQuoteLines || quoteData.lines || []).map(normalizePreviewLine);
  const statusPresentation = getApprovalStatusPresentation(approval);
  const pendingRevisionRequest = hasPendingRevisionRequest(approval);
  const quoteNumber = pickPreviewValue(quoteData, ['number', 'quoteNumber', 'salesQuoteNumber', 'No_', 'DocNo_SaleHeader'], approval.salesQuoteNumber || currentPreviewQuoteNumber || 'N/A');
  const actionCommentLabel = pendingRevisionRequest ? 'Revision Request Reason:' : 'Director Comments:';
  const customerName = pickPreviewValue(quoteData, ['sellToCustomerName', 'customerName', 'billToName', 'Name'], approval.customerName || 'N/A');
  const customerNo = pickPreviewValue(quoteData, ['sellToCustomerNo', 'selltoCustomerNo', 'billToCustomerNo', 'billtoCustomerNo', 'customerNumber'], '-');
  const branch = pickPreviewValue(quoteData, ['branch', 'branchCode', 'shortcutDimension1Code', 'responsibilityCenter'], '-');
  const division = pickPreviewValue(quoteData, ['shortcutDimension2Code', 'division'], '-');
  const locationCode = pickPreviewValue(quoteData, ['locationCode'], '-');
  const responsibilityCenter = pickPreviewValue(quoteData, ['responsibilityCenter', 'branch', 'branchCode'], '-');
  const assignedUserId = pickPreviewValue(quoteData, ['assignedUserId'], '-');
  const contact = pickPreviewValue(quoteData, ['contactName', 'shipToContact', 'billToContact', 'Bill_to_Contact'], '-');
  const salespersonCode = pickPreviewValue(quoteData, ['salespersonCode', 'salesPersonCode'], '-');
  const serviceOrderType = pickPreviewValue(quoteData, ['serviceOrderType'], '-');
  const workStatus = pickPreviewValue(quoteData, ['workStatus', 'WorkStatus', 'workstatus'], '-');
  const orderDate = pickPreviewValue(quoteData, ['orderDate', 'OrderDate_SaleHeader', 'Order_Date', 'documentDate', 'DocumentDate_SalesHeader'], '');
  const requestedDeliveryDate = pickPreviewValue(quoteData, ['requestedDeliveryDate', 'RequestedDeliveryDate_SalesHeader', 'usvtDeliveryDate', 'USVT_Delivery_Date'], '');
  const externalDocumentNo = pickPreviewValue(quoteData, ['externalDocumentNo', 'exDocNo', 'ExDocNo_SalesHeader'], '-');
  const paymentTerms = pickPreviewValue(quoteData, ['paymentTermsDescription', 'descriptionPaymentTerms', 'Description_PaymentTerms', 'paymentTermsCode', 'Payment_Terms_Code'], '-');
  const paymentMethod = pickPreviewValue(quoteData, ['paymentMethodDescription', 'descriptionPaymentMethod', 'Description_PaymentMethod'], '-');
  const shipMethod = pickPreviewValue(quoteData, ['shipMethodDescription', 'descriptionShipMethod', 'Description_ShipMethod'], '-');
  const sellToPhoneNo = pickPreviewValue(quoteData, ['sellToPhoneNo', 'Sell_to_Phone_No_'], '-');
  const submittedAt = formatPreviewDateTime(approval.submittedForApprovalAt);
  const addressParts = [
    pickPreviewValue(quoteData, ['sellToAddress', 'shipToAddress', 'Ship_to_Address', 'address'], ''),
    pickPreviewValue(quoteData, ['sellToAddress2', 'address2'], ''),
    pickPreviewValue(quoteData, ['sellToCity', 'city'], ''),
    pickPreviewValue(quoteData, ['sellToPostCode', 'postCode'], '')
  ].filter(Boolean);
  const subtotal = lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0);
  const lineDiscountTotal = lines.reduce((sum, line) => sum + line.discountAmount, 0);
  const invoiceDiscount = toPreviewNumber(pickPreviewValue(quoteData, ['discountAmount', 'invoiceDiscount', 'paymentDiscountAmount'], 0));
  const total = toPreviewNumber(
    pickPreviewValue(quoteData, ['totalAmount', 'amountIncludingTax', 'totalAmountIncludingTax', 'TotalAmt5', 'Total'], lines.reduce((sum, line) => sum + line.lineTotal, 0))
  );
  const amountExVat = toPreviewNumber(
    pickPreviewValue(quoteData, ['amountExcludingTax', 'amountExcludingVAT', 'TotalAmt1'], total - ((total * 7) / 107))
  );
  const vatAmount = toPreviewNumber(
    pickPreviewValue(quoteData, ['totalTaxAmount', 'vatAmount', 'TotalAmt4'], Math.max(total - amountExVat, 0))
  );
  const visibleLineCount = lines.filter(line => line.showInDocument).length;
  const serviceItemCount = lines.filter(line => line.serviceItemNo !== '-').length;
  const approverName = approval.salesDirectorName || pickPreviewValue(quoteData, ['approveUserName', 'ApproveUser_Name'], '-');

  container.innerHTML = `
    <div class="h-full min-h-0">
      <section class="approval-preview-sheet flex h-full min-h-0 flex-col">
        <div class="approval-preview-sheet-bar flex items-center justify-between gap-3">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Sales Quote Approval</p>
            <p class="mt-1 text-sm text-slate-600">Review layout aligned closer to the print version</p>
          </div>
          <div class="text-right">
            <p class="text-xs uppercase tracking-[0.08em] text-slate-500">Status</p>
            <span class="mt-1 inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusPresentation.badgeClass}">
              ${statusPresentation.label}
            </span>
          </div>
        </div>

        <div class="approval-preview-hero">
          <div>
            <div class="flex flex-wrap items-center gap-3">
              <h3 class="text-xl font-semibold text-slate-900">${escapeHtml(customerName)}</h3>
              <span class="text-sm text-slate-500">Customer No: ${escapeHtml(customerNo)}</span>
            </div>
            <div class="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
              <span>Quote No: <strong class="font-semibold text-slate-900">${escapeHtml(quoteNumber)}</strong></span>
              <span>Branch: <strong class="font-semibold text-slate-900">${escapeHtml(branch)}</strong></span>
              <span>Date: <strong class="font-semibold text-slate-900">${escapeHtml(formatPreviewDate(orderDate))}</strong></span>
              <span>Submitted: <strong class="font-semibold text-slate-900">${escapeHtml(submittedAt)}</strong></span>
            </div>
            ${addressParts.length ? `
              <p class="mt-3 text-sm leading-6 text-slate-600">${escapeHtml(addressParts.join(', '))}</p>
            ` : ''}
          </div>
          <div class="grid min-w-[260px] grid-cols-2 gap-x-5 gap-y-2 text-sm">
            <div>
              <p class="text-[11px] uppercase tracking-[0.08em] text-slate-500">Total</p>
              <p class="text-lg font-semibold text-slate-900">${formatPreviewMoney(total)}</p>
            </div>
            <div>
              <p class="text-[11px] uppercase tracking-[0.08em] text-slate-500">Subtotal</p>
              <p class="text-base font-semibold text-slate-900">${formatPreviewMoney(subtotal)}</p>
            </div>
            <div>
              <p class="text-[11px] uppercase tracking-[0.08em] text-slate-500">Lines</p>
              <p class="text-base font-semibold text-slate-900">${formatPreviewNumber(lines.length, 0)}</p>
            </div>
            <div>
              <p class="text-[11px] uppercase tracking-[0.08em] text-slate-500">Service Items</p>
              <p class="text-base font-semibold text-slate-900">${formatPreviewNumber(serviceItemCount, 0)}</p>
            </div>
          </div>
        </div>

        <details class="approval-preview-collapsible">
          <summary>Quote Details</summary>
          <div class="approval-preview-collapsible-body">
            <div class="approval-preview-meta-grid">
              ${renderApprovalMetaItem('Salesperson', `${escapeHtml(approval.salespersonName || approval.salespersonEmail || '-')}${salespersonCode !== '-' ? ` (${escapeHtml(salespersonCode)})` : ''}`)}
              ${renderApprovalMetaItem('Assigned User ID', escapeHtml(assignedUserId))}
              ${renderApprovalMetaItem('Work Status', escapeHtml(workStatus))}
              ${renderApprovalMetaItem('Requested Delivery', escapeHtml(formatPreviewDate(requestedDeliveryDate)))}
              ${renderApprovalMetaItem('Contact', escapeHtml(contact))}
              ${renderApprovalMetaItem('Sell-to Phone', escapeHtml(sellToPhoneNo))}
              ${renderApprovalMetaItem('Payment Terms', escapeHtml(paymentTerms))}
              ${renderApprovalMetaItem('Payment Method', escapeHtml(paymentMethod))}
              ${renderApprovalMetaItem('Shipment Method', escapeHtml(shipMethod))}
              ${renderApprovalMetaItem('Service Order Type', escapeHtml(serviceOrderType))}
              ${renderApprovalMetaItem('Division', escapeHtml(division))}
              ${renderApprovalMetaItem('Location Code', escapeHtml(locationCode))}
              ${renderApprovalMetaItem('Resp. Center', escapeHtml(responsibilityCenter))}
              ${renderApprovalMetaItem('Invoice Discount', formatPreviewMoney(invoiceDiscount))}
              ${renderApprovalMetaItem('Line Discount', formatPreviewMoney(lineDiscountTotal))}
              ${renderApprovalMetaItem('VAT', formatPreviewMoney(vatAmount))}
              ${renderApprovalMetaItem('Visible Lines', formatPreviewNumber(visibleLineCount, 0))}
              ${renderApprovalMetaItem('Approver', escapeHtml(approverName))}
              ${renderApprovalMetaItem('External Document No.', escapeHtml(externalDocumentNo))}
              ${renderApprovalMetaItem('Last Updated', escapeHtml(formatPreviewDateTime(approval.updatedAt)))}
            </div>
          </div>
        </details>

        ${approval.workDescription ? `
          <details class="approval-preview-collapsible">
            <summary>Work Description</summary>
            <div class="approval-preview-collapsible-body">
              <div class="approval-preview-print-note rounded-xl border border-slate-200">
                <p class="text-sm text-slate-700 whitespace-pre-wrap">${escapeHtml(approval.workDescription)}</p>
              </div>
            </div>
          </details>
        ` : ''}

        ${renderApprovalActionComment(approval, pendingRevisionRequest, actionCommentLabel)}

        <div class="approval-preview-table-wrap">
          <table class="approval-preview-table w-full text-sm">
            <thead class="bg-slate-50 text-slate-600">
              <tr>
                <th class="px-3 py-3 text-left font-medium">#</th>
                <th class="px-3 py-3 text-left font-medium">Group</th>
                <th class="px-3 py-3 text-left font-medium">Type</th>
                <th class="px-3 py-3 text-left font-medium">No.</th>
                <th class="px-3 py-3 text-left font-medium">Description</th>
                <th class="px-3 py-3 text-right font-medium">Qty</th>
                <th class="px-3 py-3 text-left font-medium">UOM</th>
                <th class="px-3 py-3 text-right font-medium">Unit Price</th>
                <th class="px-3 py-3 text-right font-medium">Disc %</th>
                <th class="px-3 py-3 text-right font-medium">Disc Amt</th>
                <th class="px-3 py-3 text-right font-medium">Line Total</th>
                <th class="px-3 py-3 text-left font-medium">Service Item</th>
                <th class="px-3 py-3 text-left font-medium">Service Status</th>
                <th class="px-3 py-3 text-left font-medium">Ref. SV No.</th>
                <th class="px-3 py-3 text-left font-medium">Print Flags</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${lines.map(line => `
                <tr class="align-top">
                  <td class="px-3 py-3 text-slate-500">${line.sequence}</td>
                  <td class="px-3 py-3">${escapeHtml(line.groupNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(line.type)}</td>
                  <td class="px-3 py-3 font-medium text-slate-800">${escapeHtml(line.no)}</td>
                  <td class="approval-preview-description px-3 py-3 text-slate-700">${escapeHtml(line.description)}</td>
                  <td class="px-3 py-3 text-right">${formatPreviewNumber(line.quantity, Number.isInteger(line.quantity) ? 0 : 2)}</td>
                  <td class="px-3 py-3">${escapeHtml(line.unitOfMeasureCode)}</td>
                  <td class="px-3 py-3 text-right">${formatPreviewMoney(line.unitPrice)}</td>
                  <td class="px-3 py-3 text-right">${formatPreviewNumber(line.discountPercent, 1)}</td>
                  <td class="px-3 py-3 text-right">${formatPreviewMoney(line.discountAmount)}</td>
                  <td class="px-3 py-3 text-right font-medium">${formatPreviewMoney(line.lineTotal)}</td>
                  <td class="px-3 py-3">${escapeHtml(line.serviceItemNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(line.serviceStatus)}</td>
                  <td class="px-3 py-3">${escapeHtml(line.refServiceOrderNo)}</td>
                  <td class="px-3 py-3">${renderPreviewFlags(line)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${directorSignature ? `
          <div class="approval-preview-signature">
            <p class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Approved by Sales Director</p>
            <img src="${directorSignature}" alt="Director Signature" class="mt-3 max-h-16" />
          </div>
        ` : ''}
      </section>
    </div>
  `;
}

function renderApprovalActionComment(approval, pendingRevisionRequest, actionCommentLabel) {
  const actionComment = typeof approval?.actionComment === 'string'
    ? approval.actionComment.trim()
    : '';

  if (!actionComment) {
    return '';
  }

  if (pendingRevisionRequest) {
    return `
      <section class="approval-preview-comment-spotlight approval-preview-comment-spotlight-warning">
        <div class="approval-preview-comment-spotlight-header">
          <span class="approval-preview-comment-spotlight-badge">Revision Request</span>
          <p class="approval-preview-comment-spotlight-title">${escapeHtml(actionCommentLabel.replace(':', ''))}</p>
        </div>
        <p class="approval-preview-comment-spotlight-body">${escapeHtml(actionComment)}</p>
      </section>
    `;
  }

  return `
    <details class="approval-preview-collapsible is-comment">
      <summary>${escapeHtml(actionCommentLabel.replace(':', ''))}</summary>
      <div class="approval-preview-collapsible-body">
        <div class="approval-preview-inline-comment rounded-xl border border-blue-200 is-info">
          <p class="text-sm leading-6 whitespace-pre-wrap text-blue-900">${escapeHtml(actionComment)}</p>
        </div>
      </div>
    </details>
  `;
}

function renderApprovalMetaItem(label, value) {
  return `
    <div class="approval-preview-meta-item">
      <span class="approval-preview-meta-label">${label}</span>
      <span class="approval-preview-meta-value">${value || '-'}</span>
    </div>
  `;
}

function renderPreviewFlags(line) {
  const flags = [];

  if (line.showInDocument) {
    flags.push('<span class="sq-chip sq-chip-neutral">Show</span>');
  }
  if (line.isHeader) {
    flags.push('<span class="sq-chip sq-chip-warning">Header</span>');
  }
  if (line.isFooter) {
    flags.push('<span class="sq-chip sq-chip-neutral">Footer</span>');
  }

  return flags.length
    ? `<div class="flex flex-wrap gap-1">${flags.join('')}</div>`
    : '<span class="text-slate-400">-</span>';
}

/**
 * Render action buttons based on approval status
 */
function renderActionButtons(container, approval) {
  if (!container) return;

  const canApprove = authState.user?.effectiveRole === ROLE.SALES_DIRECTOR ||
                      authState.user?.effectiveRole === ROLE.EXECUTIVE;
  const pendingRevisionRequest = hasPendingRevisionRequest(approval);

  let buttons = '';

  if (canApprove && approval.approvalStatus === APPROVAL_STATUS.PENDING_APPROVAL) {
    buttons = `
      <button
        id="btnApproveQuote"
        type="button"
        class="sq-btn sq-btn-success"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        Approve
      </button>
      <button
        id="btnRejectQuote"
        type="button"
        class="sq-btn sq-btn-danger"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
        Reject
      </button>
    `;
  } else if (canApprove && pendingRevisionRequest) {
    buttons = `
      <button
        id="btnApproveRevisionRequest"
        type="button"
        class="sq-btn sq-btn-primary"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        Approve Revision Request
      </button>
    `;
  }

  buttons += `
    <button
      id="btnClosePreview"
      type="button"
      class="sq-btn sq-btn-secondary"
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
  const btnApproveRevision = el('btnApproveRevisionRequest');
  const btnReject = el('btnRejectQuote');
  const btnClose = el('btnClosePreview');

  if (btnApprove) {
    btnApprove.addEventListener('click', () => {
      if (currentPreviewQuoteNumber) {
        approveQuote(currentPreviewQuoteNumber);
      }
    });
  }

  if (btnApproveRevision) {
    btnApproveRevision.addEventListener('click', () => {
      if (currentPreviewQuoteNumber) {
        approveRevisionRequest(currentPreviewQuoteNumber);
      }
    });
  }

  if (btnReject) {
    btnReject.addEventListener('click', async () => {
      const quoteNumber = currentPreviewQuoteNumber;
      if (!quoteNumber) {
        return;
      }

      const modalResult = await showApprovalActionModal({
        status: 'Approval Decision',
        statusTone: 'danger',
        title: 'Reject this quote?',
        message: 'Provide a clear reason so the salesperson knows what to revise before resubmitting.',
        contextLabel: 'Sales Quote',
        contextValue: quoteNumber,
        confirmText: 'Reject Quote',
        confirmVariant: 'danger',
        requireComment: true,
        commentLabel: 'Reason for rejection',
        commentPlaceholder: 'Explain what should be updated before approval...',
        commentHint: 'This comment will be shown to the salesperson.'
      });

      if (modalResult.confirmed) {
        rejectQuote(quoteNumber, modalResult.comment);
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

    if (!approval) {
      resetApprovalState();
      return null;
    }

    state.quote.approvalStatus = approval.approvalStatus;
    state.approval.currentStatus = approval.approvalStatus;
    state.approval.canEdit = approval.approvalStatus === APPROVAL_STATUS.DRAFT ||
                             approval.approvalStatus === APPROVAL_STATUS.REVISE ||
                             approval.approvalStatus === APPROVAL_STATUS.REJECTED ||
                             approval.approvalStatus === APPROVAL_STATUS.BEING_REVISED ||
                             approval.approvalStatus === APPROVAL_STATUS.CANCELLED;
    state.approval.canPrint = approval.approvalStatus === APPROVAL_STATUS.APPROVED ||
                             approval.approvalStatus === APPROVAL_STATUS.BEING_REVISED ||
                             authState.user?.effectiveRole === ROLE.EXECUTIVE;
    applyApprovalIdentity(approval);
    state.approval.actionComment = approval.actionComment;
    state.approval.hasPendingRevisionRequest = hasPendingRevisionRequest(approval);
    state.approval.submittedAt = approval.submittedForApprovalAt;
    state.approval.directorActionAt = approval.salesDirectorActionAt;
    state.approval.updatedAt = approval.updatedAt;

    return approval;
  } catch (error) {
    // No approval record exists - quote is in draft state
    resetApprovalState();
    return null;
  }
}

// ============================================================
// Export Constants
// ============================================================

export { APPROVAL_STATUS, STATUS_LABELS, STATUS_BADGE_CLASSES };
