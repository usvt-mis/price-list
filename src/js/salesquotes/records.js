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
let openTimelineQuoteNumber = '';
const timelineEventsCache = new Map();

const AUDIT_ACTION_LABELS = {
  Created: 'Create',
  SubmittedToBC: 'Submitted to BC',
  SendApprove: 'Send Approve',
  Updated: 'Updated',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Revise: 'Revise Requested',
  Cancelled: 'Cancelled',
  RevisionRequested: 'Revision Requested',
  RevisionApproved: 'Revision Approved',
  RevisionRejected: 'Revision Rejected',
  Resubmitted: 'Resubmitted'
};

const AUDIT_ACTION_TONE_CLASSES = {
  Created: 'bg-slate-100 text-slate-700',
  SubmittedToBC: 'bg-sky-100 text-sky-700',
  SendApprove: 'bg-amber-100 text-amber-700',
  Updated: 'bg-slate-100 text-slate-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-rose-100 text-rose-700',
  Revise: 'bg-orange-100 text-orange-700',
  Cancelled: 'bg-slate-200 text-slate-700',
  RevisionRequested: 'bg-fuchsia-100 text-fuchsia-700',
  RevisionApproved: 'bg-cyan-100 text-cyan-700',
  RevisionRejected: 'bg-rose-100 text-rose-700',
  Resubmitted: 'bg-indigo-100 text-indigo-700'
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

function getAuditActionLabel(actionType) {
  return AUDIT_ACTION_LABELS[actionType] || actionType || 'Unknown';
}

function getAuditActionToneClass(actionType) {
  return AUDIT_ACTION_TONE_CLASSES[actionType] || 'bg-slate-100 text-slate-700';
}

function renderTimelineEvent(event) {
  const timestamp = escapeHtml(formatSubmittedAt(event.createdAt));
  const actorEmail = event.actorEmail
    ? `<div class="text-xs text-slate-500">By ${escapeHtml(event.actorEmail)}</div>`
    : '';
  const approvalStatus = event.approvalStatus
    ? `<div class="text-xs text-slate-500">Status: ${escapeHtml(event.approvalStatus)}</div>`
    : '';
  const workDescription = event.workDescription
    ? `<div class="text-xs text-slate-500">Work: ${escapeHtml(event.workDescription)}</div>`
    : '';
  const comment = event.comment
    ? `<div class="mt-1 text-xs text-slate-600 whitespace-pre-wrap break-words">Comment: ${escapeHtml(event.comment)}</div>`
    : '';

  return `
    <li class="relative pl-7">
      <span class="absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 border-white bg-slate-300 shadow-sm"></span>
      <div class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getAuditActionToneClass(event.actionType)}">
              ${escapeHtml(getAuditActionLabel(event.actionType))}
            </span>
            ${actorEmail}
            ${approvalStatus}
            ${workDescription}
            ${comment}
          </div>
          <div class="whitespace-nowrap text-xs font-medium text-slate-500">${timestamp}</div>
        </div>
      </div>
    </li>
  `;
}

function renderTimelineContent(quoteNumber, events = []) {
  if (!events.length) {
    return `
      <div class="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
        No audit history found for ${escapeHtml(quoteNumber)}.
      </div>
    `;
  }

  return `
    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 class="text-sm font-semibold text-slate-900">Quote History</h3>
          <p class="text-xs text-slate-500">${escapeHtml(quoteNumber)} has ${events.length} transaction${events.length === 1 ? '' : 's'} recorded.</p>
        </div>
      </div>
      <ol class="space-y-3 border-l-2 border-slate-200 pl-4">
        ${events.map(renderTimelineEvent).join('')}
      </ol>
    </div>
  `;
}

async function fetchQuoteAuditTimeline(quoteNumber) {
  const response = await fetch(`/api/salesquotes/audit-events/${encodeURIComponent(quoteNumber)}`);
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || 'Failed to load quote history');
  }

  const data = await response.json();
  return Array.isArray(data.events) ? data.events : [];
}

function closeOpenTimeline(container, exceptQuoteNumber = '') {
  container.querySelectorAll('[data-timeline-row]').forEach((row) => {
    const quoteNumber = row.getAttribute('data-timeline-row') || '';
    const shouldStayOpen = exceptQuoteNumber && quoteNumber === exceptQuoteNumber;
    row.classList.toggle('hidden', !shouldStayOpen);
  });

  container.querySelectorAll('[data-action="toggle-history"]').forEach((button) => {
    const quoteNumber = button.getAttribute('data-quote-number') || '';
    const isOpen = exceptQuoteNumber && quoteNumber === exceptQuoteNumber;
    button.textContent = isOpen ? 'Hide history' : 'View history';
    button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  openTimelineQuoteNumber = exceptQuoteNumber;
}

async function toggleQuoteTimeline(quoteNumber) {
  const container = el('salesQuoteRecordsList');
  if (!container || !quoteNumber) {
    return;
  }

  const timelineRow = Array.from(container.querySelectorAll('[data-timeline-row]'))
    .find((row) => row.getAttribute('data-timeline-row') === quoteNumber);
  if (!timelineRow) {
    return;
  }

  if (openTimelineQuoteNumber === quoteNumber && !timelineRow.classList.contains('hidden')) {
    closeOpenTimeline(container, '');
    return;
  }

  closeOpenTimeline(container, quoteNumber);
  timelineRow.innerHTML = `
    <td colspan="5" class="px-4 py-4">
      <div class="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        Loading quote history...
      </div>
    </td>
  `;

  try {
    const events = timelineEventsCache.has(quoteNumber)
      ? timelineEventsCache.get(quoteNumber)
      : await fetchQuoteAuditTimeline(quoteNumber);

    timelineEventsCache.set(quoteNumber, events);
    timelineRow.innerHTML = `
      <td colspan="5" class="px-4 py-4">
        ${renderTimelineContent(quoteNumber, events)}
      </td>
    `;
  } catch (error) {
    timelineRow.innerHTML = `
      <td colspan="5" class="px-4 py-4">
        <div class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Failed to load quote history. ${escapeHtml(error.message)}
        </div>
      </td>
    `;
  }
}

function getApprovalStatusBadge(status) {
  if (!status) {
    return '<span class="text-xs text-slate-400">No status</span>';
  }

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
        <td colspan="5" class="px-4 py-10 text-center text-slate-500">
          No records found for your account yet.
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = records.map((record) => {
    const description = record.workDescription
      ? `<div class="max-w-xl whitespace-pre-wrap break-words text-sm text-slate-700">${escapeHtml(record.workDescription)}</div>`
      : '<span class="text-sm text-slate-400">No work description</span>';
    const quoteNumber = escapeHtml(record.salesQuoteNumber);

    return `
      <tr class="hover:bg-slate-50">
        <td class="px-4 py-3 font-medium">
          <button
            type="button"
            class="inline-flex items-center gap-1 sq-link-action hover:underline transition-colors cursor-pointer"
            data-quote-number="${quoteNumber}"
            data-action="load-quote"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            ${quoteNumber}
          </button>
        </td>
        <td class="px-4 py-3">${description}</td>
        <td class="px-4 py-3">${getApprovalStatusBadge(record.approvalStatus)}</td>
        <td class="px-4 py-3 whitespace-nowrap text-slate-600">${escapeHtml(formatSubmittedAt(record.submittedAt))}</td>
        <td class="px-4 py-3 whitespace-nowrap">
          <button
            type="button"
            class="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            data-action="toggle-history"
            data-quote-number="${quoteNumber}"
            aria-expanded="false"
          >
            View history
          </button>
        </td>
      </tr>
      <tr class="hidden bg-white" data-timeline-row="${quoteNumber}"></tr>
    `;
  }).join('');

  // Attach click handlers to quote number buttons
  container.querySelectorAll('[data-action="load-quote"]').forEach(button => {
    button.addEventListener('click', () => {
      const quoteNumber = button.getAttribute('data-quote-number');
      loadQuoteFromRecords(quoteNumber);
    });
  });

  container.querySelectorAll('[data-action="toggle-history"]').forEach((button) => {
    button.addEventListener('click', () => {
      const quoteNumber = button.getAttribute('data-quote-number');
      toggleQuoteTimeline(quoteNumber);
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
  closeOpenTimeline(container, '');
  timelineEventsCache.clear();
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
        <td colspan="5" class="px-4 py-10 text-center text-red-500">
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

export async function recordQuoteSubmission({ salesQuoteNumber, workDescription, remark = '' }) {
  const response = await fetch('/api/salesquotes/records', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      salesQuoteNumber,
      workDescription,
      remark
    })
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || 'Failed to save Sales Quote record');
  }

  const data = await response.json();
  return data;
}

export async function recordQuoteAuditEvent({
  salesQuoteNumber,
  actionType,
  approvalStatus = '',
  workDescription = '',
  comment = ''
}) {
  const response = await fetch('/api/salesquotes/audit-events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      salesQuoteNumber,
      actionType,
      approvalStatus,
      workDescription,
      comment
    })
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || 'Failed to save Sales Quote audit event');
  }

  return response.json().catch(() => ({}));
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
