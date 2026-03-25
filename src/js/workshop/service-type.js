/**
 * Workshop Calculator - Service Type helpers
 * Handles Overhaul/Rewind toggle and job checking/unchecking
 */

import { el } from '../core/utils.js';
import { appState } from './state.js';

const SERVICE_TYPES = new Set(['Overhaul', 'Rewind']);

// Job names to check/uncheck based on service type
const OVERHAUL_JOB_PATTERNS = ['overhaul'];
const REWIND_JOB_PATTERNS = ['rewind motor', 'rewind'];

/**
 * Update the service type toggle UI to match the current state
 */
function updateServiceTypeToggleUi() {
  document.querySelectorAll('input[name="serviceType"]').forEach((input) => {
    input.checked = input.value === appState.serviceType;
  });
}

/**
 * Set the service type and update job checkboxes
 * @param {string} serviceType - 'Overhaul' or 'Rewind'
 */
export function setServiceType(serviceType) {
  if (!SERVICE_TYPES.has(serviceType)) {
    console.warn(`Invalid service type: ${serviceType}`);
    return;
  }

  appState.serviceType = serviceType;
  updateServiceTypeToggleUi();
  updateJobsByServiceType(serviceType);
}

/**
 * Update job checkboxes based on service type
 * When Overhaul is selected: check Overhaul jobs, uncheck Rewind Motor jobs
 * When Rewind is selected: check Rewind Motor jobs, uncheck Overhaul jobs
 * @param {string} serviceType - 'Overhaul' or 'Rewind'
 */
function updateJobsByServiceType(serviceType) {
  if (!appState.labor || appState.labor.length === 0) {
    return;
  }

  appState.labor.forEach(job => {
    const jobNameLower = job.JobName.toLowerCase();

    if (serviceType === 'Overhaul') {
      // Check Overhaul jobs, uncheck Rewind Motor jobs
      const isOverhaulJob = OVERHAUL_JOB_PATTERNS.some(pattern =>
        jobNameLower.includes(pattern.toLowerCase())
      );
      const isRewindJob = REWIND_JOB_PATTERNS.some(pattern =>
        jobNameLower.includes(pattern.toLowerCase())
      );

      if (isOverhaulJob && !isRewindJob) {
        job.checked = true;
      } else if (isRewindJob && !isOverhaulJob) {
        job.checked = false;
      }
    } else if (serviceType === 'Rewind') {
      // Check Rewind Motor jobs, uncheck Overhaul jobs
      const isRewindJob = REWIND_JOB_PATTERNS.some(pattern =>
        jobNameLower.includes(pattern.toLowerCase())
      );
      const isOverhaulJob = OVERHAUL_JOB_PATTERNS.some(pattern =>
        jobNameLower.includes(pattern.toLowerCase())
      );

      if (isRewindJob) {
        job.checked = true;
      } else if (isOverhaulJob && !isRewindJob) {
        job.checked = false;
      }
    }
  });
}

/**
 * Get the current service type
 * @returns {string} Current service type ('Overhaul' or 'Rewind')
 */
export function getServiceType() {
  return appState.serviceType || 'Overhaul';
}

/**
 * Initialize service type toggle event listeners
 */
export function initServiceTypeToggle() {
  document.querySelectorAll('input[name="serviceType"]').forEach((input) => {
    input.addEventListener('change', async (event) => {
      if (!event.target.checked) {
        return;
      }

      setServiceType(event.target.value);

      // Re-render labor and recalculate
      const { renderLabor } = await import('./labor.js');
      const { calcAll } = await import('./calculations.js');
      renderLabor();
      calcAll();
    });
  });

  // Initialize UI
  updateServiceTypeToggleUi();
}
