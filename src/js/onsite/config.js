/**
 * Onsite Calculator Configuration
 * Onsite-specific constants and settings
 */

import { STORAGE_KEY_PREFIXES, TRAVEL_RATE, COMMISSION_TIERS } from '../core/config.js';

// Calculator type identifier
export const CALCULATOR_TYPE = 'onsite';

// Storage key prefix for onsite calculator
export const STORAGE_PREFIX = STORAGE_KEY_PREFIXES.ONSITE;

// Full storage keys for onsite-specific state
export const STORAGE_KEYS = {
  SCOPE: `${STORAGE_PREFIX}scope`,
  PRIORITY_LEVEL: `${STORAGE_PREFIX}priority-level`,
  SITE_ACCESS: `${STORAGE_PREFIX}site-access`,
  ONSITE_CRANE_ENABLED: `${STORAGE_PREFIX}onsite-crane-enabled`,
  ONSITE_CRANE_PRICE: `${STORAGE_PREFIX}onsite-crane-price`,
  ONSITE_FOUR_PEOPLE_ENABLED: `${STORAGE_PREFIX}onsite-four-people-enabled`,
  ONSITE_FOUR_PEOPLE_PRICE: `${STORAGE_PREFIX}onsite-four-people-price`,
  ONSITE_SAFETY_ENABLED: `${STORAGE_PREFIX}onsite-safety-enabled`,
  ONSITE_SAFETY_PRICE: `${STORAGE_PREFIX}onsite-safety-price`
};

// Scope options for onsite calculations
export const SCOPE_OPTIONS = [
  { value: 'low-volt', label: 'Low Volt' },
  { value: 'medium-volt', label: 'Medium Volt' },
  { value: 'large', label: 'Large' }
];

// Priority Level options for onsite calculations
export const PRIORITY_LEVEL_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' }
];

// Site Access options for onsite calculations
export const SITE_ACCESS_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'difficult', label: 'Difficult' }
];

// Onsite Options
export const ONSITE_OPTIONS = [
  { id: 'crane', label: 'ใช้ Crane', name: 'craneEnabled' },
  { id: 'fourPeople', label: 'ใช้ 4 ผู้', name: 'fourPeopleEnabled' },
  { id: 'safety', label: 'ใช้ Safety', name: 'safetyEnabled' }
];

export const ONSITE_OPTION_VALUES = {
  YES: 'yes',
  NO: 'no'
};

// Re-export shared constants
export { TRAVEL_RATE, COMMISSION_TIERS };
