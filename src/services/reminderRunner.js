// يفحص التنبيهات المستحقة ويرسلها. يشتغل من التطبيق (عند الفتح) ومن
// الـ Service Worker (Periodic Background Sync) بنفس الكود.

import { db } from '../db/db.js';
import { loadSettings } from '../db/settingsRepo.js';
import { dueReminders } from '../lib/reminders.js';
import { today } from '../lib/dates.js';

const BASE = import.meta.env.BASE_URL;

/** show: (title, options) => Promise — عادة registration.showNotification */
export async function runReminders(show) {
  const settings = await loadSettings();
  if (!settings.notificationsEnabled) return [];

  const [warranties, sent] = await Promise.all([
    db.warranties.toArray(),
    db.sentReminders.toCollection().primaryKeys(),
  ]);
  const due = dueReminders(warranties, settings, sent, today());

  for (const r of due) {
    await show(r.title, {
      body: r.body,
      tag: r.id,
      dir: 'rtl',
      lang: 'ar',
      icon: `${BASE}icons/icon-192.png`,
      badge: `${BASE}icons/icon-192.png`,
      data: { url: `${BASE}w/${r.warrantyId}` },
    });
    const sentAt = new Date().toISOString();
    await db.sentReminders.bulkPut(r.coveredIds.map((id) => ({ id, sentAt })));
  }
  return due;
}
