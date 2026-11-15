// ---------- Settings (minutes) ----------
const settings = {
  focus: 25,
  short: 5,
  long: 15,
  autoStart: false,
  theme: 'dark',   // 'dark' | 'light'
  task: '',        // what you're working on (the task label)
};
const SESSIONS_BEFORE_LONG_BREAK = 4;

const LABELS = {
  focus: 'Focus Time',
  short: 'Short Break',
  long: 'Long Break',
};

// Ring math: the distance around a circle is 2 * pi * radius
const RING_RADIUS = 130;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// ---------- Storage (localStorage) ----------
const SETTINGS_KEY = 'pomodoro-settings';
const STATS_KEY = 'pomodoro-stats';
const LOG_KEY = 'pomodoro-log';

// localStorage only stores text, so we convert with JSON.stringify / JSON.parse
function loadFromStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (e) {
    return fallback;   // storage blocked or data broken: use the default
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // If saving fails, the app still works, it just won't remember
  }
}

// Today's date as "YYYY-MM-DD" using the local time zone
// (toISOString() would use UTC and give the wrong day near midnight)
function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Copy any saved settings over the defaults, then load saved stats
Object.assign(settings, loadFromStorage(SETTINGS_KEY, {}));
const stats = loadFromStorage(STATS_KEY, {});   // e.g. { "2026-11-15": 3 }
const sessionLog = loadFromStorage(LOG_KEY, []);   // e.g. [{ date, time, task, minutes }]

// ---------- State: everything the app "remembers" ----------
const state = {
  mode: 'focus',                    // 'focus' | 'short' | 'long'
  timeLeft: settings.focus * 60,    // seconds remaining
  sessionsCompleted: stats[getDateKey()] || 0,   // today's count, survives refresh
  timerId: null,
  endTime: 0,                       // real clock time (ms) when the timer should hit 0
};

// ---------- render(): update the whole page from state ----------
function render() {
  const minutes = Math.floor(state.timeLeft / 60).toString().padStart(2, '0');
  const seconds = (state.timeLeft % 60).toString().padStart(2, '0');
  const text = `${minutes}:${seconds}`;

  document.getElementById('timer').textContent = text;
  document.getElementById('mode').textContent = LABELS[state.mode];
  document.getElementById('sessions').textContent = `Sessions completed: ${state.sessionsCompleted}`;
  document.title = `${text} - ${LABELS[state.mode]}`;

  // Colors: the body class decides which set of CSS variables applies
  document.body.classList.remove('short', 'long');
  if (state.mode !== 'focus') document.body.classList.add(state.mode);

  // Phase 4.5: light or dark theme
  document.body.classList.toggle('light', settings.theme === 'light');
  document.getElementById('themeButton').textContent = settings.theme === 'light' ? 'Dark mode' : 'Light mode';

  // Phase 4.1: progress ring. dashoffset = how much of the ring is "hidden"
  const totalSeconds = settings[state.mode] * 60;
  const fractionDone = Math.min(1, Math.max(0, 1 - state.timeLeft / totalSeconds));
  document.getElementById('ringProgress').style.strokeDashoffset = RING_CIRCUMFERENCE * fractionDone;
}

function showMessage(text) {
  document.getElementById('message').textContent = text;
}

function playBeep() {
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
function switchMode() {
  setMode(state.mode === 'focus' ? 'short' : 'focus');
}

// ---------- Timer logic ----------
function tick() {
  state.timeLeft = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
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
    saveToStorage(STATS_KEY, stats);

    // Phase 4.4: also log this session with its task label
    sessionLog.push({ date: today, time: Date.now(), task: settings.task, minutes: settings.focus });
    if (sessionLog.length > 500) sessionLog.splice(0, sessionLog.length - 500);   // keep the log from growing forever
    saveToStorage(LOG_KEY, sessionLog);

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

function startTimer(clearMessage = true) {
  if (state.timerId) return;
  if (clearMessage) {
    showMessage('');
    requestNotificationPermission();   // only on a manual start: browsers need a click for this
  }
  state.endTime = Date.now() + state.timeLeft * 1000;
  state.timerId = setInterval(tick, 250);
}

function pauseTimer() {
  if (state.timerId) {
    state.timeLeft = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
    render();
  }
  clearInterval(state.timerId);
  state.timerId = null;
}

function resetTimer() {
  pauseTimer();
  showMessage('');
  state.timeLeft = settings[state.mode] * 60;
  render();
}

// ---------- Notifications (Phase 4.3) ----------
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();   // the browser shows an "Allow?" popup
  }
}

function sendNotification(text) {
  if (!document.hidden) return;   // you're already looking at the page, no need
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification('Pomodoro Timer', { body: text });
  } catch (e) {
    // Some browsers (e.g. mobile Chrome) don't allow this, so skip quietly
  }
}

// ---------- Small actions: toggle, theme, task label ----------
function toggleTimer() {
  if (state.timerId) pauseTimer();
  else startTimer();
}

function toggleTheme() {
  settings.theme = settings.theme === 'light' ? 'dark' : 'light';
  saveToStorage(SETTINGS_KEY, settings);
  render();
}

function saveTask() {
  settings.task = document.getElementById('taskInput').value.trim();
  saveToStorage(SETTINGS_KEY, settings);
}

// ---------- Keyboard shortcuts (Phase 4.2) ----------
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

// ---------- Settings handling ----------
// Reads a number from an input; if it is invalid, keeps the old value
function readMinutes(inputId, oldValue) {
  const value = parseInt(document.getElementById(inputId).value, 10);
  return value >= 1 && value <= 180 ? value : oldValue;
}

function applySettings() {
  settings.focus = readMinutes('focusInput', settings.focus);
  settings.short = readMinutes('shortInput', settings.short);
  settings.long = readMinutes('longInput', settings.long);
  settings.autoStart = document.getElementById('autoStartInput').checked;

  // Show the corrected values back in the boxes
  document.getElementById('focusInput').value = settings.focus;
  document.getElementById('shortInput').value = settings.short;
  document.getElementById('longInput').value = settings.long;

  saveToStorage(SETTINGS_KEY, settings);   // Phase 3.1: remember for next visit

  // If the timer isn't running, update the current countdown to the new length
  if (!state.timerId) {
    state.timeLeft = settings[state.mode] * 60;
    render();
  }
}

// ---------- History view ----------
function renderHistory() {
  const list = document.getElementById('historyList');
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

  document.getElementById('weekTotal').textContent = `Last 7 days: ${weekTotal} sessions`;

  // Today's individual sessions, with their task labels
  const todayList = document.getElementById('todayList');
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

// ---------- Start up ----------
// Put the saved settings into the input boxes
document.getElementById('focusInput').value = settings.focus;
document.getElementById('shortInput').value = settings.short;
document.getElementById('longInput').value = settings.long;
document.getElementById('autoStartInput').checked = settings.autoStart;
document.getElementById('taskInput').value = settings.task;

// Tell the ring how long its full circle is (it starts out "full")
document.getElementById('ringProgress').style.strokeDasharray = RING_CIRCUMFERENCE;

renderHistory();
render();   // draw the page for the first time
