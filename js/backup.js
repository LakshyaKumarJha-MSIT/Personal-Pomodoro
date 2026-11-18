// backup.js - export your data to a file, and import it back.

import { settings, stats, sessionLog } from './state.js';
import { buildBackup, parseBackup, replaceAllData, getDateKey } from './storage.js';
import { showDataMessage, showAfterReload } from './ui.js';

const MAX_FILE_BYTES = 10 * 1024 * 1024;   // a real backup is tiny; refuse huge files

function countSessions(data) {
  return Object.values(data.stats).reduce((sum, n) => sum + n, 0);
}

export function exportBackup() {
  const backup = buildBackup(settings, stats, sessionLog);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // The trick for downloading from JS: click an invisible link
  const link = document.createElement('a');
  link.href = url;
  link.download = `pomodoro-backup-${getDateKey()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  showDataMessage(`Backup downloaded (${countSessions({ stats })} sessions).`);
}

export async function importBackup(file) {
  if (!file) return;
  if (file.size > MAX_FILE_BYTES) {
    showDataMessage('That file is too large to be a backup.');
    return;
  }

  const result = parseBackup(await file.text());
  if (!result.ok) {
    showDataMessage(result.error);
    return;
  }

  const { data } = result;
  const sessions = countSessions(data);
  const confirmed = confirm(
    `Replace your current settings, stats and history with this backup?\n\n` +
    `The backup has ${sessions} sessions across ${Object.keys(data.stats).length} days.\n` +
    `This can't be undone, so export your current data first if you want to keep it.`
  );
  if (!confirmed) {
    showDataMessage('Import cancelled. Nothing was changed.');
    return;
  }

  if (!replaceAllData(data)) {
    showDataMessage("Couldn't save the imported data (storage may be full or blocked).");
    return;
  }

  // Reload so the whole app starts fresh from the imported data
  showAfterReload(`Backup imported (${sessions} sessions).`);
  location.reload();
}