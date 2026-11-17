// main.js - the starting point. It only connects things together:
// buttons and keys on the page -> functions in the other files.

import { initUI } from './ui.js';
import { startTimer, pauseTimer, resetTimer, switchMode, toggleTimer } from './timer.js';
import { applySettings, toggleTheme, saveTask } from './settings.js';
import { exportBackup, importBackup } from './backup.js';

// Short helper: on('startButton', 'click', fn)
function on(id, eventName, handler) {
  document.getElementById(id).addEventListener(eventName, handler);
}

// ---------- Buttons (these replace the old onclick="..." attributes) ----------
// Arrow functions are used so the click event isn't passed in as an argument.
on('startButton', 'click', () => startTimer());
on('pauseButton', 'click', () => pauseTimer());
on('resetButton', 'click', () => resetTimer());
on('switchButton', 'click', () => switchMode());
on('themeButton', 'click', () => toggleTheme());

// ---------- Inputs ----------
on('taskInput', 'input', () => saveTask());
on('focusInput', 'change', () => applySettings());
on('shortInput', 'change', () => applySettings());
on('longInput', 'change', () => applySettings());
on('autoStartInput', 'change', () => applySettings());

// ---------- Backup ----------
on('exportButton', 'click', () => exportBackup());
on('importButton', 'click', () => document.getElementById('importInput').click());
on('importInput', 'change', async (event) => {
  await importBackup(event.target.files[0]);
  event.target.value = '';   // so choosing the same file again still triggers "change"
});

// ---------- Keyboard shortcuts ----------
document.addEventListener('keydown', (event) => {
  const tag = event.target.tagName;
  // Don't steal keys while typing, or from a focused button/checkbox
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
  // Leave browser shortcuts alone (like Ctrl+R to refresh)
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  if (event.code === 'Space') {
    event.preventDefault();   // stops the page from scrolling down
    toggleTimer();
  } else if (event.key.toLowerCase() === 'r') {
    resetTimer();
  } else if (event.key.toLowerCase() === 's') {
    switchMode();
  }
});

// After a mouse click, buttons normally keep keyboard focus, which would make
// Space "click" that button again. This stops buttons from taking focus on click.
document.querySelectorAll('button').forEach((button) => {
  button.addEventListener('mousedown', (event) => event.preventDefault());
});

// ---------- Go! ----------
initUI();
