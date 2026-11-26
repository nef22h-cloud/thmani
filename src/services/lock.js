import { db } from '../db/db.js';
import { loadSettings, updateSettings } from '../db/settingsRepo.js';
import { createPinRecord } from '../lib/pin.js';

export async function enableLock(pin, { credentialId = null, timeoutMin = 0 } = {}) {
  const rec = await createPinRecord(pin);
  await updateSettings({ lock: { enabled: true, ...rec, credentialId, timeoutMin } });
}

export async function changePin(pin) {
  const { lock } = await loadSettings();
  await updateSettings({ lock: { ...lock, ...(await createPinRecord(pin)) } });
}

export async function updateLock(patch) {
  const { lock } = await loadSettings();
  await updateSettings({ lock: { ...lock, ...patch } });
}

export async function disableLock() {
  await updateSettings({ lock: null });
}

/** مسح كل بيانات التطبيق في هذا الجهاز (لما ينسى الرمز) */
export async function resetAllData() {
  db.close();
  await db.delete();
  try {
    localStorage.clear();
  } catch {
    /* */
  }
  location.replace(import.meta.env.BASE_URL);
}
