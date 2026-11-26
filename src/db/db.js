// قاعدة البيانات المحلية (IndexedDB عبر Dexie)
//
// ملاحظة للمزامنة السحابية لاحقاً: كل سجل فيه syncId (UUID) و updatedAt،
// والحذف يُسجَّل في جدول deletions. هذا يكفي لبناء مزامنة "آخر تعديل يفوز".

import Dexie from 'dexie';

export const db = new Dexie('damani');

db.version(1).stores({
  // الحقول المذكورة هنا هي الفهارس فقط؛ باقي الحقول تنحفظ عادي
  warranties: '++id, &syncId, productName, storeName, category, purchaseDate, expiryDate, returnDeadline, updatedAt',
  images: '++id, &syncId, warrantyId, kind',
  settings: 'key',
  sentReminders: 'id, sentAt',
  deletions: '++id, table, syncId, deletedAt',
});

export const uuid = () =>
  globalThis.crypto?.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
