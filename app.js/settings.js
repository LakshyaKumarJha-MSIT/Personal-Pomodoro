// settings.js - reading the settings boxes, the theme button and the task label.

import { settings, state } from './state.js';
import { saveSettings } from './storage.js';
import { MIN_MINUTES, MAX_MINUTES, SECONDS_PER_MINUTE } from './config.js';
import { render, checkSaved } from './ui.js';

const $ = (id) => document.getElementById(id);

// Reads a number from an input; if it is invalid, keeps the old value
function readMinutes(inputId, oldValue) {
  const value = parseInt($(inputId).value, 10);
  return value >= MIN_MINUTES && value <= MAX_MINUTES ? value : oldValue;
}

export function applySettings() {
  settings.focus = readMinutes('focusInput', settings.focus);
  settings.short = readMinutes('shortInput', settings.short);
  settings.long = readMinutes('longInput', settings.long);
  settings.autoStart = $('autoStartInput').checked;

  // Show the corrected values back in the boxes
  $('focusInput').value = settings.focus;
  $('shortInput').value = settings.short;
  $('longInput').value = settings.long;

  checkSaved(saveSettings(settings));

  // If the timer isn't running, update the current countdown to the new length
  if (!state.timerId) {
    state.timeLeft = settings[state.mode] * SECONDS_PER_MINUTE;
    render();
  }
}

export function toggleTheme() {
  settings.theme = settings.theme === 'light' ? 'dark' : 'light';
  checkSaved(saveSettings(settings));
  render();
}

export function saveTask() {
  settings.task = $('taskInput').value.trim();
  checkSaved(saveSettings(settings));
}
