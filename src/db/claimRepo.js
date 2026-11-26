import { db, uuid } from './db.js';
import { normalizeClaim } from '../lib/claims.js';

const now = () => new Date().toISOString();

export const listClaims = () => db.claims.toArray();
export const listClaimsFor = (warrantyId) => db.claims.where('warrantyId').equals(Number(warrantyId)).toArray();
export const getClaim = (id) => db.claims.get(Number(id));

/**
 * يحفظ المطالبة. markWarrantyUsed (true/false/undefined) يغيّر حالة الضمان "تم استخدامه في مطالبة"
 * في نفس المعاملة.
 */
export async function saveClaim(input, { markWarrantyUsed } = {}) {
  const data = normalizeClaim(input);
  return db.transaction('rw', db.claims, db.warranties, async () => {
    let id = data.id;
    if (id) {
      const existing = await db.claims.get(id);
      await db.claims.put({ ...existing, ...data, updatedAt: now() });
    } else {
      id = await db.claims.add({ ...data, syncId: uuid(), createdAt: now(), updatedAt: now() });
    }
    if (typeof markWarrantyUsed === 'boolean') {
      const w = await db.warranties.get(data.warrantyId);
      if (w && Boolean(w.claimed) !== markWarrantyUsed) await db.warranties.put({ ...w, claimed: markWarrantyUsed, updatedAt: now() });
    }
    return id;
  });
}

export async function deleteClaim(id) {
  return db.transaction('rw', db.claims, db.deletions, async () => {
    const c = await db.claims.get(Number(id));
    if (!c) return;
    await db.claims.delete(c.id);
    await db.deletions.add({ table: 'claims', syncId: c.syncId, deletedAt: now() });
  });
}
