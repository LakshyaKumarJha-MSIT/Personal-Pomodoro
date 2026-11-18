// state.js - everything the app "remembers" while it runs.
// Other files import these objects and change them (for example state.timeLeft--).

import { loadAllData, getDateKey } from './storage.js';
import { SECONDS_PER_MINUTE } from './config.js';

const data = loadAllData();

export const settings = data.settings;     // focus/short/long minutes, autoStart, theme, task
export const stats = data.stats;           // { "2026-11-15": 3 }
export const sessionLog = data.log;        // every finished focus session

export const state = {
  mode: 'focus',                                          // 'focus' | 'short' | 'long'
  timeLeft: settings.focus * SECONDS_PER_MINUTE,          // seconds remaining
  sessionsCompleted: stats[getDateKey()] || 0,            // today's count, survives refresh
  timerId: null,
  endTime: 0,                                             // real clock time (ms) when the timer should hit 0
};
