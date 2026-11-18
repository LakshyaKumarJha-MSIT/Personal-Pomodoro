// ui.js - everything that draws on the page or talks to the user:
// the display, messages, history list, beep and notifications.

import { settings, state, stats, sessionLog } from './state.js';
import { getDateKey } from './storage.js';
import { LABELS, RING_CIRCUMFERENCE, SECONDS_PER_MINUTE, isDev } from './config.js';

const $ = (id) => document.getElementById(id);

// ---------- render(): update the whole page from state ----------
export function render() {
  const minutes = Math.floor(state.timeLeft / 60).toString().padStart(2, '0');
  const seconds = (state.timeLeft % 60).toString().padStart(2, '0');
  const text = `${minutes}:${seconds}`;

  $('timer').textContent = text;
  $('mode').textContent = LABELS[state.mode];
  $('sessions').textContent = `Sessions completed: ${state.sessionsCompleted}`;
  document.title = `${isDev ? '[DEV] ' : ''}${text} - ${LABELS[state.mode]}`;

  // Colors: the body class decides which set of CSS variables applies
  document.body.classList.remove('short', 'long');
  if (state.mode !== 'focus') document.body.classList.add(state.mode);

  // Light or dark theme
  document.body.classList.toggle('light', settings.theme === 'light');
  $('themeButton').textContent = settings.theme === 'light' ? 'Dark mode' : 'Light mode';

  // Progress ring. dashoffset = how much of the ring is "hidden"
  const totalSeconds = settings[state.mode] * SECONDS_PER_MINUTE;
  const fractionDone = Math.min(1, Math.max(0, 1 - state.timeLeft / totalSeconds));
  $('ringProgress').style.strokeDashoffset = RING_CIRCUMFERENCE * fractionDone;
}

// ---------- Messages ----------
export function showMessage(text) {
  $('message').textContent = text;
}

// A separate message line for backup and saving news, so a timer message
// can't wipe it out
export function showDataMessage(text) {
  $('dataMessage').textContent = text;
}

// Call this with the result of a save. If saving failed, tell the user.
export function checkSaved(ok) {
  if (!ok) {
    showDataMessage("Couldn't save to this browser (storage may be full or blocked). Export a backup so you don't lose your data.");
  }
}

// A message that survives a page reload (used after importing a backup)
const FLASH_KEY = 'pomodoro-flash';

export function showAfterReload(text) {
  try {
    sessionStorage.setItem(FLASH_KEY, text);
  } catch (e) {
    // Not important enough to fail over
  }
}

function showFlashMessage() {
  try {
    const text = sessionStorage.getItem(FLASH_KEY);
    if (text) {
      sessionStorage.removeItem(FLASH_KEY);
      showDataMessage(text);
    }
  } catch (e) {
    // Ignore
  }
}

// ---------- Sound ----------
export function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.2;
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    // If the browser blocks sound, just skip it
  }
}

// ---------- Notifications ----------
export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();   // the browser shows an "Allow?" popup
  }
}

export function sendNotification(text) {
  if (!document.hidden) return;   // you're already looking at the page, no need
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification('Pomodoro Timer', { body: text });
  } catch (e) {
    // Some browsers (e.g. mobile Chrome) don't allow this, so skip quietly
  }
}

// ---------- History view ----------
export function renderHistory() {
  const list = $('historyList');
  list.innerHTML = '';
  let weekTotal = 0;

  // Go back 7 days, starting from today
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const count = stats[getDateKey(date)] || 0;
    weekTotal += count;

    const label = i === 0
      ? 'Today'
      : date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

    const row = document.createElement('div');
    row.textContent = `${label}: ${count}`;
    list.appendChild(row);
  }

  $('weekTotal').textContent = `Last 7 days: ${weekTotal} sessions`;

  // Today's individual sessions, with their task labels
  const todayList = $('todayList');
  todayList.innerHTML = '';
  const todaySessions = sessionLog.filter((entry) => entry.date === getDateKey());

  if (todaySessions.length === 0) {
    todayList.textContent = 'No sessions yet today';
  }
  for (const entry of todaySessions) {
    const time = new Date(entry.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const row = document.createElement('div');
    row.textContent = `${time} - ${entry.task || '(no label)'} (${entry.minutes} min)`;
    todayList.appendChild(row);
  }
}

// ---------- First draw ----------
export function initUI() {
  // Put the saved settings into the input boxes
  $('focusInput').value = settings.focus;
  $('shortInput').value = settings.short;
  $('longInput').value = settings.long;
  $('autoStartInput').checked = settings.autoStart;
  $('taskInput').value = settings.task;

  // Tell the ring how long its full circle is (it starts out "full")
  $('ringProgress').style.strokeDasharray = RING_CIRCUMFERENCE;

  $('devBanner').hidden = !isDev;

  renderHistory();
  render();
  showFlashMessage();
}
