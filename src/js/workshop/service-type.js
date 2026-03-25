/**
 * Workshop Calculator - Service Type helpers
 * Handles Overhaul/Rewind toggle and job checking/unchecking
 */

import { el } from '../core/utils.js';
import { appState } from './state.js';

const SERVICE_TYPES = new Set(['Overhaul', 'Rewind']);
// Job name patterns for AC and DC motor variants (with and without space)
const OVERHAUL_JOB_PATTERNS = [
  'overhaul',
  'overhaul (dc)', 'overhaul(dc)',
  'overhaul (ac)', 'overhaul(ac)'
];
const REWIND_JOB_PATTERNS = [
  'rewind motor', 'rewind',
  'rewind motor (dc)', 'rewind motor(dc)',
  'rewind motor (ac)', 'rewind motor(ac)',
  'rewind (dc)', 'rewind(dc)',
  'rewind (ac)', 'rewind(ac)'
];

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
 * When Overhaul is selected: check Overhaul jobs, uncheck ALL Rewind Motor jobs
 * When Rewind is selected: check Rewind Motor jobs, uncheck ALL Overhaul jobs
 * This ensures that toggling AC/DC doesn't affect the service type filtering
 * @param {string} serviceType - 'Overhaul' or 'Rewind'
 */
function updateJobsByServiceType(serviceType) {
  if (!appState.labor || appState.labor.length === 0) {
    return;
  }

  appState.labor.forEach(job => {
    const jobNameLower = job.JobName.toLowerCase();
    const isOverhaulJob = OVERHAUL_JOB_PATTERNS.some(pattern =>
      jobNameLower.includes(pattern.toLowerCase())
    );
    const isRewindJob = REWIND_JOB_PATTERNS.some(pattern =>
      jobNameLower.includes(pattern.toLowerCase())
    );

    if (serviceType === 'Overhaul') {
      // Overhaul mode: Check Overhaul jobs, Uncheck ALL Rewind jobs
      if (isRewindJob) {
        job.checked = false; // Always uncheck Rewind jobs in Overhaul mode
      } else if (isOverhaulJob) {
        job.checked = true;
      }
    } else if (serviceType === 'Rewind') {
      // Rewind mode: Check Rewind jobs, Uncheck ALL Overhaul jobs
      if (isOverhaulJob) {
        job.checked = false; // Always uncheck Overhaul jobs in Rewind mode
      } else if (isRewindJob) {
        job.checked = true;
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
 * Check if we're in DC + Rewind mode (special validation required)
 * @returns {boolean} true if DC motor drive AND Rewind service type
 */
export function isDcRewindMode() {
  return appState.motorDriveType === 'DC' && appState.serviceType === 'Rewind';
}

/**
 * Check if a job is a Rewind Motor job
 * @param {Object} job - Job object with JobName property
 * @returns {boolean} true if job matches rewind patterns
 */
export function isRewindMotorJob(job) {
  if (!job || !job.JobName) return false;
  const jobNameLower = job.JobName.toLowerCase();
  return REWIND_JOB_PATTERNS.some(pattern =>
    jobNameLower.includes(pattern.toLowerCase())
  );
}

/**
 * Get Rewind job patterns for external use
 * @returns {string[]} Array of rewind job patterns
 */
export function getRewindJobPatterns() {
  return REWIND_JOB_PATTERNS;
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
