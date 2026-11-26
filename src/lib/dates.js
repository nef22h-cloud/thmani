// أدوات التاريخ. نخزن التواريخ كنص بصيغة YYYY-MM-DD (تاريخ محلي بدون وقت)
// عشان نتفادى مشاكل المناطق الزمنية.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** يحوّل نص YYYY-MM-DD إلى Date محلي (منتصف الليل) */
export function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** يحوّل Date إلى YYYY-MM-DD */
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function today() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** يضيف أشهر مع مراعاة نهاية الشهر (31 يناير + 1 شهر = 28/29 فبراير) */
export function addMonths(date, months) {
  const y = date.getFullYear();
  const m = date.getMonth() + months;
  const d = date.getDate();
  const lastDay = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(d, lastDay));
}

export function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** الفرق بالأيام بين تاريخين (b - a)، يتجاهل التوقيت الصيفي */
export function diffDays(a, b) {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / MS_PER_DAY);
}

const gregorianFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const hijriFmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** تنسيق التاريخ للعرض: ميلادي، ومعه الهجري اختيارياً */
export function formatDate(str, { hijri = false } = {}) {
  const date = typeof str === 'string' ? parseDate(str) : str;
  if (!date) return '—';
  const g = gregorianFmt.format(date);
  return hijri ? `${g} · ${hijriFmt.format(date)}` : g;
}

export function formatHijri(str) {
  const date = typeof str === 'string' ? parseDate(str) : str;
  return date ? hijriFmt.format(date) : '—';
}

/** صياغة عربية صحيحة لعدد الأيام: يوم، يومين، 3 أيام، 11 يوم */
export function daysLabel(n) {
  const abs = Math.abs(n);
  if (abs === 0) return 'اليوم';
  if (abs === 1) return 'يوم واحد';
  if (abs === 2) return 'يومين';
  if (abs >= 3 && abs <= 10) return `${abs} أيام`;
  return `${abs} يوم`;
}

/** نص المدة: "سنتين"، "6 شهور" */
export function durationLabel(months) {
  if (!months) return 'بدون ضمان';
  if (months % 12 === 0) {
    const y = months / 12;
    if (y === 1) return 'سنة';
    if (y === 2) return 'سنتين';
    if (y <= 10) return `${y} سنوات`;
    return `${y} سنة`;
  }
  if (months === 1) return 'شهر';
  if (months === 2) return 'شهرين';
  if (months <= 10) return `${months} شهور`;
  return `${months} شهر`;
}
