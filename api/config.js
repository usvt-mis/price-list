/**
 * Application Configuration (Backend)
 * Constants and configuration values
 */

// Travel cost rate (baht per km)
const TRAVEL_RATE = 15;

// Commission tiers based on Grand Total to SSP ratio
// These must match the frontend configuration in src/js/core/config.js
const COMMISSION_TIERS = [
  { minRatio: 0, maxRatio: 0.8, percent: 0 },        // [0, 0.8) = 0%
  { minRatio: 0.8, maxRatio: 1.0, percent: 1 },     // [0.8, 1.0) = 1%
  { minRatio: 1.0, maxRatio: 1.05, percent: 2 },    // [1.0, 1.05) = 2%
  { minRatio: 1.05, maxRatio: 1.20, percent: 2.5 }, // [1.05, 1.20) = 2.5%
  { minRatio: 1.20, maxRatio: Infinity, percent: 5 } // [1.20, ∞) = 5%
];

module.exports = {
  TRAVEL_RATE,
  COMMISSION_TIERS
};
