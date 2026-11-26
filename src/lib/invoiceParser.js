// استخراج البيانات من نص الفاتورة (ناتج OCR). الفواتير تختلف كثيراً، فالهدف
// "أفضل تخمين" والمستخدم يراجع ويعدّل قبل الحفظ.

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** يحوّل الأرقام العربية/الفارسية لأرقام لاتينية ويوحّد الفواصل */
export function normalizeDigits(text) {
  return text
    .replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d))
    .replace(/[۰-۹]/g, (d) => FA_DIGITS.indexOf(d))
    .replace(/٫/g, '.')
    .replace(/٬/g, ',')
    .replace(/،/g, ',');
}

const pad = (n) => String(n).padStart(2, '0');

function validDate(y, m, d) {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** يرجع كل التواريخ الميلادية الموجودة في النص بصيغة YYYY-MM-DD */
export function findDates(text) {
  const t = normalizeDigits(text);
  const out = [];
  // 2026-11-20 أو 2026/11/20
  for (const m of t.matchAll(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
    const v = validDate(+m[1], +m[2], +m[3]);
    if (v) out.push({ value: v, index: m.index });
  }
  // 20/11/2026 أو 20-11-2026 (يوم/شهر/سنة — الشائع في السعودية)
  for (const m of t.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/g)) {
    let v = validDate(+m[3], +m[2], +m[1]);
    // لو اليوم > 12 بالخانة الثانية فهو شهر/يوم (صيغة أمريكية)
    if (!v) v = validDate(+m[3], +m[1], +m[2]);
    if (v) out.push({ value: v, index: m.index });
  }
  return out.sort((a, b) => a.index - b.index).map((d) => d.value);
}

/** أفضل تاريخ شراء: أول تاريخ معقول ليس في المستقبل */
export function pickPurchaseDate(text, todayISO) {
  return findDates(text).find((d) => !todayISO || d <= todayISO) ?? null;
}

const TOTAL_KEYWORDS = [
  /الإجمالي\s*(شامل|مع)\s*(الضريبة|ض)/,
  /الاجمالي\s*(شامل|مع)\s*(الضريبة|ض)/,
  /(المبلغ|الصافي|المجموع)\s*(الإجمالي|الاجمالي|المستحق|الكلي)/,
  /grand\s*total/i,
  /total\s*(amount|due|incl|with)/i,
  /net\s*(amount|total)/i,
  /الإجمالي|الاجمالي|المجموع|الصافي|المستحق/,
  /\btotal\b/i,
  /\bamount\b/i,
];

const AMOUNT_RE = /(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g;

function amountsIn(line) {
  return [...line.matchAll(AMOUNT_RE)]
    .map((m) => Number(m[1].replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 10_000_000);
}

/**
 * المبلغ الإجمالي: نبحث عن سطر فيه كلمة "الإجمالي"/Total حسب الأولوية،
 * ونأخذ أكبر مبلغ فيه (أو في السطر اللي بعده لأن OCR أحياناً يفصلهم).
 * لو ما لقينا، نأخذ أكبر مبلغ بفاصلة عشرية في الفاتورة.
 */
export function pickTotal(text) {
  const lines = normalizeDigits(text).split(/\n/).map((l) => l.trim());
  for (const re of TOTAL_KEYWORDS) {
    for (let i = 0; i < lines.length; i++) {
      if (!re.test(lines[i])) continue;
      if (/ضريبة\s*القيمة|vat\s*amount|tax\s*amount|^vat|خصم|discount/i.test(lines[i]) && !/شامل|incl/i.test(lines[i])) continue;
      const nums = amountsIn(lines[i].replace(/\b\d{10,}\b/g, ''));
      if (nums.length) return Math.max(...nums);
      const next = amountsIn((lines[i + 1] ?? '').replace(/\b\d{10,}\b/g, ''));
      if (next.length) return Math.max(...next);
    }
  }
  const decimals = [...normalizeDigits(text).matchAll(/\b\d{1,3}(?:,\d{3})*\.\d{2}\b/g)].map((m) => Number(m[0].replace(/,/g, '')));
  return decimals.length ? Math.max(...decimals) : null;
}

/** الرقم الضريبي (15 رقم يبدأ وينتهي بـ 3) */
export function pickVatNumber(text) {
  const t = normalizeDigits(text).replace(/(\d)\s(?=\d)/g, '$1');
  return t.match(/\b3\d{13}3\b/)?.[0] ?? null;
}

/** رقم الجوال/الهاتف السعودي */
export function pickPhone(text) {
  const t = normalizeDigits(text);
  const m = t.match(/(?:\+?966|0)?5\d{8}\b|\b9200\d{5}\b|\b800\d{7}\b|\b01\d{7}\b/);
  return m?.[0] ?? null;
}

const STORE_STOPWORDS = /فاتورة|ضريبية|مبسطة|tax|invoice|simplified|receipt|إيصال|الرقم|رقم|vat|cr\b|سجل|تاريخ|date|tel|هاتف|جوال|www|http|@|\d{4,}/i;

/** اسم المتجر: عادةً من أول الأسطر، أول سطر "نصي" ليس عنوان الفاتورة */
export function pickStoreName(text) {
  const lines = text.split(/\n/).map((l) => l.replace(/[|*_=~#]+/g, ' ').replace(/\s+/g, ' ').trim());
  for (const line of lines.slice(0, 8)) {
    if (line.length < 2 || line.length > 40) continue;
    if (STORE_STOPWORDS.test(line)) continue;
    const letters = (line.match(/[\p{L}]/gu) ?? []).length;
    if (letters / line.length < 0.6) continue;
    return line;
  }
  return null;
}

/** يستخرج كل الحقول الممكنة من نص الفاتورة */
export function parseInvoiceText(text, todayISO) {
  return {
    storeName: pickStoreName(text),
    purchaseDate: pickPurchaseDate(text, todayISO),
    total: pickTotal(text),
    vatNumber: pickVatNumber(text),
    phone: pickPhone(text),
  };
}
