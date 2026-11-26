// تصدير واسترجاع النسخة الاحتياطية (ملف JSON فيه كل شي، يشمل الصور).

import { db, uuid } from '../db/db.js';
import { loadSettings, updateSettings } from '../db/settingsRepo.js';
import { shareOrDownload } from './share.js';
import { backupFileName, buildBackup, mergeSettings, parseBackup, planMerge, summarizeBackup } from '../lib/backup.js';

const now = () => new Date().toISOString();

/** يجهّز ملف النسخة. يرجع { file, summary } */
export async function createBackupFile() {
  const [warranties, images, claims, settings] = await Promise.all([db.warranties.toArray(), db.images.toArray(), db.claims.toArray(), loadSettings()]);
  const encoded = await Promise.all(
    images.map(async (img) => ({
      syncId: img.syncId,
      warrantyId: img.warrantyId,
      kind: img.kind,
      createdAt: img.createdAt,
      type: img.blob?.type || 'image/jpeg',
      data: img.blob ? await blobToBase64(img.blob) : '',
    }))
  );
  const backup = buildBackup({ warranties, images: encoded.filter((i) => i.data), claims, settings });
  const name = backupFileName();
  const file = new File([JSON.stringify(backup)], name, { type: 'application/json' });
  return { file, summary: summarizeBackup(backup) };
}

/** يحفظ الملف: قائمة المشاركة على الجوال (الملفات / iCloud ...) أو تحميل عادي */
export const saveBackupFile = (file) => shareOrDownload(file, { title: 'نسخة احتياطية - ضماني' });

export async function markBackupDone() {
  await updateSettings({ lastBackupAt: now(), backupReminderDismissedAt: null });
}

/** يقرأ ملف ويتحقق منه. يرجع { data, summary } أو يرمي BackupError */
export async function readBackupFile(file) {
  const data = parseBackup(await file.text());
  return { data, summary: summarizeBackup(data) };
}

/**
 * يسترجع النسخة.
 * mode: 'merge' يضيف الجديد ويحدّث الأحدث ويحافظ على اللي عندك،
 *       'replace' يمسح كل شي ويحط محتوى النسخة.
 * يرجع { added, updated, skipped, images }
 */
export async function restoreBackup(data, mode = 'merge') {
  // نفك الصور قبل المعاملة (عمليات async خارج IndexedDB تقفل المعاملة)
  const images = data.images
    .filter((img) => img?.data && img.warrantySyncId)
    .map((img) => ({ ...img, blob: base64ToBlob(img.data, img.type) }));

  const result = await db.transaction('rw', db.warranties, db.images, db.claims, db.sentReminders, db.deletions, async () => {
    if (mode === 'replace') {
      await Promise.all([db.warranties.clear(), db.images.clear(), db.claims.clear(), db.sentReminders.clear(), db.deletions.clear()]);
    }
    const existing = await db.warranties.toArray();
    const plan = planMerge(existing, data.warranties);
    const idBySync = new Map(existing.map((w) => [w.syncId, w.id]));

    for (const w of plan.add) {
      const { id, ...rest } = w;
      idBySync.set(w.syncId, await db.warranties.add({ ...rest, createdAt: w.createdAt ?? now(), updatedAt: w.updatedAt ?? now() }));
    }
    for (const w of plan.update) await db.warranties.put(w);

    // الصور: نضيف اللي مو موجود (بالـ syncId) ونربطها بالـ id المحلي للضمان
    const haveImages = new Set((await db.images.toArray()).map((i) => i.syncId));
    let addedImages = 0;
    for (const img of images) {
      const warrantyId = idBySync.get(img.warrantySyncId);
      if (!warrantyId || haveImages.has(img.syncId)) continue;
      await db.images.add({ warrantyId, kind: img.kind, blob: img.blob, syncId: img.syncId || uuid(), createdAt: img.createdAt ?? now() });
      addedImages++;
    }
    // المطالبات: نفس منطق الضمانات (الجديد ينضاف، والأحدث يحدّث)
    const existingClaims = await db.claims.toArray();
    const claimPlan = planMerge(existingClaims, data.claims ?? []);
    let claimsChanged = 0;
    for (const c of [...claimPlan.add, ...claimPlan.update]) {
      const warrantyId = idBySync.get(c.warrantySyncId);
      if (!warrantyId) continue;
      const { warrantySyncId, ...rest } = c;
      await db.claims.put({ ...rest, warrantyId });
      claimsChanged++;
    }
    return { added: plan.add.length, updated: plan.update.length, skipped: plan.skip.length, images: addedImages, claims: claimsChanged };
  });

  if (mode === 'replace' && data.settings) {
    await updateSettings(mergeSettings(await loadSettings(), data.settings));
  }
  return result;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(b64, type = 'image/jpeg') {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
