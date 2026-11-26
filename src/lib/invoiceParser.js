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
    .replace(/،/g, ',')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, ''); // علامات الاتجاه اللي يضيفها OCR
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

/** رقم الجوال/الهاتف السعودي (جوال 05، أرضي 011-017، موحّد 9200، مجاني 800) */
export function pickPhone(text) {
  const t = normalizeDigits(text).replace(/(\d)[\s-](?=\d)/g, '$1');
  const m = t.match(/(?:\+?966|0)5\d{8}(?!\d)|(?<!\d)9200\d{5}(?!\d)|(?<!\d)800\d{7}(?!\d)|(?<!\d)(?:\+?966|0)1[1-7]\d{7}(?!\d)/);
  return m?.[0] ?? null;
}

const STORE_STOPWORDS = /فرع|عنوان|فاتورة|ضريبية|مبسطة|tax|invoice|simplified|receipt|إيصال|الرقم|رقم|vat|cr\b|سجل|تاريخ|date|tel|هاتف|جوال|www|http|@|\d{4,}/i;

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

// ===== بيانات المنتج والضمان =====

const lines = (text) => normalizeDigits(text).split(/\n/).map((l) => l.replace(/[|*_=~#]+/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);

/** القيمة بعد "عنوان:" في سطر يطابق التسمية */
function labeled(text, labelRe) {
  for (const line of lines(text)) {
    const m = line.match(new RegExp(`(?:${labelRe.source})\\s*[:：\\-]?\\s*(.+)$`, 'i'));
    if (m && /[\p{L}\d]/u.test(m[1])) return m[1].trim();
    // أحياناً OCR يقلب ترتيب السطر فتجي القيمة قبل التسمية: "UA55X900 الموديل:"
    const r = line.match(new RegExp(`^(.+?)\\s*(?:${labelRe.source})\\s*[:：]?$`, 'i'));
    if (r && /[\p{L}\d]/u.test(r[1])) return r[1].trim();
  }
  return null;
}

/** الرقم التسلسلي */
export function pickSerial(text) {
  const v = labeled(text, /الرقم\s*التسلسلي|رقم\s*تسلسلي|التسلسلي|serial\s*(?:no\.?|number)?|s\s*\/\s*n|imei/);
  const m = v?.replace(/\s+/g, '').match(/[A-Z0-9][A-Z0-9\-]{4,}/i);
  return m ? m[0].toUpperCase() : null;
}

const NAME_STOP = /الكمية|السعر|المجموع|الإجمالي|الاجمالي|ضريبة|الضريبة|الرقم|رقم|التاريخ|الوقت|هاتف|جوال|الضمان|الاسترجاع|الإرجاع|فاتورة|شكرا|qty|total|vat/i;

/** اسم المنتج: من سطر "المنتج:"، وإلا السطر اللي قبل "الكمية" */
export function pickProductName(text) {
  const v = labeled(text, /اسم\s*المنتج|المنتج|الصنف|البيان|الوصف|item|product|description/);
  if (v && !/^\d/.test(v)) return v.replace(/\s+\d+\s*[x×].*$/i, '').trim();
  const ls = lines(text);
  const qi = ls.findIndex((l) => /الكمية|qty/i.test(l));
  if (qi > 0 && !NAME_STOP.test(ls[qi - 1])) return ls[qi - 1];
  return null;
}

/** الموديل */
export function pickModel(text) {
  const v = labeled(text, /رقم\s*الموديل|الموديل|موديل|model(?:\s*no\.?)?/);
  return v?.match(/[A-Z0-9][A-Z0-9\-\/]{2,}/i)?.[0].toUpperCase() ?? null;
}

/** الفرع / الموقع */
export function pickBranch(text) {
  const v = labeled(text, /الفرع|العنوان|الموقع|branch|address/);
  if (v) return v;
  const l = lines(text).slice(0, 8).find((x) => /^فرع\s/.test(x));
  return l ? l.replace(/^فرع\s*/, '').trim() : null;
}

const AR_COUNTS = { 'سنة': [1, 'years'], 'سنه': [1, 'years'], 'سنتين': [2, 'years'], 'سنتان': [2, 'years'], 'شهر': [1, 'months'], 'شهرين': [2, 'months'] };

/** مدة الضمان → { value, unit } */
export function pickWarranty(text) {
  const v = labeled(text, /مدة\s*الضمان|فترة\s*الضمان|الضمان|ضمان|warranty/);
  if (!v) return null;
  const m = v.match(/(\d{1,3})\s*(سنوات|سنة|سنه|سنين|years?|yrs?|شهور|شهر|أشهر|اشهر|months?)/i);
  if (m) return { value: +m[1], unit: /شه|month/i.test(m[2]) ? 'months' : 'years' };
  for (const [w, r] of Object.entries(AR_COUNTS)) if (new RegExp(`(^|\\s)${w}(\\s|$|\\|)`).test(v)) return { value: r[0], unit: r[1] };
  return null;
}

/** مدة الاسترجاع بالأيام */
export function pickReturnDays(text) {
  for (const line of lines(text)) {
    if (!/استرجاع|الاسترجاع|ارجاع|إرجاع|الإرجاع|استبدال|return/i.test(line)) continue;
    const m = line.match(/(?:استرجاع|ارجاع|إرجاع|استبدال|return)[^\d]{0,25}(\d{1,3})\s*(يوم|أيام|ايام|days?)/i);
    if (m) return +m[1];
  }
  return null;
}

/** باركود المنتج (EAN-13 / EAN-8 / UPC-A) لو مكتوب كرقم */
export function pickBarcode(text) {
  const t = normalizeDigits(text);
  const labeledV = labeled(text, /الباركود|باركود|barcode|ean|upc/);
  const cand = [labeledV, ...t.split(/\n/)].filter(Boolean);
  for (const c of cand) {
    for (const m of c.replace(/(\d)\s(?=\d)/g, '$1').matchAll(/(?<!\d)(\d{13}|\d{12}|\d{8})(?!\d)/g)) {
      if (validEAN(m[1])) return m[1];
    }
  }
  return null;
}

function validEAN(code) {
  const d = code.split('').map(Number);
  const check = d.pop();
  const sum = d.reverse().reduce((s, n, i) => s + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

const CATEGORY_WORDS = [
  ['phones', /جوال|ايفون|آيفون|iphone|galaxy|جالكسي|هاتف ذكي|موبايل/i],
  ['appliances', /غسالة|ثلاجة|مكيف|فرن|ميكروويف|مكنسة|نشافة|غسالة صحون|خلاط|قلاية|سخان|برادة/i],
  ['furniture', /كنب|سرير|طاولة|كرسي|دولاب|خزانة|مرتبة|مكتب خشب/i],
  ['cars', /سيارة|إطار|اطار|بطارية سيارة|كفرات/i],
  ['electronics', /شاشة|تلفزيون|تلفاز|لابتوب|حاسب|كمبيوتر|سماعة|ساعة ذكية|تابلت|آيباد|ايباد|بلايستيشن|كاميرا|طابعة|راوتر|tv|laptop/i],
];

/** تصنيف تقريبي من اسم المنتج */
export function guessCategory(name) {
  if (!name) return null;
  return CATEGORY_WORDS.find(([, re]) => re.test(name))?.[0] ?? null;
}

/** يستخرج كل الحقول الممكنة من نص الفاتورة */
export function parseInvoiceText(text, todayISO) {
  const productName = pickProductName(text);
  return {
    storeName: pickStoreName(text),
    branch: pickBranch(text),
    purchaseDate: pickPurchaseDate(text, todayISO),
    total: pickTotal(text),
    vatNumber: pickVatNumber(text),
    phone: pickPhone(text),
    productName,
    model: pickModel(text),
    category: guessCategory(productName),
    serialNumber: pickSerial(text),
    warranty: pickWarranty(text),
    returnDays: pickReturnDays(text),
    barcode: pickBarcode(text),
  };
}
