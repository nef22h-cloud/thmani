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
    productName: r.productName,
    category: r.category,
    storeName: r.storeName,
    storeBranch: r.branch,
    purchaseDate: r.purchaseDate,
    price: r.total,
    vatNumber: r.vatNumber,
    storePhone: r.phone,
    serialNumber: r.serialNumber,
    barcode: r.barcode,
    warrantyValue: r.warranty?.value,
    warrantyUnit: r.warranty?.unit,
    returnDays: r.returnDays,
    notes: r.model ? `الموديل: ${r.model}` : null,
  });
}

/** يدمج: بيانات QR (دقيقة) تغلب على OCR (تخمين) */
export const mergePrefill = (ocr, qr) => ({ ...ocr, ...qr });

function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null && v !== ''));
}
