// منطق الضمان: حساب تاريخ الانتهاء، المتبقي، الحالة، ولون شريط التقدم.
// دوال "صافية" بدون أي اعتماد على المتصفح عشان تكون سهلة الاختبار.

import { STATUS } from './constants.js';
import { addDays, addMonths, diffDays, parseDate, toISODate, today as getToday } from './dates.js';

/** مدة الضمان بالشهور من (قيمة + وحدة) */
export function warrantyMonths(value, unit) {
  const v = Number(value) || 0;
  return unit === 'years' ? v * 12 : v;
}

/** تاريخ انتهاء الضمان */
export function computeExpiryDate(purchaseDate, months) {
  const start = parseDate(purchaseDate);
  if (!start || !months) return null;
  // الضمان ينتهي في نهاية اليوم السابق لنفس التاريخ بعد المدة
  return toISODate(addDays(addMonths(start, months), -1));
}

/** تاريخ آخر يوم للاسترجاع/الاستبدال */
export function computeReturnDeadline(purchaseDate, returnDays) {
  const start = parseDate(purchaseDate);
  const days = Number(returnDays) || 0;
  if (!start || days <= 0) return null;
  return toISODate(addDays(start, days));
}

/** الأيام المتبقية حتى تاريخ معيّن (سالب = انتهى) */
export function daysUntil(dateStr, now = getToday()) {
  const d = parseDate(dateStr);
  return d ? diffDays(now, d) : null;
}

/** حالة الضمان */
export function getStatus(w, { expiringThresholdDays = 30, now = getToday() } = {}) {
  if (w.claimed) return STATUS.CLAIMED;
  const left = daysUntil(w.expiryDate, now);
  if (left === null) return STATUS.EXPIRED;
  if (left < 0) return STATUS.EXPIRED;
  if (left <= expiringThresholdDays) return STATUS.EXPIRING;
  return STATUS.ACTIVE;
}

/** نسبة المتبقي من الضمان (1 = جديد، 0 = انتهى) */
export function remainingRatio(w, now = getToday()) {
  const start = parseDate(w.purchaseDate);
  const end = parseDate(w.expiryDate);
  if (!start || !end) return 0;
  const total = diffDays(start, end);
  if (total <= 0) return 0;
  const left = diffDays(now, end);
  return Math.max(0, Math.min(1, left / total));
}

/** مستوى اللون: أخضر ثم أصفر ثم أحمر */
export function urgencyLevel(daysLeft, expiringThresholdDays = 30) {
  if (daysLeft === null || daysLeft <= 7) return 'red';
  if (daysLeft <= expiringThresholdDays) return 'yellow';
  return 'green';
}

/** يجهز بيانات الضمان قبل الحفظ (يحسب الحقول المشتقة) */
export function normalizeWarranty(input) {
  const months = warrantyMonths(input.warrantyValue, input.warrantyUnit);
  return {
    ...input,
    price: input.price === '' || input.price == null ? null : Number(input.price),
    warrantyValue: Number(input.warrantyValue) || 0,
    returnDays: Number(input.returnDays) || 0,
    warrantyMonths: months,
    expiryDate: computeExpiryDate(input.purchaseDate, months),
    returnDeadline: computeReturnDeadline(input.purchaseDate, input.returnDays),
  };
}

/** ترتيب حسب الأقرب انتهاءً: السارية أولاً، ثم المنتهية، ثم المستخدمة في مطالبة */
export function sortByExpiry(list, opts) {
  const rank = { expiring: 0, active: 0, expired: 1, claimed: 2 };
  return [...list].sort((a, b) => {
    const sa = getStatus(a, opts);
    const sb = getStatus(b, opts);
    if (rank[sa] !== rank[sb]) return rank[sa] - rank[sb];
    const da = daysUntil(a.expiryDate) ?? Infinity;
    const db = daysUntil(b.expiryDate) ?? Infinity;
    // المنتهية: الأحدث انتهاءً أولاً
    return sa === 'expired' ? db - da : da - db;
  });
}

/** ملخص الشاشة الرئيسية */
export function summarize(list, opts) {
  let active = 0;
  let expiring = 0;
  let totalValue = 0;
  for (const w of list) {
    const s = getStatus(w, opts);
    if (s === STATUS.ACTIVE || s === STATUS.EXPIRING) {
      active++;
      totalValue += Number(w.price) || 0;
    }
    if (s === STATUS.EXPIRING) expiring++;
  }
  return { active, expiring, totalValue };
}
