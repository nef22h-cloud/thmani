// صيغة ملف النسخة الاحتياطية ومنطق الدمج (بدون أي اعتماد على المتصفح عشان نقدر نختبره).
//
// الملف JSON فيه كل الضمانات والصور (base64) والإعدادات:
// { app: 'damani', version: 1, exportedAt, warranties: [...], images: [...], settings }
// الربط بين الصورة والضمان بالـ syncId (مو بالـ id المحلي) عشان يشتغل على أي جهاز.

export const BACKUP_APP = 'damani';
export const BACKUP_VERSION = 1;

/** إعدادات خاصة بالجهاز ما ننقلها لجهاز ثاني */
const DEVICE_SETTINGS = ['notificationsEnabled', 'lastBackupAt', 'backupReminderDismissedAt', 'lock'];

/**
 * يبني كائن النسخة.
 * images: [{ syncId, warrantyId, kind, createdAt, type, data }] (data = base64 بدون بادئة)
 */
export function buildBackup({ warranties, images, claims = [], settings, exportedAt = new Date().toISOString() }) {
  const byId = new Map(warranties.map((w) => [w.id, w.syncId]));
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt,
    warranties: warranties.map(({ id, ...w }) => w),
    images: images
      .filter((img) => byId.has(img.warrantyId))
      .map(({ id, warrantyId, ...img }) => ({ ...img, warrantySyncId: byId.get(warrantyId) })),
    claims: claims
      .filter((c) => byId.has(c.warrantyId))
      .map(({ id, warrantyId, ...c }) => ({ ...c, warrantySyncId: byId.get(warrantyId) })),
    settings: omit(settings ?? {}, DEVICE_SETTINGS),
  };
}

export class BackupError extends Error {}

/** يتحقق من الملف ويرجع النسخة، أو يرمي BackupError برسالة مفهومة */
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('الملف مو نسخة احتياطية صالحة (مو JSON).');
  }
  if (data?.app !== BACKUP_APP) throw new BackupError('هذا الملف مو نسخة احتياطية من ضماني.');
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new BackupError('النسخة من إصدار أحدث من التطبيق. حدّث التطبيق وحاول مرة ثانية.');
  }
  if (!Array.isArray(data.warranties) || !Array.isArray(data.images)) throw new BackupError('الملف ناقص أو تالف.');
  // المطالبات انضافت بعد أول إصدار، فالنسخ القديمة ما فيها
  if (data.claims != null && !Array.isArray(data.claims)) throw new BackupError('الملف ناقص أو تالف.');
  data.claims = (data.claims ?? []).filter((c) => c?.syncId && c.warrantySyncId);
  const bad = data.warranties.find((w) => !w?.syncId || !w.productName || !w.purchaseDate);
  if (bad) throw new BackupError('في الملف ضمانات بياناتها ناقصة. الملف ممكن يكون تالف.');
  return data;
}

/** ملخص للعرض قبل الاسترجاع */
export function summarizeBackup(data) {
  return {
    warranties: data.warranties.length,
    images: data.images.length,
    claims: data.claims?.length ?? 0,
    exportedAt: data.exportedAt ?? null,
  };
}

/**
 * يحدد وش نسوي بكل ضمان في وضع الدمج:
 * - جديد (syncId مو موجود) ← نضيفه
 * - موجود والنسخة أحدث (updatedAt) ← نحدّثه
 * - موجود ونسختنا أحدث أو نفسها ← نتركه
 * existing: [{ id, syncId, updatedAt }]
 */
export function planMerge(existing, incoming) {
  const local = new Map(existing.map((w) => [w.syncId, w]));
  const plan = { add: [], update: [], skip: [] };
  for (const w of incoming) {
    const cur = local.get(w.syncId);
    if (!cur) plan.add.push(w);
    else if ((w.updatedAt ?? '') > (cur.updatedAt ?? '')) plan.update.push({ ...w, id: cur.id });
    else plan.skip.push(w);
  }
  return plan;
}

/** الإعدادات بعد الاسترجاع الكامل: نأخذ من النسخة ونحافظ على إعدادات الجهاز */
export function mergeSettings(current, fromBackup) {
  return { ...current, ...omit(fromBackup ?? {}, DEVICE_SETTINGS) };
}

/** هل نذكّر المستخدم ياخذ نسخة؟ (عنده ضمانات ما انحفظت في نسخة، وآخر نسخة قبل 14 يوم أو أكثر) */
export function needsBackupReminder({ count, lastBackupAt, dismissedAt, lastChangeAt }, now = new Date(), days = 14) {
  if (!count) return false;
  const ms = days * 86400000;
  if (dismissedAt && now - new Date(dismissedAt) < 7 * 86400000) return false;
  if (!lastBackupAt) return true;
  // لو ما تغيّر شي بعد آخر نسخة، ما فيه داعي نذكّر
  if (lastChangeAt && lastChangeAt <= lastBackupAt) return false;
  return now - new Date(lastBackupAt) >= ms;
}

export function backupFileName(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `damani-backup-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.json`;
}

function omit(obj, keys) {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
}
