// تصدير الضمان كملف PDF: صفحة بالبيانات (والمطالبات) + صفحة لكل صورة.
// نرسم على canvas (المتصفح يرسم العربي صح) وبعدين نحط الصفحات في PDF بـ buildPdf.

import { buildPdf } from '../lib/pdfWriter.js';
import { categoryById, IMAGE_KINDS, STATUS_LABELS } from '../lib/constants.js';
import { claimOutcomeById, claimStatusById } from '../lib/claims.js';
import { daysLabel, durationLabel, formatDate, formatHijri, toISODate, today } from '../lib/dates.js';
import { formatMoney } from '../lib/format.js';
import { daysUntil, getStatus } from '../lib/warranty.js';
import { safeFileName } from './share.js';

// A4 بدقة ~150dpi
const W = 1240;
const H = 1754;
const M = 80; // الهامش
const FONT = '"IBM Plex Sans Arabic", "Tajawal", system-ui, sans-serif';
const C = {
  brand: '#0f766e',
  brandSoft: '#e6f4f1',
  text: '#0f172a',
  muted: '#64748b',
  line: '#e2e8f0',
  soft: '#f8fafc',
  status: { active: '#059669', expiring: '#d97706', expired: '#dc2626', claimed: '#0284c7' },
};

/**
 * يرجع File (PDF).
 * { warranty, images, claims, settings }
 */
export async function createWarrantyPdf({ warranty: w, images = [], claims = [], settings = {} }) {
  await loadFonts();
  const hijri = settings.showHijri;
  const doc = new PageWriter();

  drawSummary(doc, w, settings);
  doc.section('بيانات الشراء');
  doc.row('المتجر', w.storeName);
  doc.row('الفرع', w.storeBranch);
  doc.row('رقم التواصل', w.storePhone);
  doc.row('تاريخ الشراء', dateText(w.purchaseDate, hijri));
  doc.row('السعر', w.price != null ? formatMoney(w.price) : null);
  doc.row('الرقم الضريبي للمتجر', w.vatNumber);
  doc.row('ضريبة القيمة المضافة', w.vatAmount != null ? formatMoney(w.vatAmount) : null);

  doc.section('الضمان');
  doc.row('مدة الضمان', durationLabel(w.warrantyMonths));
  doc.row('ينتهي الضمان', dateText(w.expiryDate, hijri));
  doc.row('مدة الاسترجاع', w.returnDays ? `${daysLabel(w.returnDays)} (حتى ${formatDate(w.returnDeadline)})` : 'لا يوجد');
  doc.row('الرقم التسلسلي', w.serialNumber);
  doc.row('الباركود', w.barcode);

  if (claims.length) {
    doc.section(`المطالبات (${claims.length})`);
    for (const c of claims) doc.claim(c, hijri);
  }
  if (w.notes) {
    doc.section('ملاحظات');
    doc.paragraph(w.notes);
  }

  // صفحة لكل صورة (الفاتورة أولاً)
  const order = Object.fromEntries(IMAGE_KINDS.map((k, i) => [k.id, i]));
  for (const img of [...images].sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9))) {
    const label = IMAGE_KINDS.find((k) => k.id === img.kind)?.label ?? 'صورة';
    await doc.imagePage(`صورة ${label}`, img.blob);
  }

  const pages = await doc.finish(w.productName);
  const bytes = buildPdf(pages, { title: `ضمان ${w.productName}` });
  return new File([bytes], `ضمان - ${safeFileName(w.productName)}.pdf`, { type: 'application/pdf' });
}

function dateText(d, hijri) {
  if (!d) return null;
  return hijri ? `${formatDate(d)} (${formatHijri(d)})` : formatDate(d);
}

function drawSummary(doc, w, settings) {
  const ctx = doc.ctx;
  const status = getStatus(w, settings);
  const cat = categoryById(w.category);

  // اسم المنتج
  doc.y += 10;
  for (const line of wrap(ctx, w.productName, W - 2 * M, `700 52px ${FONT}`).slice(0, 3)) {
    text(ctx, line, W - M, doc.y + 52, { font: `700 52px ${FONT}` });
    doc.y += 70;
  }
  // التصنيف + الحالة
  text(ctx, cat.label, W - M, doc.y + 30, { font: `400 28px ${FONT}`, color: C.muted });
  const label = STATUS_LABELS[status];
  ctx.font = `700 26px ${FONT}`;
  const pw = ctx.measureText(label).width + 48;
  roundRect(ctx, M, doc.y, pw, 46, 23, C.status[status]);
  text(ctx, label, M + pw / 2, doc.y + 32, { font: `700 26px ${FONT}`, color: '#fff', align: 'center' });
  doc.y += 80;

  // ثلاث خانات: الشراء، الانتهاء، المتبقي
  const left = daysUntil(w.expiryDate);
  const remaining = status === 'claimed' ? 'تم استخدامه' : left == null ? '—' : left < 0 ? 'منتهي' : left === 0 ? 'آخر يوم' : `باقي ${daysLabel(left)}`;
  const boxes = [
    ['تاريخ الشراء', formatDate(w.purchaseDate)],
    ['ينتهي الضمان', formatDate(w.expiryDate)],
    ['المتبقي', remaining],
  ];
  const gap = 24;
  const bw = (W - 2 * M - 2 * gap) / 3;
  boxes.forEach(([k, v], i) => {
    const x = W - M - (i + 1) * bw - i * gap;
    roundRect(ctx, x, doc.y, bw, 130, 20, C.soft, C.line);
    text(ctx, k, x + bw / 2, doc.y + 48, { font: `400 24px ${FONT}`, color: C.muted, align: 'center' });
    text(ctx, fit(ctx, v, bw - 30, `700 32px ${FONT}`), x + bw / 2, doc.y + 98, { font: `700 32px ${FONT}`, align: 'center', color: i === 2 ? C.status[status] : C.text });
  });
  doc.y += 160;
}

class PageWriter {
  constructor() {
    this.pages = []; // canvases
    this.newPage(true);
  }

  newPage(first = false) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    this.pages.push(canvas);
    this.canvas = canvas;
    this.ctx = ctx;
    if (first) {
      // شريط علوي
      ctx.fillStyle = C.brand;
      ctx.fillRect(0, 0, W, 170);
      text(ctx, 'ضماني', W - M, 92, { font: `700 56px ${FONT}`, color: '#fff' });
      text(ctx, 'بيانات الضمان', W - M, 138, { font: `400 28px ${FONT}`, color: '#cdeee8' });
      text(ctx, `تاريخ الإصدار: ${formatDate(toISODate(today()))}`, M, 92, { font: `400 26px ${FONT}`, color: '#e6f4f1', align: 'left', dir: 'rtl' });
      this.y = 210;
    } else {
      this.y = M;
    }
  }

  ensure(h) {
    if (this.y + h > H - 110) this.newPage();
  }

  section(title) {
    this.ensure(130);
    this.y += 16;
    text(this.ctx, title, W - M, this.y + 34, { font: `700 34px ${FONT}`, color: C.brand });
    this.y += 56;
    this.ctx.fillStyle = C.brand;
    this.ctx.fillRect(M, this.y, W - 2 * M, 3);
    this.y += 12;
  }

  row(label, value) {
    if (value == null || value === '') return;
    const ctx = this.ctx;
    const valueW = W - 2 * M - 360;
    const lines = wrap(ctx, String(value), valueW, `500 29px ${FONT}`);
    const h = Math.max(1, lines.length) * 40 + 20;
    this.ensure(h);
    text(ctx, label, W - M, this.y + 40, { font: `400 27px ${FONT}`, color: C.muted });
    lines.forEach((line, i) => text(ctx, line, W - M - 360, this.y + 40 + i * 40, { font: `500 29px ${FONT}` }));
    this.y += h;
    ctx.fillStyle = C.line;
    ctx.fillRect(M, this.y, W - 2 * M, 2);
  }

  claim(c, hijri) {
    const ctx = this.ctx;
    const status = claimStatusById(c.status);
    const outcome = claimOutcomeById(c.outcome);
    const meta = [dateText(c.date, hijri), status.label, outcome?.label, c.closedDate && c.closedDate !== c.date ? `أُغلقت ${formatDate(c.closedDate)}` : null, c.cost ? `التكلفة ${formatMoney(c.cost)}` : null]
      .filter(Boolean)
      .join(' · ');
    const issue = wrap(ctx, c.issue, W - 2 * M - 40, `500 30px ${FONT}`);
    const extra = [c.referenceNumber && `رقم الطلب: ${c.referenceNumber}`, c.notes].filter(Boolean).flatMap((t) => wrap(ctx, t, W - 2 * M - 40, `400 26px ${FONT}`));
    const h = 40 + issue.length * 44 + 44 + extra.length * 38 + 20;
    this.ensure(h + 16);
    roundRect(ctx, M, this.y + 10, W - 2 * M, h, 18, C.soft, C.line);
    let y = this.y + 10 + 50;
    issue.forEach((line) => {
      text(ctx, line, W - M - 20, y, { font: `500 30px ${FONT}` });
      y += 44;
    });
    text(ctx, meta, W - M - 20, y, { font: `400 26px ${FONT}`, color: C.muted });
    y += 44;
    extra.forEach((line) => {
      text(ctx, line, W - M - 20, y, { font: `400 26px ${FONT}`, color: C.muted });
      y += 38;
    });
    this.y += h + 16;
  }

  paragraph(t) {
    for (const para of String(t).split(/\n/)) {
      for (const line of wrap(this.ctx, para || ' ', W - 2 * M, `400 30px ${FONT}`)) {
        this.ensure(48);
        text(this.ctx, line, W - M, this.y + 40, { font: `400 30px ${FONT}` });
        this.y += 48;
      }
    }
  }

  async imagePage(title, blob) {
    let bmp;
    try {
      bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      return;
    }
    this.newPage();
    const ctx = this.ctx;
    text(ctx, title, W - M, M + 40, { font: `700 36px ${FONT}`, color: C.brand });
    const top = M + 80;
    const areaW = W - 2 * M;
    const areaH = H - top - 110;
    const s = Math.min(areaW / bmp.width, areaH / bmp.height);
    const iw = bmp.width * s;
    const ih = bmp.height * s;
    ctx.drawImage(bmp, M + (areaW - iw) / 2, top, iw, ih);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.strokeRect(M + (areaW - iw) / 2, top, iw, ih);
    bmp.close?.();
  }

  async finish(productName) {
    const n = this.pages.length;
    const out = [];
    for (let i = 0; i < n; i++) {
      const canvas = this.pages[i];
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = C.line;
      ctx.fillRect(M, H - 90, W - 2 * M, 2);
      text(ctx, `ضمان ${fit(ctx, productName, 700, `400 22px ${FONT}`)} · صادر من تطبيق ضماني`, W - M, H - 50, { font: `400 22px ${FONT}`, color: C.muted });
      text(ctx, `صفحة ${i + 1} من ${n}`, M, H - 50, { font: `400 22px ${FONT}`, color: C.muted, align: 'left', dir: 'rtl' });
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.86));
      out.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: W, height: H });
    }
    return out;
  }
}

// ===== أدوات الرسم =====

function text(ctx, str, x, y, { font, color = C.text, align = 'right', dir = 'rtl' } = {}) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.direction = dir;
  ctx.textAlign = align;
  ctx.fillText(str, x, y);
}

function wrap(ctx, str, maxW, font) {
  ctx.font = font;
  const words = String(str).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width <= maxW || !cur) cur = next;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** يقص النص بـ "…" لو أطول من العرض */
function fit(ctx, str, maxW, font) {
  ctx.font = font;
  let s = String(str);
  if (ctx.measureText(s).width <= maxW) return s;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

async function loadFonts() {
  if (!document.fonts?.load) return;
  try {
    await Promise.race([
      Promise.all(['400', '500', '700'].map((w) => document.fonts.load(`${w} 30px "IBM Plex Sans Arabic"`, 'ضمان'))),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  } catch {
    /* نكمل بخط النظام */
  }
}
