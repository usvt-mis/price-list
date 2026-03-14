/**
 * Workshop Calculator - Motor Type helpers
 * Handles AC/DC filtering and dropdown rendering for workshop motor types.
 */

import { el } from '../core/utils.js';
import { appState } from './state.js';

const MOTOR_DRIVE_TYPES = new Set(['AC', 'DC']);

function getMotorDriveMatches(motorTypeName = '') {
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

function getVisibleMotorTypes(driveType = appState.motorDriveType) {
  return appState.motorTypes.filter((motorType) => {
    const matches = getMotorDriveMatches(motorType.MotorTypeName);
    return matches.length === 0 || matches.includes(driveType);
  });
}

function updateMotorDriveToggleUi(visibleMotorTypes) {
  document.querySelectorAll('input[name="motorDriveType"]').forEach((input) => {
    input.checked = input.value === appState.motorDriveType;
  });

  const hintEl = el('motorTypeFilterHint');
  if (!hintEl) {
    return;
  }

  const totalCount = appState.motorTypes.length;
  const visibleCount = visibleMotorTypes.length;

  if (totalCount === 0) {
    hintEl.textContent = 'Loading motor types...';
    return;
  }

  if (visibleCount === 0) {
    hintEl.textContent = `No ${appState.motorDriveType} motor types found`;
    return;
  }

  if (visibleCount === totalCount) {
    hintEl.textContent = `${appState.motorDriveType} filter active`;
    return;
  }

  hintEl.textContent = `${appState.motorDriveType} filter - ${visibleCount} of ${totalCount} options`;
}

export function getMotorDriveTypeFromName(motorTypeName = '') {
  const matches = getMotorDriveMatches(motorTypeName);
  return matches.length === 1 ? matches[0] : null;
}

export function getMotorDriveTypeForMotorTypeId(motorTypeId) {
  const selectedMotorType = appState.motorTypes.find(
    (motorType) => String(motorType.MotorTypeId) === String(motorTypeId)
  );

  return selectedMotorType ? getMotorDriveTypeFromName(selectedMotorType.MotorTypeName) : null;
}

export function getDefaultMotorDriveType(motorTypes = appState.motorTypes) {
  const acCount = motorTypes.filter((motorType) => getMotorDriveMatches(motorType.MotorTypeName).includes('AC')).length;
  const dcCount = motorTypes.filter((motorType) => getMotorDriveMatches(motorType.MotorTypeName).includes('DC')).length;

  if (acCount === 0 && dcCount > 0) {
    return 'DC';
  }

  return 'AC';
}

export function renderMotorTypeOptions({ preserveSelection = true } = {}) {
  const motorTypeEl = el('motorType');
  const previousValue = preserveSelection ? String(motorTypeEl?.value || '') : '';
  const visibleMotorTypes = getVisibleMotorTypes();

  if (!motorTypeEl) {
    return { selectionPreserved: false, visibleMotorTypes };
  }

  motorTypeEl.innerHTML = '';

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = visibleMotorTypes.length > 0 ? 'Select...' : `No ${appState.motorDriveType} motor types`;
  motorTypeEl.appendChild(defaultOption);

  visibleMotorTypes.forEach((motorType) => {
    const option = document.createElement('option');
    option.value = motorType.MotorTypeId;
    option.textContent = motorType.MotorTypeName;
    motorTypeEl.appendChild(option);
  });

  let selectionPreserved = false;
  if (previousValue && visibleMotorTypes.some((motorType) => String(motorType.MotorTypeId) === previousValue)) {
    motorTypeEl.value = previousValue;
    selectionPreserved = true;
  }

  updateMotorDriveToggleUi(visibleMotorTypes);

  return { selectionPreserved, visibleMotorTypes };
}

export function populateMotorTypeOptions(motorTypes, { preserveSelection = true } = {}) {
  appState.motorTypes = Array.isArray(motorTypes) ? motorTypes : [];

  if (!MOTOR_DRIVE_TYPES.has(appState.motorDriveType) || getVisibleMotorTypes(appState.motorDriveType).length === 0) {
    appState.motorDriveType = getDefaultMotorDriveType(appState.motorTypes);
  }

  return renderMotorTypeOptions({ preserveSelection });
}

export function setMotorDriveType(driveType, { preserveSelection = true } = {}) {
  if (!MOTOR_DRIVE_TYPES.has(driveType)) {
    return renderMotorTypeOptions({ preserveSelection });
  }

  appState.motorDriveType = driveType;
  return renderMotorTypeOptions({ preserveSelection });
}

export function syncMotorDriveTypeToMotorTypeId(motorTypeId) {
  const detectedDriveType = getMotorDriveTypeForMotorTypeId(motorTypeId);

  if (detectedDriveType) {
    return setMotorDriveType(detectedDriveType, { preserveSelection: true });
  }

  return renderMotorTypeOptions({ preserveSelection: true });
}
