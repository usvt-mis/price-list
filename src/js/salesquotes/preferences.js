const PREFERENCES_API_BASE = '/api/salesquotes/preferences';

export const SALES_QUOTES_PREFERENCE_KEYS = {
  LINE_COLUMN_ORDER: 'quote-line-columns'
};

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

export async function loadSalesQuotePreference(key) {
  const response = await fetch(`${PREFERENCES_API_BASE}/${encodeURIComponent(key)}`, {
    headers: {
      Accept: 'application/json'
    }
  });

  return parseJsonResponse(response);
}

export async function saveSalesQuotePreference(key, value) {
  const response = await fetch(`${PREFERENCES_API_BASE}/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ value })
  });

  return parseJsonResponse(response);
}
