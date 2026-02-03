/**
 * Application Configuration (Backend)
 * Constants and configuration values
 */

// Travel cost rate (baht per km)
const TRAVEL_RATE = 15;

// Commission tiers based on Grand Total to STC ratio
// These must match the frontend configuration in src/js/config.js
const COMMISSION_TIERS = [
  { maxRatio: 0.8, percent: 0 },
  { maxRatio: 1.0, percent: 1 },
  { maxRatio: 1.05, percent: 2 },
  { maxRatio: 1.20, percent: 2.5 },
  { maxRatio: Infinity, percent: 5 }
];

module.exports = {
  TRAVEL_RATE,
  COMMISSION_TIERS
};
