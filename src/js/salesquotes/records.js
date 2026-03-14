import { el, showToast } from './ui.js';

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

function renderRecords(records) {
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
        <td colspan="3" class="px-4 py-10 text-center text-slate-500">
          No records found for your account yet.
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = records.map(record => {
    const description = record.workDescription
      ? `<div class="max-w-2xl whitespace-pre-wrap break-words text-sm text-slate-700">${escapeHtml(record.workDescription)}</div>`
      : '<span class="text-sm text-slate-400">No work description</span>';

    return `
      <tr class="hover:bg-slate-50">
        <td class="px-4 py-3 font-medium text-slate-900">${escapeHtml(record.salesQuoteNumber)}</td>
        <td class="px-4 py-3">${description}</td>
        <td class="px-4 py-3 whitespace-nowrap text-slate-600">${escapeHtml(formatSubmittedAt(record.submittedAt))}</td>
      </tr>
    `;
  }).join('');
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
      <td colspan="3" class="px-4 py-10 text-center text-slate-500">
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
    renderRecords(Array.isArray(data.records) ? data.records : []);
    return true;
  } catch (error) {
    console.error('Failed to load Sales Quote records:', error);
    container.innerHTML = `
      <tr>
        <td colspan="3" class="px-4 py-10 text-center text-red-500">
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
