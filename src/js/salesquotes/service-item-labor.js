import { authState } from '../state.js';
import { el, escapeHtml, fetchJson, fetchWithAuth } from '../core/utils.js';
import { getMotorJobDefaults, shouldMotorJobBeCheckedByDefault } from '../core/motor-job-defaults.js';
import { STORAGE_KEYS as ONSITE_STORAGE_KEYS } from '../onsite/config.js';

const SERVICE_ITEM_LABOR_API_BASE = '/api/salesquotes/service-item-labor';
const ONSITE_SCOPE_LABELS = {
  'low-volt': 'Low Volt',
  'medium-volt': 'Medium Volt',
  large: 'Large'
};
const ONSITE_PRIORITY_LABELS = {
  high: 'High',
  low: 'Low'
};
const ONSITE_SITE_ACCESS_LABELS = {
  easy: 'Easy',
  difficult: 'Difficult'
};
const ONSITE_OPTION_LABELS = {
  onsiteCraneEnabled: 'ใช้ Crane',
  onsiteFourPeopleEnabled: 'ใช้ 4 ผู้',
  onsiteSafetyEnabled: 'ใช้ Safety'
};
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
const REPAIR_MODE_CONFIGS = {
  Workshop: {
    title: 'Workshop labor section',
    label: 'Workshop Pattern',
    description: 'Loads workshop jobs by motor size and keeps the workshop save pattern for this Service Item.',
    statusReady: 'Workshop job list ready.',
    statusLoading: 'Loading workshop job list...',
    statusSaved: 'Loaded saved workshop job list.',
    statusNoSavedJobs: 'No saved workshop jobs were found for this Service Item.',
    statusPrompt: 'Enter Motor kW to load the workshop job list.',
    emptyPrompt: 'Enter Motor kW to load the workshop job list.',
    noJobsMessage: 'No workshop jobs were loaded for this motor size.',
    savePatternLabel: 'Workshop',
    requiresPositiveManhours: false
  },
  Onsite: {
    title: 'Onsite labor section',
    label: 'Onsite Pattern',
    description: 'Loads onsite jobs with blank manhours so each checked row can be entered and saved with the onsite pattern.',
    statusReady: 'Onsite labor section ready.',
    statusLoading: 'Loading onsite labor section...',
    statusSaved: 'Loaded saved onsite labor section.',
    statusNoSavedJobs: 'No saved onsite jobs were found for this Service Item.',
    statusPrompt: 'Enter Motor kW to load the onsite labor section.',
    emptyPrompt: 'Enter Motor kW to load the onsite labor section.',
    noJobsMessage: 'No onsite jobs were loaded for this motor size.',
    savePatternLabel: 'Onsite',
    requiresPositiveManhours: true
  }
};

const modalState = {
  initialized: false,
  branches: [],
  motorTypes: [],
  jobs: [],
  branchId: '',
  lastLoadedKey: '',
  resolvedMotorTypeId: null,
  resolvedMotorTypeName: '',
  snapshot: {
    repairMode: 'Workshop',
    workType: 'Motor',
    serviceType: 'Overhaul',
    motorKw: '',
    motorDriveType: 'AC',
    scope: 'medium-volt',
    priorityLevel: 'low',
    siteAccess: 'easy',
    onsiteCraneEnabled: false,
    onsiteFourPeopleEnabled: false,
    onsiteSafetyEnabled: false
  }
};

function normalizeDriveType(value) {
  return String(value || '').trim().toUpperCase() === 'DC' ? 'DC' : 'AC';
}

function normalizeRepairMode(value) {
  return String(value || '').trim().toLowerCase() === 'onsite' ? 'Onsite' : 'Workshop';
}

function normalizeOnsiteBoolean(value, fallback = false) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  return ['true', '1', 'yes', 'y'].includes(normalized);
}

function getSafeLocalStorageValue(key, fallback = '') {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch (error) {
    return fallback;
  }
}

export function getCurrentOnsiteSelections() {
  const scopeField = document.getElementById('scope');
  const priorityRadio = document.querySelector('input[name="priorityLevel"]:checked');
  const accessRadio = document.querySelector('input[name="siteAccess"]:checked');

  return {
    scope: String(scopeField?.value || getSafeLocalStorageValue(ONSITE_STORAGE_KEYS.SCOPE, 'medium-volt')).trim() || 'medium-volt',
    priorityLevel: String(priorityRadio?.value || getSafeLocalStorageValue(ONSITE_STORAGE_KEYS.PRIORITY_LEVEL, 'low')).trim().toLowerCase() || 'low',
    siteAccess: String(accessRadio?.value || getSafeLocalStorageValue(ONSITE_STORAGE_KEYS.SITE_ACCESS, 'easy')).trim().toLowerCase() || 'easy',
    onsiteCraneEnabled: normalizeOnsiteBoolean(getSafeLocalStorageValue(ONSITE_STORAGE_KEYS.ONSITE_CRANE_ENABLED, 'no')),
    onsiteFourPeopleEnabled: normalizeOnsiteBoolean(getSafeLocalStorageValue(ONSITE_STORAGE_KEYS.ONSITE_FOUR_PEOPLE_ENABLED, 'no')),
    onsiteSafetyEnabled: normalizeOnsiteBoolean(getSafeLocalStorageValue(ONSITE_STORAGE_KEYS.ONSITE_SAFETY_ENABLED, 'no'))
  };
}

function normalizeOnsiteSelections(snapshot = {}, fallback = null) {
  const base = fallback || getCurrentOnsiteSelections();

  return {
    scope: String(snapshot?.scope ?? base.scope ?? 'medium-volt').trim() || 'medium-volt',
    priorityLevel: String(snapshot?.priorityLevel ?? base.priorityLevel ?? 'low').trim().toLowerCase() || 'low',
    siteAccess: String(snapshot?.siteAccess ?? base.siteAccess ?? 'easy').trim().toLowerCase() || 'easy',
    onsiteCraneEnabled: normalizeOnsiteBoolean(snapshot?.onsiteCraneEnabled, base.onsiteCraneEnabled),
    onsiteFourPeopleEnabled: normalizeOnsiteBoolean(snapshot?.onsiteFourPeopleEnabled, base.onsiteFourPeopleEnabled),
    onsiteSafetyEnabled: normalizeOnsiteBoolean(snapshot?.onsiteSafetyEnabled, base.onsiteSafetyEnabled)
  };
}

function getRepairModeConfig(repairMode = modalState.snapshot.repairMode) {
  return REPAIR_MODE_CONFIGS[normalizeRepairMode(repairMode)] || REPAIR_MODE_CONFIGS.Workshop;
}

function formatManHoursValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '0';
  }

  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.?0+$/, '');
}

function parseMotorTypeRange(value) {
  const normalized = String(value || '')
    .replace(/[–—−]/g, '-')
    .trim();
  const rangeMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:k\s*w)?\s*-\s*(\d+(?:\.\d+)?)\s*(?:k\s*w)?/i);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    return {
      min: Math.min(min, max),
      max: Math.max(min, max)
    };
  }

  const kwTaggedNumbers = Array.from(normalized.matchAll(/(\d+(?:\.\d+)?)\s*k\s*w/gi))
    .map((match) => Number(match[1]))
    .filter((numeric) => Number.isFinite(numeric));

  if (kwTaggedNumbers.length >= 2) {
    return {
      min: Math.min(kwTaggedNumbers[0], kwTaggedNumbers[1]),
      max: Math.max(kwTaggedNumbers[0], kwTaggedNumbers[1])
    };
  }

  const numericTokens = Array.from(normalized.matchAll(/\d+(?:\.\d+)?/g))
    .map((match) => Number(match[0]))
    .filter((numeric) => Number.isFinite(numeric));

  if (numericTokens.length >= 2) {
    return {
      min: Math.min(numericTokens[0], numericTokens[1]),
      max: Math.max(numericTokens[0], numericTokens[1])
    };
  }

  const singleMatch = normalized.match(/(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    const numeric = Number(singleMatch[1]);
    return {
      min: numeric,
      max: numeric
    };
  }

  return null;
}

function getMotorTypeDriveMatches(motorTypeName = '') {
  const normalizedName = String(motorTypeName).toUpperCase();
  const matches = [];

  if (/\bAC\b/.test(normalizedName)) {
    matches.push('AC');
  }

  if (/\bDC\b/.test(normalizedName)) {
    matches.push('DC');
  }

  return matches;
}

function getSelectedBranch() {
  return modalState.branches.find((branch) => String(branch.BranchId) === String(modalState.branchId)) || null;
}

function isOverhaulJob(jobName = '') {
  const value = String(jobName).toLowerCase();
  return OVERHAUL_JOB_PATTERNS.some((pattern) => value.includes(pattern));
}

function isRewindJob(jobName = '') {
  const value = String(jobName).toLowerCase();
  return REWIND_JOB_PATTERNS.some((pattern) => value.includes(pattern));
}

function syncLockedBranch() {
  const branchField = el('branch');
  const branchDisplay = el('confirmNewSerBranchDisplay');
  const desiredBranchId = String(modalState.branchId || authState.user?.branchId || '').trim();
  modalState.branchId = desiredBranchId;

  const branchCode = String(branchField?.value || '').trim();

  if (branchDisplay) {
    branchDisplay.textContent = branchCode || 'No branch assigned';
  }
}

async function ensureReferenceData() {
  if (modalState.branches.length > 0 && modalState.motorTypes.length > 0) {
    return;
  }

  const [branches, motorTypes] = await Promise.all([
    fetchJson('/api/branches'),
    fetchJson('/api/motor-types')
  ]);

  modalState.branches = Array.isArray(branches) ? branches : [];
  modalState.motorTypes = Array.isArray(motorTypes) ? motorTypes : [];
  syncLockedBranch();
}

function resolveMotorTypeId(motorKw, motorDriveType) {
  const normalizedKw = Number(motorKw);
  const normalizedDriveType = normalizeDriveType(motorDriveType);

  if (!Number.isFinite(normalizedKw)) {
    return null;
  }

  const exactMatches = modalState.motorTypes
    .map((motorType) => {
      const range = parseMotorTypeRange(motorType.MotorTypeName);
      const driveMatches = getMotorTypeDriveMatches(motorType.MotorTypeName);
      const inRange = range && Number.isFinite(range.min) && Number.isFinite(range.max)
        ? normalizedKw >= range.min && normalizedKw <= range.max
        : false;
      const rangeWidth = range ? Math.abs(range.max - range.min) : Number.POSITIVE_INFINITY;

      return {
        motorType,
        inRange,
        rangeWidth,
        driveMatches,
        exactDrive: driveMatches.includes(normalizedDriveType),
        neutralDrive: driveMatches.length === 0
      };
    })
    .filter((candidate) => candidate.inRange && (candidate.exactDrive || candidate.neutralDrive));

  if (exactMatches.length === 0) {
    return null;
  }

  exactMatches.sort((left, right) => {
    if (left.exactDrive !== right.exactDrive) {
      return left.exactDrive ? -1 : 1;
    }

    if (left.rangeWidth !== right.rangeWidth) {
      return left.rangeWidth - right.rangeWidth;
    }

    return String(left.motorType.MotorTypeName).localeCompare(String(right.motorType.MotorTypeName));
  });

  return exactMatches[0].motorType;
}

function applyJobsByServiceType(serviceType) {
  if (!Array.isArray(modalState.jobs) || modalState.jobs.length === 0) {
    return;
  }

  modalState.jobs.forEach((job) => {
    const overhaulJob = isOverhaulJob(job.JobName);
    const rewindJob = isRewindJob(job.JobName);

    if (serviceType === 'Overhaul') {
      if (rewindJob) {
        job.checked = false;
      } else if (overhaulJob) {
        job.checked = true;
      }
    } else if (serviceType === 'Rewind') {
      if (overhaulJob) {
        job.checked = false;
      } else if (rewindJob) {
        job.checked = true;
      }
    }
  });
}

function sortJobsByCheckedState() {
  modalState.jobs.sort((left, right) => {
    const leftChecked = left.checked !== false ? 1 : 0;
    const rightChecked = right.checked !== false ? 1 : 0;

    if (leftChecked !== rightChecked) {
      return rightChecked - leftChecked;
    }

    const leftSortOrder = Number.isFinite(Number(left.SortOrder)) ? Number(left.SortOrder) : Number.POSITIVE_INFINITY;
    const rightSortOrder = Number.isFinite(Number(right.SortOrder)) ? Number(right.SortOrder) : Number.POSITIVE_INFINITY;
    if (leftSortOrder !== rightSortOrder) {
      return leftSortOrder - rightSortOrder;
    }

    return String(left.JobName || '').localeCompare(String(right.JobName || ''));
  });
}

function setLaborStatus(message, tone = 'muted') {
  const statusEl = el('confirmNewSerLaborStatus');
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message;
  statusEl.className = tone === 'error'
    ? 'text-sm text-rose-600'
    : tone === 'active'
      ? 'text-sm text-slate-600'
      : 'text-sm text-slate-500';
}

function requiresPositiveManhours(repairMode = modalState.snapshot.repairMode) {
  return getRepairModeConfig(repairMode).requiresPositiveManhours;
}

function hasMissingRequiredManhours(job, repairMode = modalState.snapshot.repairMode) {
  if (!requiresPositiveManhours(repairMode) || job?.checked === false) {
    return false;
  }

  const effectiveManHours = Number(job?.effectiveManHours ?? job?.ManHours ?? 0);
  return !Number.isFinite(effectiveManHours) || effectiveManHours <= 0;
}

function updateLaborModeCard() {
  const config = getRepairModeConfig();
  const titleEl = el('confirmNewSerLaborTitle');
  const patternLabelEl = el('confirmNewSerLaborPatternLabel');
  const summaryEl = el('confirmNewSerLaborSelectionSummary');

  if (titleEl) {
    titleEl.textContent = config.title;
  }

  if (patternLabelEl) {
    patternLabelEl.textContent = config.label;
  }

  if (summaryEl) {
    const checkedCount = modalState.jobs.filter((job) => job.checked !== false).length;
    summaryEl.textContent = `${checkedCount} / ${modalState.jobs.length}`;
  }
}

function renderOnsiteContext() {
  const contextWrap = el('confirmNewSerOnsiteContext');
  const scopeOptions = document.querySelectorAll('input[name="confirmNewSerOnsiteScope"]');
  const priorityOptions = document.querySelectorAll('input[name="confirmNewSerPriorityLevel"]');
  const siteAccessOptions = document.querySelectorAll('input[name="confirmNewSerSiteAccess"]');
  const craneField = el('confirmNewSerOnsiteCraneEnabled');
  const fourPeopleField = el('confirmNewSerOnsiteFourPeopleEnabled');
  const safetyField = el('confirmNewSerOnsiteSafetyEnabled');
  const optionsListEl = el('confirmNewSerOnsiteOptionsList');
  const isOnsite = normalizeRepairMode(modalState.snapshot.repairMode) === 'Onsite';

  if (!contextWrap) {
    return;
  }

  scopeOptions.forEach((option) => {
    option.checked = option.value === (modalState.snapshot.scope || 'medium-volt');
  });

  priorityOptions.forEach((option) => {
    option.checked = option.value === (modalState.snapshot.priorityLevel || 'low');
  });

  siteAccessOptions.forEach((option) => {
    option.checked = option.value === (modalState.snapshot.siteAccess || 'easy');
  });

  if (craneField) {
    craneField.checked = Boolean(modalState.snapshot.onsiteCraneEnabled);
  }

  if (fourPeopleField) {
    fourPeopleField.checked = Boolean(modalState.snapshot.onsiteFourPeopleEnabled);
  }

  if (safetyField) {
    safetyField.checked = Boolean(modalState.snapshot.onsiteSafetyEnabled);
  }

  contextWrap.classList.toggle('hidden', !isOnsite);
  if (!isOnsite) {
    return;
  }

  if (!optionsListEl) {
    return;
  }

  const selectedOptions = Object.entries(ONSITE_OPTION_LABELS)
    .filter(([key]) => modalState.snapshot[key])
    .map(([, label]) => label);
  const summaryParts = [
    ONSITE_SCOPE_LABELS[modalState.snapshot.scope] || 'Not selected',
    ONSITE_PRIORITY_LABELS[modalState.snapshot.priorityLevel] || 'Low',
    ONSITE_SITE_ACCESS_LABELS[modalState.snapshot.siteAccess] || 'Easy'
  ];

  if (selectedOptions.length === 0) {
    optionsListEl.innerHTML = `
      <span class="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">${escapeHtml(summaryParts.join(' • '))}</span>
      <span class="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">No onsite options selected</span>
    `;
    return;
  }

  optionsListEl.innerHTML = [
    `<span class="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">${escapeHtml(summaryParts.join(' • '))}</span>`,
    ...selectedOptions.map((label) => `<span class="inline-flex items-center rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-sky-800">${escapeHtml(label)}</span>`)
  ].join('');
}

function renderLaborMeta() {
  const metaEl = el('confirmNewSerLaborMeta');
  const headJobEl = el('confirmNewSerLaborHeadJob');
  const headHoursEl = el('confirmNewSerLaborHeadManhours');
  const config = getRepairModeConfig();
  updateLaborModeCard();
  renderOnsiteContext();

  if (headJobEl) {
    headJobEl.textContent = 'Job';
  }

  if (headHoursEl) {
    headHoursEl.textContent = 'Manhours';
  }

  if (!metaEl) {
    return;
  }

  const checkedCount = modalState.jobs.filter((job) => job.checked !== false).length;
  const totalCount = modalState.jobs.length;
  const selectedHours = modalState.jobs
    .filter((job) => job.checked !== false)
    .reduce((sum, job) => sum + (Number(job.effectiveManHours ?? job.ManHours ?? 0) || 0), 0);
  const branchCode = String(el('branch')?.value || '').trim();

  const parts = [config.savePatternLabel];
  if (modalState.resolvedMotorTypeName) {
    parts.push(modalState.resolvedMotorTypeName);
  }
  if (branchCode) {
    parts.push(branchCode);
  }
  if (totalCount > 0) {
    parts.push(`${checkedCount}/${totalCount} jobs selected`);
    parts.push(`${formatManHoursValue(selectedHours)} mh`);
  }

  metaEl.textContent = parts.join(' • ');
}

function renderJobsTable() {
  const rowsEl = el('confirmNewSerLaborRows');
  const emptyEl = el('confirmNewSerLaborEmpty');
  const tableWrap = el('confirmNewSerLaborTableWrap');
  const selectAllEl = el('confirmNewSerSelectAllJobs');
  const config = getRepairModeConfig();

  renderLaborMeta();

  if (!rowsEl || !emptyEl || !tableWrap) {
    return;
  }

  if (modalState.jobs.length === 0) {
    rowsEl.innerHTML = '';
    tableWrap.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    emptyEl.textContent = modalState.snapshot.workType !== 'Motor'
      ? 'Job list is available for Motor service items only.'
      : config.emptyPrompt;
    if (selectAllEl) {
      selectAllEl.checked = false;
      selectAllEl.indeterminate = false;
      selectAllEl.disabled = true;
    }
    return;
  }

  tableWrap.classList.remove('hidden');
  emptyEl.classList.add('hidden');

  const checkedJobs = modalState.jobs.filter((job) => job.checked !== false).length;
  if (selectAllEl) {
    selectAllEl.disabled = false;
    selectAllEl.checked = checkedJobs > 0 && checkedJobs === modalState.jobs.length;
    selectAllEl.indeterminate = checkedJobs > 0 && checkedJobs < modalState.jobs.length;
  }

  rowsEl.innerHTML = modalState.jobs.map((job, index) => {
    const effectiveManHours = Number(job.effectiveManHours ?? job.ManHours ?? 0);
    const isChecked = job.checked !== false;
    const rowClass = isChecked ? 'is-active' : 'is-inactive';
    const missingRequiredManhours = hasMissingRequiredManhours(job);
    const nameClass = [
      isChecked ? '' : 'is-muted',
      missingRequiredManhours ? 'is-required' : ''
    ].filter(Boolean).join(' ');
    const escapedJobName = escapeHtml(job.JobName || '');

    return `
      <tr class="confirm-new-ser-job-row ${rowClass}">
        <td class="confirm-new-ser-job-cell confirm-new-ser-job-cell-check">
          <input type="checkbox" class="confirm-new-ser-job-check rounded border-slate-300 text-slate-900 focus:ring-slate-400" data-confirm-ser-job-check="${index}" ${isChecked ? 'checked' : ''}>
        </td>
        <td class="confirm-new-ser-job-cell confirm-new-ser-job-cell-name">
          <div class="confirm-new-ser-job-name ${nameClass}">
            ${escapedJobName}${missingRequiredManhours ? '<span class="confirm-new-ser-job-required"> *</span>' : ''}
          </div>
        </td>
        <td class="confirm-new-ser-job-cell confirm-new-ser-job-cell-hours">
          <div class="confirm-new-ser-mh-field ${isChecked ? '' : 'is-disabled'} ${missingRequiredManhours ? 'is-required' : ''}">
            <input
              type="number"
              min="0"
              step="0.25"
              class="confirm-new-ser-mh-input ${isChecked ? '' : 'is-disabled'} ${missingRequiredManhours ? 'is-required' : ''}"
              data-confirm-ser-job-mh="${index}"
              value="${missingRequiredManhours ? '' : formatManHoursValue(effectiveManHours)}"
              placeholder="${missingRequiredManhours ? 'Required' : ''}"
              ${isChecked ? '' : 'disabled'}
            >
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadJobsForResolvedMotorType() {
  const { resolvedMotorTypeId, snapshot } = modalState;
  const repairMode = normalizeRepairMode(snapshot.repairMode);
  const config = getRepairModeConfig(repairMode);

  if (!resolvedMotorTypeId) {
    modalState.jobs = [];
    modalState.lastLoadedKey = '';
    renderJobsTable();
    return;
  }

  const loadKey = `${repairMode}:${resolvedMotorTypeId}:${snapshot.motorDriveType}`;
  if (modalState.lastLoadedKey === loadKey) {
    return;
  }

  setLaborStatus(config.statusLoading, 'active');

  if (repairMode === 'Onsite') {
    const params = new URLSearchParams({
      motorTypeId: String(resolvedMotorTypeId)
    });
    const jobs = await fetchJson(`/api/onsite/labor?${params.toString()}`);
    modalState.jobs = Array.isArray(jobs)
      ? jobs.map((job) => ({
        ...job,
        checked: job.checked !== false,
        effectiveManHours: Number(job.effectiveManHours ?? 0)
      }))
      : [];
  } else {
    const params = new URLSearchParams({
      motorTypeId: String(resolvedMotorTypeId),
      motorDriveType: snapshot.motorDriveType
    });

    const [jobs, motorJobDefaults] = await Promise.all([
      fetchJson(`/api/workshop/labor?${params.toString()}`),
      getMotorJobDefaults()
    ]);

    modalState.jobs = Array.isArray(jobs)
      ? jobs.map((job) => {
        const defaultChecked = shouldMotorJobBeCheckedByDefault(job.JobName, motorJobDefaults);
        const defaultManHours = Number(job.ManHours || 0);

        return {
          ...job,
          checked: defaultChecked,
          effectiveManHours: defaultManHours
        };
      })
      : [];
  }

  sortJobsByCheckedState();
  modalState.lastLoadedKey = loadKey;
}

function setResolvedMotorType(resolvedMotorType) {
  modalState.resolvedMotorTypeId = resolvedMotorType ? resolvedMotorType.MotorTypeId : null;
  modalState.resolvedMotorTypeName = resolvedMotorType ? resolvedMotorType.MotorTypeName : '';
}

export function initConfirmNewSerLaborUi() {
  if (modalState.initialized) {
    return;
  }

  modalState.initialized = true;

  const laborRows = el('confirmNewSerLaborRows');
  const selectAllJobs = el('confirmNewSerSelectAllJobs');

  const updateJobManHours = (target, { shouldRender = false } = {}) => {
    const mhIndex = target?.dataset?.confirmSerJobMh;
    if (mhIndex === undefined) {
      return false;
    }

    const job = modalState.jobs[Number(mhIndex)];
    if (!job) {
      return true;
    }

    const nextValue = Math.max(0, Number.parseFloat(target.value || '0') || 0);
    job.effectiveManHours = Number(nextValue.toFixed(2));

    if (shouldRender) {
      renderJobsTable();
    }

    return true;
  };

  selectAllJobs?.addEventListener('change', () => {
    modalState.jobs.forEach((job) => {
      job.checked = selectAllJobs.checked;
    });
    sortJobsByCheckedState();
    renderJobsTable();
  });

  laborRows?.addEventListener('change', (event) => {
    const checkIndex = event.target?.dataset?.confirmSerJobCheck;

    if (checkIndex !== undefined) {
      const job = modalState.jobs[Number(checkIndex)];
      if (!job) {
        return;
      }

      job.checked = Boolean(event.target.checked);
      sortJobsByCheckedState();
      renderJobsTable();
      return;
    }

    updateJobManHours(event.target, { shouldRender: true });
  });

  laborRows?.addEventListener('input', (event) => {
    updateJobManHours(event.target);
  });
}

export function resetConfirmNewSerLaborProfile() {
  modalState.jobs = [];
  modalState.lastLoadedKey = '';
  modalState.resolvedMotorTypeId = null;
  modalState.resolvedMotorTypeName = '';
  modalState.snapshot = {
    repairMode: 'Workshop',
    workType: 'Motor',
    serviceType: 'Overhaul',
    motorKw: '',
    motorDriveType: 'AC',
    scope: 'medium-volt',
    priorityLevel: 'low',
    siteAccess: 'easy',
    onsiteCraneEnabled: false,
    onsiteFourPeopleEnabled: false,
    onsiteSafetyEnabled: false
  };
  syncLockedBranch();
  setLaborStatus(REPAIR_MODE_CONFIGS.Workshop.statusPrompt);
  renderJobsTable();
}

export async function syncConfirmNewSerLaborProfile(snapshot, { forceReload = false } = {}) {
  await ensureReferenceData();
  syncLockedBranch();
  const currentOnsiteSelections = getCurrentOnsiteSelections();

  modalState.snapshot = {
    repairMode: normalizeRepairMode(snapshot?.repairMode),
    workType: String(snapshot?.workType || '').trim() || 'Motor',
    serviceType: String(snapshot?.serviceType || '').trim() || 'Overhaul',
    motorKw: String(snapshot?.motorKw || '').trim(),
    motorDriveType: snapshot?.motorIsDc ? 'DC' : 'AC',
    ...normalizeOnsiteSelections(snapshot, currentOnsiteSelections)
  };

  const config = getRepairModeConfig();

  if (modalState.snapshot.workType !== 'Motor') {
    setResolvedMotorType(null);
    modalState.jobs = [];
    modalState.lastLoadedKey = '';
    setLaborStatus('Job list is available for Motor service items only.');
    renderJobsTable();
    return;
  }

  const motorKw = Number.parseFloat(modalState.snapshot.motorKw);
  if (!Number.isFinite(motorKw)) {
    setResolvedMotorType(null);
    modalState.jobs = [];
    modalState.lastLoadedKey = '';
    setLaborStatus(config.statusPrompt);
    renderJobsTable();
    return;
  }

  const resolvedMotorType = resolveMotorTypeId(motorKw, modalState.snapshot.motorDriveType);
  if (!resolvedMotorType) {
    setResolvedMotorType(null);
    modalState.jobs = [];
    modalState.lastLoadedKey = '';
    setLaborStatus(`No ${modalState.snapshot.motorDriveType} motor type matched ${modalState.snapshot.motorKw} kW.`, 'error');
    renderJobsTable();
    return;
  }

  setResolvedMotorType(resolvedMotorType);

  if (forceReload) {
    modalState.lastLoadedKey = '';
  }

  await loadJobsForResolvedMotorType();
  if (normalizeRepairMode(modalState.snapshot.repairMode) === 'Workshop') {
    applyJobsByServiceType(modalState.snapshot.serviceType);
  }
  sortJobsByCheckedState();
  setLaborStatus(config.statusReady);
  renderJobsTable();
}

export function getConfirmNewSerLaborValidation(snapshot) {
  const repairMode = normalizeRepairMode(snapshot?.repairMode);
  const config = getRepairModeConfig(repairMode);

  if (String(snapshot?.workType || '').trim() !== 'Motor') {
    return null;
  }

  if (!modalState.branchId) {
    return {
      message: 'No branch was found from the main Sales Quote form.'
    };
  }

  if (!modalState.resolvedMotorTypeId) {
    return {
      message: 'No motor type matched this motor kW. Please adjust the kW value.',
      focusElement: el('confirmNewSerMotorKw')
    };
  }

  if (!Array.isArray(modalState.jobs) || modalState.jobs.length === 0) {
    return {
      message: config.noJobsMessage,
      focusElement: el('confirmNewSerMotorKw')
    };
  }

  if (requiresPositiveManhours(repairMode)) {
    const checkedJobs = modalState.jobs.filter((job) => job.checked !== false);
    if (checkedJobs.length === 0) {
      return {
        message: 'Please select at least one onsite job before creating the Service Item.',
        focusElement: el('confirmNewSerSelectAllJobs')
      };
    }

    const missingIndex = modalState.jobs.findIndex((job) => hasMissingRequiredManhours(job, repairMode));
    if (missingIndex !== -1) {
      return {
        message: 'Onsite requires manhours greater than 0 for every checked job.',
        focusElement: document.querySelector(`[data-confirm-ser-job-mh="${missingIndex}"]`)
      };
    }
  }

  return null;
}

function applyLaborProfileToModalState(profile, snapshot) {
  const currentOnsiteSelections = getCurrentOnsiteSelections();
  const normalizedJobs = Array.isArray(profile?.jobs)
    ? profile.jobs.map((job, index) => ({
      JobId: Number(job.jobId || 0),
      JobCode: String(job.jobCode || '').trim(),
      JobName: String(job.jobName || '').trim(),
      ManHours: Number.isFinite(Number(job.originalManHours)) ? Number(job.originalManHours) : 0,
      effectiveManHours: Number.isFinite(Number(job.effectiveManHours)) ? Number(job.effectiveManHours) : 0,
      checked: job.isChecked !== false,
      SortOrder: Number.isFinite(Number(job.sortOrder)) ? Number(job.sortOrder) : index + 1
    }))
    : [];

  modalState.snapshot = {
    repairMode: normalizeRepairMode(profile?.repairMode || snapshot?.repairMode),
    workType: String(profile?.workType || snapshot?.workType || '').trim() || 'Motor',
    serviceType: String(profile?.serviceType || snapshot?.serviceType || '').trim() || 'Overhaul',
    motorKw: profile?.motorKw === null || profile?.motorKw === undefined
      ? String(snapshot?.motorKw || '').trim()
      : String(profile.motorKw),
    motorDriveType: normalizeDriveType(profile?.motorDriveType || (snapshot?.motorIsDc ? 'DC' : 'AC')),
    ...normalizeOnsiteSelections(profile, normalizeOnsiteSelections(snapshot, currentOnsiteSelections))
  };

  modalState.jobs = normalizedJobs;
  modalState.resolvedMotorTypeId = Number.isFinite(Number(profile?.motorTypeId)) ? Number(profile.motorTypeId) : null;
  modalState.resolvedMotorTypeName = '';
  modalState.lastLoadedKey = `saved:${modalState.snapshot.repairMode}:${String(profile?.serviceItemNo || '').trim()}`;

  if (modalState.resolvedMotorTypeId) {
    const matchedMotorType = modalState.motorTypes.find((motorType) => Number(motorType.MotorTypeId) === modalState.resolvedMotorTypeId);
    modalState.resolvedMotorTypeName = matchedMotorType?.MotorTypeName || '';
  }

  if (!modalState.resolvedMotorTypeName && String(profile?.motorKw || '').trim()) {
    modalState.resolvedMotorTypeName = `${profile.motorKw} kW ${modalState.snapshot.motorDriveType}`.trim();
  }

  if (Number.isFinite(Number(profile?.branchId))) {
    modalState.branchId = String(profile.branchId);
  }

  const config = getRepairModeConfig(modalState.snapshot.repairMode);
  sortJobsByCheckedState();
  setLaborStatus(normalizedJobs.length > 0 ? config.statusSaved : config.statusNoSavedJobs);
  renderJobsTable();
}

export async function loadConfirmNewSerLaborProfile(serviceItemNo) {
  const normalizedServiceItemNo = String(serviceItemNo || '').trim();
  if (!normalizedServiceItemNo) {
    return null;
  }

  const response = await fetchWithAuth(`${SERVICE_ITEM_LABOR_API_BASE}/${encodeURIComponent(normalizedServiceItemNo)}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to load Service Item labor profile (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return result?.profile || null;
}

export async function hydrateConfirmNewSerLaborProfile(serviceItemNo, snapshot = {}) {
  await ensureReferenceData();
  syncLockedBranch();

  const profile = await loadConfirmNewSerLaborProfile(serviceItemNo);
  if (!profile) {
    await syncConfirmNewSerLaborProfile(snapshot, { forceReload: true });
    return null;
  }

  applyLaborProfileToModalState(profile, snapshot);
  return profile;
}

function buildLaborPayload(snapshot, extra = {}) {
  const repairMode = normalizeRepairMode(snapshot?.repairMode);
  const payloadJobs = Array.isArray(extra.jobs) ? extra.jobs : modalState.jobs;
  const onsiteSelections = normalizeOnsiteSelections(snapshot, getCurrentOnsiteSelections());

  return {
    repairMode,
    serviceItemDescription: String(extra.description || '').trim() || null,
    workType: snapshot.workType || 'Motor',
    serviceType: snapshot.serviceType || null,
    motorKw: snapshot.workType === 'Motor'
      ? (Number.isFinite(Number.parseFloat(snapshot.motorKw)) ? Number(Number.parseFloat(snapshot.motorKw).toFixed(2)) : null)
      : null,
    motorDriveType: snapshot.workType === 'Motor' ? normalizeDriveType(snapshot.motorIsDc ? 'DC' : 'AC') : null,
    branchId: modalState.branchId ? Number(modalState.branchId) : null,
    motorTypeId: snapshot.workType === 'Motor' && modalState.resolvedMotorTypeId ? Number(modalState.resolvedMotorTypeId) : null,
    customerNo: String(extra.customerNo || '').trim() || null,
    groupNo: String(extra.groupNo || '').trim() || null,
    scope: repairMode === 'Onsite' ? onsiteSelections.scope || null : null,
    priorityLevel: repairMode === 'Onsite' ? onsiteSelections.priorityLevel || null : null,
    siteAccess: repairMode === 'Onsite' ? onsiteSelections.siteAccess || null : null,
    onsiteCraneEnabled: repairMode === 'Onsite' ? onsiteSelections.onsiteCraneEnabled : null,
    onsiteFourPeopleEnabled: repairMode === 'Onsite' ? onsiteSelections.onsiteFourPeopleEnabled : null,
    onsiteSafetyEnabled: repairMode === 'Onsite' ? onsiteSelections.onsiteSafetyEnabled : null,
    jobs: payloadJobs.map((job, index) => ({
      jobId: Number(job.JobId),
      jobCode: String(job.JobCode || '').trim() || null,
      jobName: String(job.JobName || '').trim(),
      originalManHours: Number.isFinite(Number(job.ManHours)) ? Number(Number(job.ManHours).toFixed(2)) : 0,
      effectiveManHours: Number.isFinite(Number(job.effectiveManHours)) ? Number(Number(job.effectiveManHours).toFixed(2)) : 0,
      isChecked: job.checked !== false,
      sortOrder: Number.isFinite(Number(job.SortOrder)) ? Number(job.SortOrder) : index + 1
    }))
  };
}

export function getConfirmNewSerLaborJobsSnapshot() {
  return modalState.jobs.map((job, index) => ({
    JobId: Number(job.JobId || 0),
    JobCode: String(job.JobCode || '').trim(),
    JobName: String(job.JobName || '').trim(),
    ManHours: Number.isFinite(Number(job.ManHours)) ? Number(job.ManHours) : 0,
    effectiveManHours: Number.isFinite(Number(job.effectiveManHours)) ? Number(job.effectiveManHours) : 0,
    checked: job.checked !== false,
    SortOrder: Number.isFinite(Number(job.SortOrder)) ? Number(job.SortOrder) : index + 1
  }));
}

export async function saveConfirmNewSerLaborProfile(serviceItemNo, snapshot, extra = {}) {
  const payload = buildLaborPayload(snapshot, extra);

  const response = await fetchWithAuth(`${SERVICE_ITEM_LABOR_API_BASE}/${encodeURIComponent(serviceItemNo)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to save Service Item labor profile (${response.status}): ${errorText}`);
  }

  return response.json();
}
