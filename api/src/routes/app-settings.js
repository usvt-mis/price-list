const express = require('express');
const { getPool } = require('../db');
const { getBackofficeSetting } = require('../utils/backofficeSettings');

const router = express.Router();

const INDEX_MENU_VISIBILITY_KEY = 'index-menu-visibility';
const MOTOR_JOB_DEFAULTS_KEY = 'motor-job-defaults';
const TIMEBOARD_DISPLAY_SETTINGS_KEY = 'timeboard-display-settings';

function normalizeMotorJobDefaults(value = {}) {
  const uncheckedPrefixes = Array.isArray(value?.uncheckedPrefixes)
    ? value.uncheckedPrefixes
        .map((prefix) => String(prefix || '').trim().toLowerCase())
        .filter(Boolean)
    : [];

  return {
    uncheckedPrefixes: Array.from(new Set(uncheckedPrefixes))
  };
}

function normalizeTimeboardDisplaySettings(value = {}) {
  return {
    useMockTimeline: value?.useMockTimeline !== false
  };
}

router.get('/index-menu-visibility', async (req, res, next) => {
  try {
    const pool = await getPool();
    const record = await getBackofficeSetting(pool, INDEX_MENU_VISIBILITY_KEY);

    if (!record) {
      return res.status(200).json({
        settingKey: INDEX_MENU_VISIBILITY_KEY,
        value: null
      });
    }

    res.status(200).json({
      settingKey: record.settingKey,
      value: record.value,
      updatedAt: record.updatedAt,
      updatedBy: record.updatedBy
    });
  } catch (error) {
    next(error);
  }
});

router.get('/motor-job-defaults', async (req, res, next) => {
  try {
    const pool = await getPool();
    const record = await getBackofficeSetting(pool, MOTOR_JOB_DEFAULTS_KEY);

    if (!record) {
      return res.status(200).json({
        settingKey: MOTOR_JOB_DEFAULTS_KEY,
        value: null
      });
    }

    res.status(200).json({
      settingKey: record.settingKey,
      value: normalizeMotorJobDefaults(record.value),
      updatedAt: record.updatedAt,
      updatedBy: record.updatedBy
    });
  } catch (error) {
    next(error);
  }
});

router.get('/timeboard-display-settings', async (req, res, next) => {
  try {
    const pool = await getPool();
    const record = await getBackofficeSetting(pool, TIMEBOARD_DISPLAY_SETTINGS_KEY);

    if (!record) {
      return res.status(200).json({
        settingKey: TIMEBOARD_DISPLAY_SETTINGS_KEY,
        value: null
      });
    }

    res.status(200).json({
      settingKey: record.settingKey,
      value: normalizeTimeboardDisplaySettings(record.value),
      updatedAt: record.updatedAt,
      updatedBy: record.updatedBy
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
