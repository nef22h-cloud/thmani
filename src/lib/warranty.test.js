import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeExpiryDate, computeReturnDeadline, getStatus, normalizeWarranty, urgencyLevel, remainingRatio } from './warranty.js';
import { dueReminders } from './reminders.js';
import { daysLabel, durationLabel, parseDate } from './dates.js';

test('تاريخ انتهاء الضمان', () => {
  assert.equal(computeExpiryDate('2026-01-15', 12), '2027-01-14');
  assert.equal(computeExpiryDate('2026-01-31', 1), '2026-02-27');
  assert.equal(computeExpiryDate('2026-01-15', 0), null);
});

test('مدة الاسترجاع', () => {
  assert.equal(computeReturnDeadline('2026-11-20', 7), '2026-11-27');
  assert.equal(computeReturnDeadline('2026-11-20', 0), null);
});

test('الحالة', () => {
  const now = parseDate('2026-11-26');
  const base = { purchaseDate: '2025-12-01' };
  assert.equal(getStatus({ ...base, expiryDate: '2027-06-01' }, { now }), 'active');
  assert.equal(getStatus({ ...base, expiryDate: '2026-12-10' }, { now }), 'expiring');
  assert.equal(getStatus({ ...base, expiryDate: '2026-11-25' }, { now }), 'expired');
  assert.equal(getStatus({ ...base, expiryDate: '2027-06-01', claimed: true }, { now }), 'claimed');
});

test('normalizeWarranty بالسنين', () => {
  const w = normalizeWarranty({ purchaseDate: '2026-03-01', warrantyValue: '2', warrantyUnit: 'years', returnDays: '7', price: '1500' });
  assert.equal(w.warrantyMonths, 24);
  assert.equal(w.expiryDate, '2028-02-29');
  assert.equal(w.returnDeadline, '2026-03-08');
  assert.equal(w.price, 1500);
});

test('اللون والنسبة', () => {
  assert.equal(urgencyLevel(100), 'green');
  assert.equal(urgencyLevel(20), 'yellow');
  assert.equal(urgencyLevel(3), 'red');
  const r = remainingRatio({ purchaseDate: '2026-01-01', expiryDate: '2026-12-31' }, parseDate('2026-07-02'));
  assert.ok(r > 0.49 && r < 0.51);
});

test('التنبيهات: حد واحد فقط ولا تتكرر', () => {
  const settings = { warrantyReminderDays: [30, 7, 1], returnReminderDays: [1] };
  const w = { id: 5, productName: 'غسالة سامسونج', storeName: 'إكسترا', purchaseDate: '2025-12-01', expiryDate: '2026-12-03' };
  const now = parseDate('2026-11-26'); // باقي 7 أيام
  const r = dueReminders([w], settings, [], now);
  assert.equal(r.length, 1);
  assert.equal(r[0].daysLeft, 7);
  assert.match(r[0].body, /ينتهي بعد 7 أيام/);
  assert.equal(r[0].coveredIds.length, 2); // 7 و 30
  assert.equal(dueReminders([w], settings, r[0].coveredIds, now).length, 0);
  // بعد 6 أيام يجي تنبيه اليوم الأخير
  assert.equal(dueReminders([w], settings, r[0].coveredIds, parseDate('2026-12-02')).length, 1);
});

test('صياغة الأيام والمدد', () => {
  assert.equal(daysLabel(1), 'يوم واحد');
  assert.equal(daysLabel(2), 'يومين');
  assert.equal(daysLabel(5), '5 أيام');
  assert.equal(daysLabel(45), '45 يوم');
  assert.equal(durationLabel(24), 'سنتين');
  assert.equal(durationLabel(6), '6 شهور');
});
