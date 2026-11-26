// طبقة الوصول للبيانات. كل الشاشات تتعامل مع هذه الدوال فقط وليس مع Dexie
// مباشرة، عشان لما نضيف مزامنة سحابية نعدّل هنا بس.

import { db, uuid } from './db.js';
import { normalizeWarranty } from '../lib/warranty.js';

const now = () => new Date().toISOString();

export async function listWarranties() {
  return db.warranties.toArray();
}

export async function getWarranty(id) {
  return db.warranties.get(Number(id));
}

/**
 * يحفظ ضمان جديد أو يعدّل موجود.
 * images: { added: [{kind, blob}], removedIds: [id] }
 */
export async function saveWarranty(input, images = { added: [], removedIds: [] }) {
  const data = normalizeWarranty(input);
  return db.transaction('rw', db.warranties, db.images, db.deletions, async () => {
    let id = data.id;
    if (id) {
      const existing = await db.warranties.get(id);
      await db.warranties.put({ ...existing, ...data, updatedAt: now() });
    } else {
      delete data.id;
      id = await db.warranties.add({ ...data, syncId: uuid(), claimed: false, createdAt: now(), updatedAt: now() });
    }
    for (const img of images.added ?? []) {
      await db.images.add({ warrantyId: id, kind: img.kind, blob: img.blob, syncId: uuid(), createdAt: now() });
    }
    for (const imgId of images.removedIds ?? []) {
      const img = await db.images.get(imgId);
      if (img) {
        await db.images.delete(imgId);
        await db.deletions.add({ table: 'images', syncId: img.syncId, deletedAt: now() });
      }
    }
    return id;
  });
}

export async function deleteWarranty(id) {
  id = Number(id);
  return db.transaction('rw', db.warranties, db.images, db.deletions, async () => {
    const w = await db.warranties.get(id);
    if (!w) return;
    const imgs = await db.images.where('warrantyId').equals(id).toArray();
    await db.images.bulkDelete(imgs.map((i) => i.id));
    await db.warranties.delete(id);
    await db.deletions.bulkAdd([
      { table: 'warranties', syncId: w.syncId, deletedAt: now() },
      ...imgs.map((i) => ({ table: 'images', syncId: i.syncId, deletedAt: now() })),
    ]);
  });
}

export async function getImages(warrantyId) {
  return db.images.where('warrantyId').equals(Number(warrantyId)).toArray();
}
