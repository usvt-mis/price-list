/**
 * Workshop Calculator - Saved Records Filters Module
 * Universal search and sorting utilities for saved workshop records
 */

import { formatDate } from '../../core/utils.js';

/**
 * Universal search across all columns
 * @param {Array} records - Records to filter
 * @param {string} searchTerm - Search term to match
 * @returns {Array} Filtered records
 */
export function searchRecords(records, searchTerm) {
  if (!searchTerm || searchTerm.trim() === '') {
    return records;
  }

  const term = searchTerm.toLowerCase().trim();

  return records.filter(r => {
    // Search in Run Number
    if ((r.RunNumber || '').toLowerCase().includes(term)) {
      return true;
    }

    // Search in Date (formatted)
    if (formatDate(r.CreatedAt).toLowerCase().includes(term)) {
      return true;
    }

    // Search in Creator Name/Email
    if ((r.CreatorName || r.CreatorEmail || '').toLowerCase().includes(term)) {
      return true;
    }

    // Search in Branch
    if ((r.BranchName || '').toLowerCase().includes(term)) {
      return true;
    }

    // Search in Motor Type
    if ((r.MotorTypeName || '').toLowerCase().includes(term)) {
      return true;
    }

    // Search in Job Count
    if (String(r.JobCount || '').includes(term)) {
      return true;
    }

    // Search in Material Count
    if (String(r.MaterialCount || '').includes(term)) {
      return true;
    }

    // Search in Amount (GrandTotal)
    // Format amount for search (e.g., "1,234.56")
    const formattedAmount = formatAmount(r.GrandTotal);
    if (formattedAmount.toLowerCase().includes(term)) {
      return true;
    }

    return false;
  });
}

/**
 * Sort records by any column
 * @param {Array} records - Records to sort
 * @param {string} column - Column name to sort by
 * @param {string} direction - Sort direction ('asc' or 'desc')
 * @returns {Array} Sorted records
 */
export function sortRecords(records, column, direction) {
  const sorted = [...records].sort((a, b) => {
    let aVal = a[column];
    let bVal = b[column];

    // Handle null/undefined
    if (aVal == null) aVal = '';
    if (bVal == null) bVal = '';

    // String comparison
    if (typeof aVal === 'string') {
      return direction === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    // Number/date comparison
    return direction === 'asc' ? aVal - bVal : bVal - aVal;
  });

  return sorted;
}

/**
 * Format amount for display and search
 * @param {number} amount - Amount to format
 * @returns {string} Formatted amount (e.g., "1,234.56")
 */
function formatAmount(amount) {
  if (amount == null || isNaN(amount)) {
    return '—';
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}
