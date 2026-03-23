import { el, showToast } from './ui.js';

// Approval status constants
const APPROVAL_STATUS = {
  DRAFT: 'Draft',
  SUBMITTED_TO_BC: 'SubmittedToBC',
  PENDING_APPROVAL: 'PendingApproval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  REVISE: 'Revise',
  CANCELLED: 'Cancelled'
};

const STATUS_LABELS = {
  Draft: 'Draft',
  SubmittedToBC: 'Submitted to BC',
  PendingApproval: 'Pending',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Revise: 'Revision',
  Cancelled: 'Cancelled'
};

const STATUS_BADGE_CLASSES = {
  Draft: 'sq-status-badge-draft',
  SubmittedToBC: 'sq-status-badge-submitted',
  PendingApproval: 'sq-status-badge-pending',
  Approved: 'sq-status-badge-approved',
  Rejected: 'sq-status-badge-rejected',
  Revise: 'sq-status-badge-revise',
  Cancelled: 'sq-status-badge-cancelled'
};

let recordsLoadSequence = 0;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSubmittedAt(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

/**
 * Fetch approval status for a quote
 */
async function fetchApprovalStatus(quoteNumber) {
  try {
    const response = await fetch(`/api/salesquotes/approvals/${quoteNumber}`);
    if (response.ok) {
      const data = await response.json();
      return data.approval || null;
    }
    return null;
  } catch {
    return null;
  }
}

function getApprovalStatusBadge(approval) {
  if (!approval) {
    return '<span class="text-xs text-slate-400">No status</span>';
  }

  const status = approval.approvalStatus || 'Draft';
  const label = STATUS_LABELS[status] || status;
  const badgeClass = STATUS_BADGE_CLASSES[status] || 'sq-status-badge-draft';

  return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${label}</span>`;
}

function renderRecordsSkeleton() {
  return Array.from({ length: 4 }, (_, index) => `
    <tr class="${index % 2 === 0 ? 'bg-white/70' : 'bg-slate-50/40'}">
      <td class="px-4 py-4">
        <span class="sq-records-skeleton-line sq-records-skeleton-line-sm"></span>
      </td>
      <td class="px-4 py-4">
        <div class="space-y-2">
          <span class="sq-records-skeleton-line sq-records-skeleton-line-lg"></span>
          <span class="sq-records-skeleton-line sq-records-skeleton-line-md"></span>
        </div>
      </td>
      <td class="px-4 py-4">
        <span class="sq-records-skeleton-line sq-records-skeleton-line-sm"></span>
      </td>
      <td class="px-4 py-4">
        <span class="sq-records-skeleton-line sq-records-skeleton-line-md"></span>
      </td>
    </tr>
  `).join('');
}

function setRecordsLoadingState(isLoading) {
  const banner = el('salesQuoteRecordsLoadingBanner');
  const count = el('salesQuoteRecordsCount');
  const refreshButton = el('salesQuoteRecordsRefreshBtn');
  const searchButton = el('salesQuoteRecordsSearchBtn');
  const searchInput = el('salesQuoteRecordsSearch');

  banner?.classList.toggle('hidden', !isLoading);

  if (count && isLoading) {
    count.textContent = 'Loading...';
  }

  [refreshButton, searchButton].forEach((button) => {
    if (!button) {
      return;
    }

    button.disabled = isLoading;
    button.classList.toggle('opacity-60', isLoading);
    button.classList.toggle('cursor-not-allowed', isLoading);
  });

  if (searchInput) {
    searchInput.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  }
}

async function renderRecords(records) {
  const container = el('salesQuoteRecordsList');
  const count = el('salesQuoteRecordsCount');

  if (!container) {
    return;
  }

  if (count) {
    count.textContent = `${records.length}`;
  }

  if (!records.length) {
    container.innerHTML = `
      <tr>
        <td colspan="4" class="px-4 py-10 text-center text-slate-500">
          No records found for your account yet.
        </td>
      </tr>
    `;
    return;
  }

  // Fetch approval status for all records
  const recordsWithStatus = await Promise.all(
    records.map(async (record) => {
      const approval = await fetchApprovalStatus(record.salesQuoteNumber);
      return { ...record, approval };
    })
  );

  container.innerHTML = recordsWithStatus.map((record) => {
    const description = record.workDescription
      ? `<div class="max-w-xl whitespace-pre-wrap break-words text-sm text-slate-700">${escapeHtml(record.workDescription)}</div>`
      : '<span class="text-sm text-slate-400">No work description</span>';

    return `
      <tr class="hover:bg-slate-50">
        <td class="px-4 py-3 font-medium">
          <button
            type="button"
            class="inline-flex items-center gap-1 sq-link-action hover:underline transition-colors cursor-pointer"
            data-quote-number="${escapeHtml(record.salesQuoteNumber)}"
            data-action="load-quote"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            ${escapeHtml(record.salesQuoteNumber)}
          </button>
        </td>
        <td class="px-4 py-3">${description}</td>
        <td class="px-4 py-3">${getApprovalStatusBadge(record.approval)}</td>
        <td class="px-4 py-3 whitespace-nowrap text-slate-600">${escapeHtml(formatSubmittedAt(record.submittedAt))}</td>
      </tr>
    `;
  }).join('');

  // Attach click handlers to quote number buttons
  container.querySelectorAll('[data-action="load-quote"]').forEach(button => {
    button.addEventListener('click', () => {
      const quoteNumber = button.getAttribute('data-quote-number');
      loadQuoteFromRecords(quoteNumber);
    });
  });
}

/**
 * Loads a Sales Quote from the My Records table into the editor.
 * Switches to the Search tab, fills the input, and triggers the search.
 */
function loadQuoteFromRecords(salesQuoteNumber) {
  // Switch to search tab
  window.switchTab('search');

  // Fill the search input
  const searchInput = el('searchSalesQuoteNumber');
  if (searchInput) {
    searchInput.value = salesQuoteNumber;
  }

  // Trigger the search (after a small delay to ensure tab switch is complete)
  setTimeout(() => {
    window.searchSalesQuote();
  }, 50);
}

export async function loadQuoteSubmissionRecords() {
  const container = el('salesQuoteRecordsList');
  const search = el('salesQuoteRecordsSearch')?.value?.trim() || '';
  const currentLoadSequence = ++recordsLoadSequence;

  if (!container) {
    return false;
  }

  setRecordsLoadingState(true);
  container.innerHTML = renderRecordsSkeleton();

  try {
    const url = new URL('/api/salesquotes/records', window.location.origin);
    if (search) {
      url.searchParams.set('search', search);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      throw new Error(errorPayload?.error || 'Failed to load records');
    }

    const data = await response.json();
    if (currentLoadSequence !== recordsLoadSequence) {
      return false;
    }

    await renderRecords(Array.isArray(data.records) ? data.records : []);
    return true;
  } catch (error) {
    if (currentLoadSequence !== recordsLoadSequence) {
      return false;
    }

    console.error('Failed to load Sales Quote records:', error);
    container.innerHTML = `
      <tr>
        <td colspan="4" class="px-4 py-10 text-center text-red-500">
          Failed to load records. ${escapeHtml(error.message)}
        </td>
      </tr>
    `;
    return false;
  } finally {
    if (currentLoadSequence === recordsLoadSequence) {
      setRecordsLoadingState(false);
    }
  }
}

export async function recordQuoteSubmission({ salesQuoteNumber, workDescription }) {
  const response = await fetch('/api/salesquotes/records', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      salesQuoteNumber,
      workDescription
    })
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || 'Failed to save Sales Quote record');
  }

  const data = await response.json();
  return data;
}

export function setupQuoteSubmissionRecordEventListeners() {
  el('salesQuoteRecordsRefreshBtn')?.addEventListener('click', async () => {
    const loaded = await loadQuoteSubmissionRecords();
    if (loaded) {
      showToast('Records refreshed', 'success');
    }
  });

  el('salesQuoteRecordsSearchBtn')?.addEventListener('click', () => {
    loadQuoteSubmissionRecords();
  });

  el('salesQuoteRecordsSearch')?.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      loadQuoteSubmissionRecords();
    }
  });
}
