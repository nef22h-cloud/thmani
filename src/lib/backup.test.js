import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, parseBackup, planMerge, mergeSettings, needsBackupReminder, BackupError, backupFileName } from './backup.js';

const w1 = { id: 1, syncId: 'a', productName: 'غسالة', purchaseDate: '2026-01-01', updatedAt: '2026-01-05T00:00:00Z' };
const w2 = { id: 2, syncId: 'b', productName: 'شاشة', purchaseDate: '2026-02-01', updatedAt: '2026-02-05T00:00:00Z' };

test('النسخة: بدون ids محلية، الصور مربوطة بالـ syncId، وبدون إعدادات الجهاز', () => {
  const b = buildBackup({
    warranties: [w1, w2],
    images: [{ id: 9, syncId: 'i1', warrantyId: 2, kind: 'invoice', type: 'image/jpeg', data: 'AAA' }, { id: 10, syncId: 'orphan', warrantyId: 99, kind: 'product', data: 'BBB' }],
    settings: { theme: 'dark', notificationsEnabled: true, lastBackupAt: 'x' },
    exportedAt: '2026-11-26T10:00:00Z',
  });
  assert.equal(b.app, 'damani');
  assert.equal(b.warranties[0].id, undefined);
  assert.deepEqual(b.images, [{ syncId: 'i1', kind: 'invoice', type: 'image/jpeg', data: 'AAA', warrantySyncId: 'b' }]);
  assert.deepEqual(b.settings, { theme: 'dark' });
  // ذهاب وإياب
  assert.equal(parseBackup(JSON.stringify(b)).warranties.length, 2);
});

test('النسخة: رفض الملفات الغلط برسائل مفهومة', () => {
  assert.throws(() => parseBackup('not json'), BackupError);
  assert.throws(() => parseBackup('{"app":"other"}'), /مو نسخة احتياطية من ضماني/);
  assert.throws(() => parseBackup('{"app":"damani","version":99,"warranties":[],"images":[]}'), /إصدار أحدث/);
  assert.throws(() => parseBackup('{"app":"damani","version":1,"warranties":[{"syncId":"x"}],"images":[]}'), /ناقصة/);
});

test('الدمج: نضيف الجديد ونحدّث الأحدث ونترك القديم', () => {
  const existing = [{ id: 7, syncId: 'a', updatedAt: '2026-01-10T00:00:00Z' }, { id: 8, syncId: 'b', updatedAt: '2026-01-01T00:00:00Z' }];
  const incoming = [w1, w2, { syncId: 'c', productName: 'x', purchaseDate: '2026-03-01', updatedAt: '2026-03-01' }];
  const p = planMerge(existing, incoming);
  assert.deepEqual(p.add.map((w) => w.syncId), ['c']);
  assert.deepEqual(p.update.map((w) => [w.syncId, w.id]), [['b', 8]]);
  assert.deepEqual(p.skip.map((w) => w.syncId), ['a']);
});

test('الإعدادات: الاسترجاع ما يغيّر إعدادات الجهاز', () => {
  assert.deepEqual(mergeSettings({ theme: 'light', notificationsEnabled: true, lastBackupAt: 'L' }, { theme: 'dark', notificationsEnabled: false }), { theme: 'dark', notificationsEnabled: true, lastBackupAt: 'L' });
});

test('تذكير النسخة', () => {
  const now = new Date('2026-11-26T12:00:00Z');
  assert.equal(needsBackupReminder({ count: 0 }, now), false);
  assert.equal(needsBackupReminder({ count: 2 }, now), true);
  assert.equal(needsBackupReminder({ count: 2, dismissedAt: '2026-11-24T00:00:00Z' }, now), false);
  assert.equal(needsBackupReminder({ count: 2, lastBackupAt: '2026-10-01T00:00:00Z', lastChangeAt: '2026-09-01T00:00:00Z' }, now), false);
  assert.equal(needsBackupReminder({ count: 2, lastBackupAt: '2026-10-01T00:00:00Z', lastChangeAt: '2026-10-05T00:00:00Z' }, now), true);
  assert.equal(needsBackupReminder({ count: 2, lastBackupAt: '2026-11-20T00:00:00Z', lastChangeAt: '2026-11-25T00:00:00Z' }, now), false);
  assert.equal(backupFileName(new Date(2026, 10, 5)), 'damani-backup-2026-11-05.json');
});
