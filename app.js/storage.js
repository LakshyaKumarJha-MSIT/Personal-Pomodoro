// storage.js - everything about saving and loading data.
// No other file touches localStorage directly.

import {
  isDev, SCHEMA_VERSION, APP_ID, DEFAULT_SETTINGS, MIN_MINUTES, MAX_MINUTES,
} from './config.js';

// Dev mode uses its own keys so test sessions never mix with real ones.
// (The real keys are the same ones the app has always used.)
const PREFIX = isDev ? 'pomodoro-dev-' : 'pomodoro-';
const KEYS = {
  settings: PREFIX + 'settings',
  stats: PREFIX + 'stats',     // { "2026-11-15": 3 }  sessions per day
  log: PREFIX + 'log',         // [{ date, time, task, minutes }]  every session
  schema: PREFIX + 'schema',   // the version number of the saved data
};

// ---------- Low-level read / write ----------
// localStorage only stores text, so we convert with JSON.stringify / JSON.parse

function readJSON(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (e) {
    return fallback;   // storage blocked or data broken: use the default
  }
}

// Returns true if it saved, false if it failed (private window, storage full...)
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

// ---------- Dates ----------

// Today's date as "YYYY-MM-DD" using the local time zone
// (toISOString() would use UTC and give the wrong day near midnight)
export function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ---------- Cleaning ----------
// Saved data and imported files are never trusted. Each function below turns
// "whatever was there" into data of exactly the right shape.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanMinutes(value, fallback) {
  const number = Number.parseInt(value, 10);
  return number >= MIN_MINUTES && number <= MAX_MINUTES ? number : fallback;
}

function cleanSettings(raw) {
  const clean = { ...DEFAULT_SETTINGS };
  if (!isObject(raw)) return clean;
  clean.focus = cleanMinutes(raw.focus, clean.focus);
  clean.short = cleanMinutes(raw.short, clean.short);
  clean.long = cleanMinutes(raw.long, clean.long);
  clean.autoStart = raw.autoStart === true;
  clean.theme = raw.theme === 'light' ? 'light' : 'dark';
  clean.task = typeof raw.task === 'string' ? raw.task.slice(0, 60) : '';
  return clean;
}

function cleanStats(raw) {
  const clean = {};
  if (!isObject(raw)) return clean;
  for (const [date, count] of Object.entries(raw)) {
    if (DATE_PATTERN.test(date) && Number.isInteger(count) && count > 0) {
      clean[date] = count;
    }
  }
  return clean;
}

function cleanLog(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) =>
      isObject(entry) &&
      DATE_PATTERN.test(entry.date) &&
      Number.isFinite(entry.time) &&
      Number.isFinite(entry.minutes) && entry.minutes > 0)
    .map((entry) => ({
      date: entry.date,
      time: entry.time,
      task: typeof entry.task === 'string' ? entry.task.slice(0, 60) : '',
      minutes: entry.minutes,
    }));
}

function cleanAll(data) {
  return {
    settings: cleanSettings(data.settings),
    stats: cleanStats(data.stats),
    log: cleanLog(data.log),
  };
}

// ---------- Migrations ----------
// When you change the shape of the saved data: raise SCHEMA_VERSION in
// config.js and add a step here that turns the OLD shape into the NEW one.
// Example for a future version 2:
//   2: (data) => { /* change data.settings, data.stats or data.log */ return data; },
// Steps run in order, so data from any older version catches up.
// Version 1 is the shape the app had before versions existed, so it needs no step.
const MIGRATIONS = {};

function migrate(data, fromVersion) {
  let version = fromVersion;
  while (version < SCHEMA_VERSION) {
    version++;
    const step = MIGRATIONS[version];
    if (step) data = step(data);
  }
  return data;
}

// ---------- Loading and saving ----------

export function loadAllData() {
  const storedVersion = readJSON(KEYS.schema, 0);
  let data = {
    settings: readJSON(KEYS.settings, {}),
    stats: readJSON(KEYS.stats, {}),
    log: readJSON(KEYS.log, []),
  };

  const isOld = !Number.isInteger(storedVersion) || storedVersion < SCHEMA_VERSION;
  if (isOld) data = migrate(data, Number.isInteger(storedVersion) ? storedVersion : 0);
  data = cleanAll(data);

  // Save the migrated data and its version number. (Data from a NEWER version of
  // the app is left alone, so an old copy of the page can't downgrade the version.)
  if (isOld) replaceAllData(data);
  return data;
}

export const saveSettings = (settings) => writeJSON(KEYS.settings, settings);
export const saveStats = (stats) => writeJSON(KEYS.stats, stats);
export const saveLog = (log) => writeJSON(KEYS.log, log);

// Saves everything at once, plus the version number. Returns true only if all of it saved.
export function replaceAllData(data) {
  const results = [
    writeJSON(KEYS.settings, data.settings),
    writeJSON(KEYS.stats, data.stats),
    writeJSON(KEYS.log, data.log),
    writeJSON(KEYS.schema, SCHEMA_VERSION),
  ];
  return results.every(Boolean);
}

// ---------- Backup files ----------

export function buildBackup(settings, stats, log) {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    stats,
    log,
  };
}

// Checks a backup file's text. Returns { ok: true, data } or { ok: false, error }.
export function parseBackup(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: "That file isn't valid JSON, so it can't be a backup." };
  }

  if (!isObject(backup) || backup.app !== APP_ID) {
    return { ok: false, error: "That file isn't a backup from this app." };
  }
  if (!Number.isInteger(backup.schemaVersion) || backup.schemaVersion < 1) {
    return { ok: false, error: "That backup has no valid version number." };
  }
  if (backup.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: 'That backup was made by a newer version of the app. Update the app first.' };
  }

  const data = cleanAll(migrate(backup, backup.schemaVersion));
  return { ok: true, data };
}
