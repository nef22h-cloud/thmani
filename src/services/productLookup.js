// محاولة جلب اسم المنتج من رقم الباركود عبر قواعد بيانات مفتوحة.
// (Open Products Facts للمنتجات العامة، Open Food Facts للأغذية). تغطيتها للأجهزة الإلكترونية محدودة، فلو ما لقينا نخلي المستخدم يكتب الاسم.
// نرسل رقم الباركود فقط (بدون أي بيانات شخصية).

const SOURCES = [
  async (code, signal) => {
    const r = await fetch(`https://world.openproductsfacts.org/api/v2/product/${code}.json?fields=product_name,brands`, { signal });
    const j = await r.json();
    return j.status === 1 ? pickName(j.product) : null;
  },
  async (code, signal) => {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_ar,brands`, { signal });
    const j = await r.json();
    return j.status === 1 ? pickName(j.product) : null;
  },
];

function pickName(p) {
  const name = p?.product_name_ar || p?.product_name;
  return name ? { name, brand: p.brands?.split(',')[0]?.trim() } : null;
}

/** يرجع { name, brand } أو null. ما يرمي أخطاء. */
export async function lookupProduct(code, { timeoutMs = 6000 } = {}) {
  if (!/^\d{8,14}$/.test(code) || !navigator.onLine) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // نجرب كل المصادر بالتوازي ونأخذ أول نتيجة
    return await Promise.any(
      SOURCES.map((src) =>
        src(code, ctrl.signal).then((r) => {
          if (!r?.name) throw new Error('not found');
          return r;
        })
      )
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    ctrl.abort();
  }
}

/** اسم العرض: "سامسونج - غسالة ..." بدون تكرار العلامة */
export function productDisplayName({ name, brand }) {
  if (!brand || name.toLowerCase().includes(brand.toLowerCase())) return name;
  return `${brand} ${name}`;
}
