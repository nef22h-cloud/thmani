// تنظيف النص المستخرج من PDF.
// بعض ملفات PDF تخزّن العربي بأشكال العرض (ﻓﺎﺗﻮﺭﺓ) أو بترتيب بصري مقلوب (ةروتاف)، فنصلّحه.

const KEYWORDS = ['فاتورة', 'ضريبة', 'الضريبة', 'الإجمالي', 'الاجمالي', 'المجموع', 'الكمية', 'السعر', 'البائع', 'الرقم', 'التاريخ', 'ريال'];
const LATIN_KEYWORDS = /invoice|total|vat|tax|qty|amount|subtotal/i;

const BIDI = /[‎‏‪-‮⁦-⁩]/g;
const ARABIC_WORD = /[؀-ۿ]+/g;

const score = (t) => KEYWORDS.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0);

/** يقلب حروف كل كلمة عربية (لما يكون الملف مخزّن بترتيب بصري) */
export function reverseArabicWords(t) {
  return t.replace(ARABIC_WORD, (w) => [...w].reverse().join(''));
}

/** يرجع { text, usable } — usable = فيه نص كافي يغنينا عن OCR */
export function normalizePdfText(raw) {
  let text = String(raw ?? '').normalize('NFKC').replace(BIDI, '').replace(/[ \t]+/g, ' ');
  text = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
  const reversed = reverseArabicWords(text);
  if (score(reversed) > score(text)) text = reversed;
  const usable = text.length >= 60 && (score(text) >= 2 || (LATIN_KEYWORDS.test(text) && /\d+\.\d{2}/.test(text)));
  return { text, usable };
}

const AR = '؀-ۿﭐ-﷿ﹰ-﻿';
export const IS_AR = new RegExp(`[${AR}]`);
/** فاصل الأعمدة (لما تكون فيه فجوة كبيرة بين أجزاء السطر) */
export const COL = ' ¦ ';

const kind = (s) => (IS_AR.test(s) ? 'ar' : /^\s+$/.test(s) ? 'sp' : /[A-Za-z0-9]/.test(s) ? 'ltr' : 'n');

/**
 * يحوّل قطع سطر واحد من PDF لنص منطقي.
 * items: [{ x, width, str }] ، rtl: السطر عربي ومخزّن بترتيب بصري (حرف حرف)
 * - نرتب القطع من اليسار لليمين، ونحط مسافة عند الفجوة الصغيرة وفاصل أعمدة عند الكبيرة
 * - للأسطر العربية: نعكس ترتيب المقاطع، ونعكس ترتيب القطع داخل المقطع العربي
 *   (كل قطعة نخليها زي ما هي لأن الحروف داخل القطعة الواحدة بترتيب صحيح أصلاً)
 */
export function rowToText(items, fontSize = 10, pageRtl = false) {
  const sorted = [...items].filter((i) => i.str).sort((a, b) => a.x - b.x);
  const segments = [[]];
  let end = null;
  for (const it of sorted) {
    const gap = end == null ? 0 : it.x - end;
    // فجوة كبيرة = خانة/عمود جديد (في الجداول)، فجوة صغيرة = مسافة بين كلمتين
    if (gap > fontSize * 1.2) segments.push([]);
    else if (gap > fontSize * 0.2) segments.at(-1).push({ str: ' ' });
    segments.at(-1).push(it);
    end = it.x + (it.width || 0);
  }
  const texts = segments
    .map((seg) => {
      const real = seg.filter((u) => u.str.trim());
      // العربي المخزّن حرف حرف (ترتيب بصري) نحوّله لمنطقي؛ غيره نخليه زي ما هو
      return pageRtl && isGlyphWise(real) ? unitsToLogical(seg.map((u) => u.str)) : seg.map((u) => u.str).join('');
    })
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  // الأعمدة: في الصفحة العربية نقرأ من اليمين
  return (pageRtl ? texts.reverse() : texts).join(COL);
}

function unitsToLogical(units) {
  const runs = [];
  for (const u of units) {
    const k = kind(u);
    const last = runs.at(-1);
    if (last && (k === 'sp' || k === 'n' || k === last.k)) last.units.push(u);
    else runs.push({ k: k === 'sp' || k === 'n' ? 'ar' : k, units: [u] });
  }
  return runs
    .reverse()
    .map((r) => (r.k === 'ar' ? [...r.units].reverse().map(mirror).join('') : r.units.join('')).trim())
    .join(' ');
}

const MIRROR = { '(': ')', ')': '(', '«': '»', '»': '«', '[': ']', ']': '[' };
const mirror = (u) => (u.length === 1 && MIRROR[u] ? MIRROR[u] : u);

/** هل السطر عربي أساساً؟ */
export const isRtlLine = (s) => {
  const ar = (s.match(new RegExp(`[${AR}]`, 'g')) ?? []).length;
  const lat = (s.match(/[A-Za-z]/g) ?? []).length;
  return ar > 0 && ar >= lat;
};

/** هل قطع السطر مخزّنة حرف حرف (ترتيب بصري)؟ نشوف القطع العربية بس */
export function isGlyphWise(items) {
  const ar = items.filter((i) => IS_AR.test(i.str));
  return ar.length > 0 && ar.filter((i) => [...i.str.trim()].length <= 3).length / ar.length > 0.5;
}
