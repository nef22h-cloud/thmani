// حساب التنبيهات المستحقة. منطق صافٍ يُستخدم من التطبيق ومن الـ Service Worker.

import { daysLabel } from './dates.js';
import { daysUntil } from './warranty.js';

/**
 * يرجع قائمة التنبيهات المستحقة اليوم ولم تُرسل من قبل.
 * كل تنبيه له مفتاح فريد (id) عشان ما يتكرر.
 *
 * المنطق: لكل حد (مثلاً 7 أيام) لو المتبقي <= الحد، نرسل تنبيه هذا الحد
 * مرة وحدة فقط. ولو فات أكثر من حد مرة وحدة (المستخدم ما فتح التطبيق)
 * نرسل الأصغر فقط عشان ما نزعجه بأكثر من رسالة.
 */
export function dueReminders(warranties, settings, sentIds, now) {
  const sent = new Set(sentIds);
  const out = [];

  for (const w of warranties) {
    if (w.claimed) continue;

    pick(w, 'warranty', w.expiryDate, settings.warrantyReminderDays);
    if (w.returnDeadline) pick(w, 'return', w.returnDeadline, settings.returnReminderDays);
  }
  return out;

  function pick(w, type, dateStr, thresholds) {
    const left = daysUntil(dateStr, now);
    if (left === null || left < 0) return;
    const hit = [...(thresholds || [])]
      .map(Number)
      .filter((t) => t >= 0 && left <= t)
      .sort((a, b) => a - b);
    if (!hit.length) return;
    // مفتاح يتضمن تاريخ الانتهاء: لو المستخدم عدّل التاريخ ترجع التنبيهات تشتغل
    const keyFor = (t) => `${w.id}:${type}:${dateStr}:${t}`;
    // أصغر حد وصلنا له هو اللي يهم؛ لو انرسل خلاص ما نعيده
    if (sent.has(keyFor(hit[0]))) return;
    const allKeys = hit.map(keyFor);
    out.push({
      id: keyFor(hit[0]),
      // نعلّم كل الحدود الأكبر كمرسلة أيضاً
      coveredIds: allKeys,
      warrantyId: w.id,
      type,
      daysLeft: left,
      ...buildMessage(w, type, left),
    });
  }
}

export function buildMessage(w, type, left) {
  const name = w.productName || 'المنتج';
  const when = left === 0 ? 'ينتهي اليوم' : `ينتهي بعد ${daysLabel(left)}`;
  if (type === 'return') {
    const whenR = left === 0 ? 'آخر يوم اليوم' : `باقي ${daysLabel(left)}`;
    return {
      title: `مدة استرجاع ${name} قربت تخلص`,
      body: `${whenR} على مدة الاسترجاع/الاستبدال. لو المنتج ما عجبك أو فيه عيب، رجّعه لـ${w.storeName || 'المتجر'} الحين.`,
    };
  }
  return {
    title: `ضمان ${name} ${when}`,
    body: `ضمان ${name} ${when}، لو فيه أي مشكلة راجع ${w.storeName || 'المتجر'} الحين.`,
  };
}
