// تحويل نتائج المسح/OCR إلى حقول نموذج الضمان

export function zatcaToPrefill(inv) {
  const p = {
    storeName: cleanSellerName(inv.sellerName),
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
    storeName: cleanSellerName(r.storeName),
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

/** يشيل الصفة القانونية من اسم البائع: "شركة حلول نون ... شركة شخص واحد" → "شركة حلول نون ..." */
export function cleanSellerName(name) {
  if (!name) return name;
  const out = name
    .replace(/[\s\-–(]*(شركة\s+)?(شخص\s+واحد|ذات\s+(ال)?مسؤولية\s+(ال)?محدودة|ذ\.?\s*م\.?\s*م|ش\.?\s*م\.?\s*م|مساهمة(\s+مقفلة|\s+عامة)?|توصية\s+بسيطة|(ال)?مختلطة)\)?\s*$/u, '')
    .replace(/\s+شركة(\s+\S{1,3})?$/u, '') // بقايا مقطوعة: "... شركة ش"
    .replace(/[\s,،\-–]+$/u, '')
    .trim();
  return out.length >= 2 ? out : name;
}

/** يدمج: بيانات QR (دقيقة) تغلب على OCR (تخمين) */
export const mergePrefill = (ocr, qr) => ({ ...ocr, ...qr });

function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null && v !== ''));
}
