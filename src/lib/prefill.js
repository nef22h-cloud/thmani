// تحويل نتائج المسح/OCR إلى حقول نموذج الضمان

export function zatcaToPrefill(inv) {
  const p = {
    storeName: inv.sellerName,
    vatNumber: inv.vatNumber,
    purchaseDate: inv.date,
    invoiceTime: inv.time,
  };
  if (inv.total != null) p.price = inv.total;
  if (inv.vatAmount != null) p.vatAmount = inv.vatAmount;
  return clean(p);
}

export function ocrToPrefill(r) {
  return clean({
    storeName: r.storeName,
    purchaseDate: r.purchaseDate,
    price: r.total,
    vatNumber: r.vatNumber,
    storePhone: r.phone,
  });
}

/** يدمج: بيانات QR (دقيقة) تغلب على OCR (تخمين) */
export const mergePrefill = (ocr, qr) => ({ ...ocr, ...qr });

function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null && v !== ''));
}
