import { fetchJson } from './utils.js';

export const MOTOR_JOB_DEFAULTS = Object.freeze({
  uncheckedPrefixes: ['wire arc', 'hvof']
});

let motorJobDefaultsPromise = null;

export function normalizeMotorJobDefaults(settings = {}) {
  const rawPrefixes = Array.isArray(settings?.uncheckedPrefixes)
    ? settings.uncheckedPrefixes
    : MOTOR_JOB_DEFAULTS.uncheckedPrefixes;

  const uncheckedPrefixes = rawPrefixes
    .map((prefix) => String(prefix || '').trim().toLowerCase())
    .filter(Boolean);

  return {
    uncheckedPrefixes: Array.from(new Set(uncheckedPrefixes))
  };
}

export function shouldMotorJobBeCheckedByDefault(jobName = '', settings = MOTOR_JOB_DEFAULTS) {
  const normalizedJobName = String(jobName || '').trim().toLowerCase();
  const normalizedSettings = normalizeMotorJobDefaults(settings);

  if (!normalizedJobName) {
    return true;
  }

  return !normalizedSettings.uncheckedPrefixes.some((prefix) => normalizedJobName.startsWith(prefix));
}

export async function getMotorJobDefaults({ forceRefresh = false } = {}) {
  if (!forceRefresh && motorJobDefaultsPromise) {
    return motorJobDefaultsPromise;
  }

  motorJobDefaultsPromise = (async () => {
    try {
      const response = await fetchJson('/api/app-settings/motor-job-defaults');
      return normalizeMotorJobDefaults(response?.value || MOTOR_JOB_DEFAULTS);
    } catch (error) {
      console.warn('Falling back to default motor job settings:', error);
      return normalizeMotorJobDefaults(MOTOR_JOB_DEFAULTS);
    }
  })();

  return motorJobDefaultsPromise;
}
