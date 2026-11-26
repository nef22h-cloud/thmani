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
  /(الإجمالي|الاجمالي|إجمالي|اجمالي)\s*(بعد|شامل|مع)\s*(الضريبة|الضريبه|ض)/,
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
  const guess = pickTotalRaw(text);
  // تحقق: الإجمالي = الضريبة × 23/3 تقريباً (ضريبة 15%). OCR أحياناً يلصق رقم زيادة (7190 بدل 190)
  const vat = pickVatAmount(text);
  if (vat) {
    const expected = (vat * 23) / 3;
    const near = (n) => n != null && Math.abs(n - expected) <= Math.max(0.05, expected * 0.002) + 0.01;
    if (near(guess)) return guess;
    const all = amountsIn(normalizeDigits(text).replace(/\b\d{10,}\b/g, '')).filter(near);
    if (all.length) return Math.max(...all);
  }
  return guess;
}

/** مبلغ ضريبة القيمة المضافة */
export function pickVatAmount(text) {
  for (const line of normalizeDigits(text).split(/\n/)) {
    if (!/(ضريبة|ضريبه|ضرييه|ضريية)\s*القيمة|\bvat\b|tax\s*amount/i.test(line) || /شامل|incl|رقم|الرقم|no\b/i.test(line)) continue;
    // نتجاهل نسبة الضريبة (15% أو 9615 لما OCR يقرأ % كأرقام)
    const nums = [...line.matchAll(/\d{1,3}(?:,\d{3})*\.\d{2}/g)].map((m) => Number(m[0].replace(/,/g, '')));
    if (nums.length) return nums[nums.length - 1];
  }
  return null;
}

function pickTotalRaw(text) {
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
  const re = /(?:\+?966|0)5\d{8}(?!\d)|(?<!\d)9200\d{5}(?!\d)|(?<!\d)800\d{7}(?!\d)|(?<!\d)(?:\+?966|0)1[1-7]\d{7}(?!\d)/;
  const t = normalizeDigits(text);
  // أولاً كما هو، وبعدين بعد دمج المجموعات ("011 234 5678")
  return t.match(re)?.[0] ?? t.replace(/(\d)[\s-](?=\d)/g, '$1').match(re)?.[0] ?? null;
}

const STORE_STOPWORDS = /فرع|عنوان|فاتورة|ضريبية|مبسطة|tax|invoice|simplified|receipt|إيصال|الرقم|رقم|vat|cr\b|سجل|تاريخ|date|tel|هاتف|جوال|www|http|@|\d{4,}/i;

const COMPANY_RE = /(شركة|شركه|مؤسسة|مؤسسه|متجر|مكتبة|محل|محلات|معرض|مركز|صيدلية|سوبر ?ماركت|هايبر|مجموعة)\s+[\p{Script=Arabic}\s]{2,}|[\p{Script=Arabic}\s]{2,}(للتجارة|للتجاره|للنجارة|التجارية|للإلكترونيات|للالكترونيات|المحدودة)/u;

/** اسم المتجر: سطر فيه "شركة/مؤسسة/... للتجارة"، وإلا أول سطر نصي من أول الفاتورة */
export function pickStoreName(text) {
  const lines = normalizeDigits(text).split(/\n/).map((l) => l.replace(/[|*_=~#©®“”"»«]+/g, ' ').replace(/\s+/g, ' ').trim());
  // نبحث في أول 30 سطر لأن خلفية الصورة (طاولة، سيارة...) تطلع أسطر ضوضاء قبل الفاتورة
  for (const line of lines.slice(0, 30)) {
    const m = line.match(COMPANY_RE);
    if (m && !/فاتورة|ضريبية/.test(m[0])) return m[0].replace(/\s+/g, ' ').trim();
  }
  for (const line of lines.slice(0, 8)) {
    if (line.length < 2 || line.length > 40) continue;
    if (STORE_STOPWORDS.test(line) || /[:：]/.test(line)) continue;
    const arabic = (line.match(/\p{Script=Arabic}/gu) ?? []).length;
    const letters = (line.match(/[\p{L}]/gu) ?? []).length;
    if (letters / line.length < 0.6 || arabic < letters * 0.8) continue;
    // كلمتين عربيتين حقيقيتين على الأقل (مو ضوضاء OCR)
    if ((line.match(/\p{Script=Arabic}{3,}/gu) ?? []).length < 1) continue;
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
    if (m && /[\p{L}\d]{2,}/u.test(m[1])) return m[1].trim();
    // أحياناً OCR يقلب ترتيب السطر فتجي القيمة قبل التسمية: "UA55X900 الموديل:"
    const r = line.match(new RegExp(`^(.+?)\\s*(?:${labelRe.source})\\s*[:：]?$`, 'i'));
    if (r && /[\p{L}\d]{2,}/u.test(r[1])) return r[1].trim();
  }
  return null;
}

/** الرقم التسلسلي */
export function pickSerial(text) {
  const v = labeled(text, /الرقم\s*التسلسلي|رقم\s*تسلسلي|التسلسلي|serial\s*(?:no\.?|number)?|s\s*\/\s*n|imei|card\s*no\.?|رقم\s*البطاقة|رقم\s*الكرت/);
  const m = v?.replace(/\s+/g, '').match(/[A-Z0-9][A-Z0-9\-]{4,}/i);
  return m ? m[0].toUpperCase() : null;
}

const NAME_STOP = /باركود|الموديل|موديل|التسلسلي|الكمية|السعر|المجموع|الإجمالي|الاجمالي|ضريبة|الضريبة|الرقم|رقم|التاريخ|الوقت|هاتف|جوال|الضمان|الاسترجاع|الإرجاع|فاتورة|شكرا|qty|total|vat/i;

const TABLE_HEADER = /(البيان|الصنف|الوصف|اسم الصنف|المنتج|description|item)/i;
const TABLE_COLS = /(الكمية|الكميه|السعر|الوحدة|الإجمالي|الاجمالي|qty|price|unit|total)/gi;
const UNIT_WORDS = /^(حبة|حبه|قطعة|قطعه|عدد|كرتون|علبة|pcs|pc|ea|each)$/i;

/** أطول سلسلة كلمات (عربية/موديل) في سطر من جدول الأصناف */
function itemTextFromRow(row) {
  const tokens = row.split(/\s+/);
  let best = [], cur = [];
  for (const t of tokens) {
    const isAr = /^\p{Script=Arabic}{2,}$/u.test(t) && !UNIT_WORDS.test(t);
    const isModel = /^(?=.*[A-Z])(?=.*\d)[A-Z0-9\-]{4,}$/.test(t) || /^[A-Z][a-zA-Z]{2,}$/.test(t);
    if (isAr || (isModel && cur.length)) cur.push(t);
    else {
      if (cur.length > best.length) best = cur;
      cur = [];
    }
  }
  if (cur.length > best.length) best = cur;
  if (!best.length || best.join(' ').length < 4) return null;
  // لو في الصف رقم موديل (حروف + أرقام) نضيفه للاسم: "بطارية اسيدبلكو NS60LSMF"
  const model = tokens.find((t) => /^(?=.*[A-Z])(?=.*\d)[A-Z0-9\-]{5,}$/.test(t) && !best.includes(t));
  return model ? `${best.join(' ')} ${model}` : best.join(' ');
}

/** اسم المنتج: من سطر "المنتج: ..."، أو أول صف تحت رأس جدول الأصناف، أو السطر اللي قبل "الكمية" */
export function pickProductName(text) {
  const ls = lines(text);
  // جدول: سطر فيه "البيان" مع أعمدة ثانية (الكمية/السعر...)
  const hi = ls.findIndex((l) => TABLE_HEADER.test(l) && (l.match(TABLE_COLS) ?? []).length >= 2);
  if (hi >= 0) {
    for (const row of ls.slice(hi + 1, hi + 5)) {
      if ((row.match(TABLE_COLS) ?? []).length >= 2 || /^(ضريبة|ضيبة|الضريبة)/.test(row)) continue;
      const name = itemTextFromRow(row);
      if (name && !NAME_STOP.test(name)) return name;
    }
  }
  // OCR أحياناً يسقط الألف في أول الكلمة ("لمنتج")
  const v = labeled(text, /اسم\s*المنتج|ا?لمنتج|ا?لصنف|ا?لبيان|ا?لوصف|item|product|description/);
  if (v && !/^\d/.test(v) && (v.match(TABLE_COLS) ?? []).length < 2) return v.replace(/\s+\d+\s*[x×].*$/i, '').trim();
  const qi = ls.findIndex((l) => /الكمية|qty/i.test(l));
  if (qi > 0 && !NAME_STOP.test(ls[qi - 1]) && !/[:：]/.test(ls[qi - 1])) return ls[qi - 1];
  return null;
}

/** الموديل */
export function pickModel(text) {
  const v = labeled(text, /رقم\s*الموديل|ا?لموديل|موديل|model(?:\s*no\.?)?/);
  return v?.match(/[A-Z0-9][A-Z0-9\-\/]{2,}/i)?.[0].toUpperCase() ?? null;
}

/** الفرع / الموقع */
export function pickBranch(text) {
  const v = labeled(text, /ا?لفرع|ا?لعنوان|الموقع|branch|address/);
  if (v) return v;
  // "فرع شارع الحج" — ممكن تكون في نفس السطر مع "نوع الفاتورة" فنقطع عند أول كلمة معروفة
  for (const l of lines(text).slice(0, 30)) {
    const m = l.match(/(?:^|\s)فرع\s+(.+)$/);
    if (!m) continue;
    const words = [];
    for (const w of m[1].split(/\s+/)) {
      if (/^(نوع|رقم|التاريخ|الفاتورة|هاتف|جوال|تلفون|الرقم|سجل)/.test(w)) break;
      if (/^[\p{Script=Arabic}\-]{2,}$/u.test(w)) words.push(w);
    }
    if (words.length) return words.join(' ');
  }
  return null;
}

const AR_NUM_WORDS = {
  'واحد': 1, 'واحدة': 1, 'اثنين': 2, 'اثنتين': 2, 'ثلاث': 3, 'ثلاثة': 3, 'ثلاثه': 3, 'اربع': 4, 'أربع': 4, 'اربعة': 4, 'أربعة': 4,
  'خمس': 5, 'خمسة': 5, 'خمسه': 5, 'ست': 6, 'ستة': 6, 'سته': 6, 'سبع': 7, 'سبعة': 7, 'ثمان': 8, 'ثمانية': 8, 'تسع': 9, 'تسعة': 9,
  'عشر': 10, 'عشرة': 10, 'عشره': 10,
};
const DUAL = { 'سنتين': [2, 'years'], 'سنتان': [2, 'years'], 'شهرين': [2, 'months'], 'شهران': [2, 'months'] };
const UNIT_RE = '(سنوات|سنة|سنه|سنين|years?|yrs?|شهور|شهر|أشهر|اشهر|months?)';

function parseDuration(v) {
  let m = v.match(new RegExp(`(\\d{1,3})\\s*${UNIT_RE}`, 'i'));
  if (m) return { value: +m[1], unit: /شه|month/i.test(m[2]) ? 'months' : 'years' };
  m = v.match(new RegExp(`(${Object.keys(AR_NUM_WORDS).join('|')})\\s+${UNIT_RE}`));
  if (m) return { value: AR_NUM_WORDS[m[1]], unit: /شه/.test(m[2]) ? 'months' : 'years' };
  for (const [w, r] of Object.entries(DUAL)) if (v.includes(w)) return { value: r[0], unit: r[1] };
  if (/(^|\s)(سنة|سنه)(\s+واحدة)?(\s|$|\|)/.test(v)) return { value: 1, unit: 'years' };
  if (/(^|\s)شهر(\s+واحد)?(\s|$|\|)/.test(v)) return { value: 1, unit: 'months' };
  return null;
}

/** مدة الضمان → { value, unit }. نفحص كل سطر فيه "ضمان" (والسطر اللي بعده لأن الجملة أحياناً تنقسم) */
export function pickWarranty(text) {
  const ls = lines(text);
  for (let i = 0; i < ls.length; i++) {
    if (!/ضمان|warranty|guarantee/i.test(ls[i])) continue;
    const after = ls[i].replace(/^.*?(ضمان|warranty|guarantee)/i, '');
    const d = parseDuration(after) ?? parseDuration(`${after} ${ls[i + 1] ?? ''}`);
    if (d) return d;
  }
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
  ['cars', /سيارة|سياره|إطار|اطار|كفر|بطارية|بطاريه|زيت محرك|مركبات|قطع غيار/i],
  ['electronics', /شاشة|تلفزيون|تلفاز|لابتوب|حاسب|كمبيوتر|سماعة|ساعة ذكية|تابلت|آيباد|ايباد|بلايستيشن|كاميرا|طابعة|راوتر|tv|laptop/i],
];

/** تصنيف تقريبي من اسم المنتج */
export function guessCategory(name, context = '') {
  const hit = (t) => (t ? CATEGORY_WORDS.find(([, re]) => re.test(t))?.[0] : null);
  // اسم المنتج أولاً، وبعدين وصف المتجر في أول الفاتورة (مثل "لبيع بطاريات المركبات")
  return hit(name) ?? hit(context.split(/\n/).slice(0, 6).join(' ')) ?? null;
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
    category: guessCategory(productName, text),
    serialNumber: pickSerial(text),
    warranty: pickWarranty(text),
    returnDays: pickReturnDays(text),
    barcode: pickBarcode(text),
  };
}
