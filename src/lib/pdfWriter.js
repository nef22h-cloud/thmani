// كاتب PDF بسيط جداً: كل صفحة A4 = صورة JPEG كاملة.
// نرسم الصفحات بالمتصفح (يدعم العربي والاتجاه صح) ونحطها في PDF بدون أي مكتبة.

const A4 = { w: 595.28, h: 841.89 }; // بالنقاط

const enc = new TextEncoder();

/** نص PDF بترميز UTF-16BE (للعنوان العربي في خصائص الملف) */
function pdfTextString(s) {
  let hex = 'FEFF';
  for (const ch of String(s)) {
    const cp = ch.codePointAt(0);
    if (cp > 0xffff) {
      const v = cp - 0x10000;
      hex += (0xd800 + (v >> 10)).toString(16).padStart(4, '0') + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, '0');
    } else hex += cp.toString(16).padStart(4, '0');
  }
  return `<${hex.toUpperCase()}>`;
}

/**
 * pages: [{ jpeg: Uint8Array, width, height }] (أبعاد الصورة بالبكسل)
 * يرجع Uint8Array لملف PDF
 */
export function buildPdf(pages, { title = '', creator = 'Damani' } = {}) {
  if (!pages.length) throw new Error('no pages');
  const chunks = [];
  const offsets = [];
  let length = 0;
  const push = (data) => {
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const obj = (n, body) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    for (const part of [].concat(body)) push(part);
    push('\nendobj\n');
  };

  // أرقام الكائنات: 1 الكتالوج، 2 الصفحات، 3 المعلومات، وبعدها لكل صفحة 3 كائنات (صفحة، محتوى، صورة)
  const pageObj = (i) => 4 + i * 3;
  push('%PDF-1.4\n');
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // تعليق ثنائي (يدل إن الملف binary)

  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] >>`);
  obj(3, `<< /Title ${pdfTextString(title)} /Creator ${pdfTextString(creator)} /Producer (Damani) >>`);

  pages.forEach((p, i) => {
    const n = pageObj(i);
    // الصورة تملأ الصفحة مع الحفاظ على النسبة
    const scale = Math.min(A4.w / p.width, A4.h / p.height);
    const w = p.width * scale;
    const h = p.height * scale;
    const x = (A4.w - w) / 2;
    const y = (A4.h - h) / 2;
    const content = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;
    obj(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`);
    obj(n + 1, [`<< /Length ${content.length} >>\nstream\n`, content, '\nendstream']);
    obj(n + 2, [
      `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
      p.jpeg,
      '\nendstream',
    ]);
  });

  const total = 4 + pages.length * 3;
  const xref = length;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

/** أبعاد صورة JPEG من ترويسة SOF (للاختبار والتحقق) */
export function jpegSize(bytes) {
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker >= 0xc0 && marker <= 0xc3) return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
    i += 2 + len;
  }
  return null;
}
