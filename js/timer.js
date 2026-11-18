// timer.js - the countdown logic: start, pause, reset, modes, finishing a session.

import { settings, state, stats, sessionLog } from './state.js';
import { getDateKey, saveStats, saveLog } from './storage.js';
import { SECONDS_PER_MINUTE, SESSIONS_BEFORE_LONG_BREAK } from './config.js';
import {
  render, renderHistory, showMessage, checkSaved, playBeep,
  sendNotification, requestNotificationPermission,
} from './ui.js';

// ---------- Modes ----------
function setMode(mode) {
  state.mode = mode;
  resetTimer();
}

// Used when a session ends by itself: decides short vs long break
function getNextMode() {
  if (state.mode !== 'focus') return 'focus';
  const isLongBreakDue = state.sessionsCompleted % SESSIONS_BEFORE_LONG_BREAK === 0;
  return isLongBreakDue ? 'long' : 'short';
}

// Used by the button: focus -> short break, any break -> focus
// (skipping a focus session does not count as completed)
export function switchMode() {
  setMode(state.mode === 'focus' ? 'short' : 'focus');
}

// ---------- Timer logic ----------
// Instead of "subtract 1 per tick", compare against the real clock
function secondsLeft() {
  return Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
}

function tick() {
  state.timeLeft = secondsLeft();
  render();
  if (state.timeLeft === 0) finishSession();
}

function finishSession() {
  pauseTimer();
  const finishedMode = state.mode;

  if (finishedMode === 'focus') {
    const today = getDateKey();
    stats[today] = (stats[today] || 0) + 1;
    state.sessionsCompleted = stats[today];
    const statsSaved = saveStats(stats);

    // Also log this session with its task label. The log is not capped:
    // the stats charts will need the full history.
    sessionLog.push({ date: today, time: Date.now(), task: settings.task, minutes: settings.focus });
    const logSaved = saveLog(sessionLog);

    checkSaved(statsSaved && logSaved);
    renderHistory();
  }

  setMode(getNextMode());   // switch first, because reset clears the message

  let text;
  if (finishedMode === 'focus') {
    const breakType = state.mode === 'long' ? 'long break' : 'break';
    text = `Focus session ${state.sessionsCompleted} complete! Time for a ${breakType}.`;
  } else {
    text = 'Break is over! Back to work.';
  }
  showMessage(text);
  sendNotification(text);
  playBeep();

  if (settings.autoStart) startTimer(false);
}

export function startTimer(clearMessage = true) {
  if (state.timerId) return;
  if (clearMessage) {
    showMessage('');
    requestNotificationPermission();   // only on a manual start: browsers need a click for this
  }
  state.endTime = Date.now() + state.timeLeft * 1000;
  state.timerId = setInterval(tick, 250);
}

export function pauseTimer() {
  if (state.timerId) {
    state.timeLeft = secondsLeft();
    render();
  }
  clearInterval(state.timerId);
  state.timerId = null;
}

export function resetTimer() {
  pauseTimer();
  showMessage('');
  state.timeLeft = settings[state.mode] * SECONDS_PER_MINUTE;
  render();
}

export function toggleTimer() {
  if (state.timerId) pauseTimer();
  else startTimer();
}
