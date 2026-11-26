import { db } from './db.js';
import { DEFAULT_SETTINGS } from '../lib/constants.js';

const KEY = 'app';

export async function loadSettings() {
  const row = await db.settings.get(KEY);
  return { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) };
}

export async function updateSettings(patch) {
  const current = await loadSettings();
  const next = { ...current, ...patch };
  await db.settings.put({ key: KEY, value: next });
  return next;
}
