import { el, showToast } from './ui.js';

// Approval status constants
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
  PendingApproval: 'Pending',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Revise: 'Revision',
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
  const badgeClass = STATUS_BADGE_CLASSES[status] || 'bg-gray-100 text-gray-700';

  return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${label}</span>`;
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
            class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer"
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
  const count = el('salesQuoteRecordsCount');

  if (!container) {
    return false;
  }

  if (count) {
    count.textContent = '0';
  }

  container.innerHTML = `
    <tr>
      <td colspan="4" class="px-4 py-10 text-center text-slate-500">
        Loading your records...
      </td>
    </tr>
  `;

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
    await renderRecords(Array.isArray(data.records) ? data.records : []);
    return true;
  } catch (error) {
    console.error('Failed to load Sales Quote records:', error);
    container.innerHTML = `
      <tr>
        <td colspan="4" class="px-4 py-10 text-center text-red-500">
          Failed to load records. ${escapeHtml(error.message)}
        </td>
      </tr>
    `;
    return false;
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
  el('tabRecords')?.addEventListener('click', () => {
    loadQuoteSubmissionRecords();
  });

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
