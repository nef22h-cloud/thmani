// فك QR الفاتورة الإلكترونية السعودية (فاتورة) حسب مواصفات هيئة الزكاة والضريبة والجمارك.
//
// محتوى الـ QR نص Base64، وبعد فكّه نحصل على بايتات بصيغة TLV:
//   [Tag: 1 بايت][Length: 1 بايت][Value: Length بايت] ...
//
// الحقول (المرحلة 1 والمرحلة 2):
//   1 اسم البائع (UTF-8)          2 الرقم الضريبي
//   3 تاريخ ووقت الفاتورة (ISO)   4 الإجمالي شامل الضريبة
//   5 قيمة الضريبة
//   6-9 (المرحلة 2) هاش الفاتورة، التوقيع، المفتاح العام، توقيع الشهادة — بيانات ثنائية ما نحتاجها

const TAGS = { 1: 'sellerName', 2: 'vatNumber', 3: 'timestamp', 4: 'total', 5: 'vatAmount' };

function base64ToBytes(b64) {
  const clean = b64.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** يقرأ الطول: عادة بايت واحد، ونتعامل مع صيغة BER الطويلة (0x81/0x82) احتياطاً */
function readLength(bytes, i) {
  const first = bytes[i];
  if (first < 0x80) return [first, i + 1];
  const n = first & 0x7f;
  if (n === 0 || n > 2) throw new Error('bad length');
  let len = 0;
  for (let k = 1; k <= n; k++) len = (len << 8) | bytes[i + k];
  return [len, i + 1 + n];
}

export function parseTLV(bytes) {
  const out = {};
  const utf8 = new TextDecoder('utf-8', { fatal: true });
  let i = 0;
  while (i < bytes.length) {
    const tag = bytes[i];
    if (tag < 1 || tag > 9) throw new Error(`unknown tag ${tag}`);
    const [len, start] = readLength(bytes, i + 1);
    const end = start + len;
    if (end > bytes.length) throw new Error('truncated');
    if (TAGS[tag]) out[TAGS[tag]] = utf8.decode(bytes.subarray(start, end));
    i = end;
  }
  return out;
}

/**
 * يفك نص QR. يرجع null لو ما كان QR فاتورة إلكترونية.
 * النتيجة: { sellerName, vatNumber, timestamp, date (YYYY-MM-DD), time, total, vatAmount }
 */
export function decodeZatcaQR(text) {
  if (!text || text.length < 20 || /^https?:\/\//i.test(text)) return null;
  let fields;
  try {
    fields = parseTLV(base64ToBytes(text));
  } catch {
    return null;
  }
  if (!fields.sellerName || !fields.timestamp) return null;

  const { date, time } = splitTimestamp(fields.timestamp);
  return {
    sellerName: fields.sellerName.trim(),
    vatNumber: fields.vatNumber?.trim() ?? '',
    timestamp: fields.timestamp,
    date,
    time,
    total: toNumber(fields.total),
    vatAmount: toNumber(fields.vatAmount),
  };
}

function toNumber(s) {
  if (s == null) return null;
  const n = Number(String(s).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * التاريخ يجي بصيغ مختلفة حسب نظام المتجر:
 * 2026-11-20T14:35:00Z  أو  2026-11-20 14:35:00  أو  2026-11-20T14:35:00+03:00
 * لو فيه منطقة زمنية نحوله لتوقيت السعودية، وإلا نعتبره محلي كما هو.
 */
export function splitTimestamp(ts) {
  const s = String(ts).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return { date: null, time: null };
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(s);
  if (hasZone && m[4]) {
    const d = new Date(s.replace(' ', 'T'));
    if (!Number.isNaN(d.getTime())) {
      // توقيت السعودية UTC+3 بدون توقيت صيفي
      const ksa = new Date(d.getTime() + 3 * 3600 * 1000);
      const iso = ksa.toISOString();
      return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
    }
  }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: m[4] ? `${m[4]}:${m[5]}` : null };
}

/** يبني QR (للاختبارات والتجربة) */
export function encodeZatcaQR({ sellerName, vatNumber, timestamp, total, vatAmount }) {
  const enc = new TextEncoder();
  const parts = [sellerName, vatNumber, timestamp, String(total), String(vatAmount)].map((v, idx) => {
    const val = enc.encode(v);
    return [idx + 1, val.length, ...val];
  });
  const bytes = Uint8Array.from(parts.flat());
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

/** الرقم الضريبي السعودي: 15 رقم يبدأ وينتهي بـ 3 */
export const isValidVatNumber = (v) => /^3\d{13}3$/.test(String(v ?? ''));
