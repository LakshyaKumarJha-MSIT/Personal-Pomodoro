// config.js - fixed values that never change while the app runs.
// Every other file imports what it needs from here.

// Dev mode: open the page with "?dev" on the end of the address
// (for example http://localhost:8000/?dev).
// In dev mode 1 "minute" lasts only 1 second, and everything is saved in a
// separate place, so your real settings and stats are never touched.
export const isDev = new URLSearchParams(location.search).has('dev');
export const SECONDS_PER_MINUTE = isDev ? 1 : 60;

export const SESSIONS_BEFORE_LONG_BREAK = 4;
export const MIN_MINUTES = 1;
export const MAX_MINUTES = 180;

export const LABELS = {
  focus: 'Focus Time',
  short: 'Short Break',
  long: 'Long Break',
};

// Ring math: the distance around a circle is 2 * pi * radius
export const RING_RADIUS = 130;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Saved data has a version number. If the shape of the data ever changes,
// raise SCHEMA_VERSION and add a migration step in storage.js.
export const SCHEMA_VERSION = 1;
export const APP_ID = 'pomodoro-timer';   // written into backup files

export const DEFAULT_SETTINGS = {
  focus: 25,
  short: 5,
  long: 15,
  autoStart: false,
  theme: 'dark',   // 'dark' | 'light'
  task: '',        // what you're working on (the task label)
};
