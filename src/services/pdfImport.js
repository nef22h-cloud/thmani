// فتح فاتورة PDF (فواتير المتاجر الإلكترونية مثل نون وأمازون تجي PDF).
// - النص: نستخرجه من الملف مباشرة لو كان PDF رقمي (أدق وأسرع من OCR)
// - الصورة: نرسم الصفحة الأولى بدقة عالية (للـ QR ولصورة الفاتورة، وللـ OCR لو الملف مصوّر)

import { isRtlLine, normalizePdfText, rowToText } from '../lib/pdfText.js';

let pdfjsPromise;
async function loadPdfjs() {
  // pdf.js يحتاج Promise.withResolvers (موجودة في المتصفحات الحديثة فقط)
  if (!Promise.withResolvers) {
    Promise.withResolvers = function () {
      let resolve, reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }
  pdfjsPromise ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return pdfjsPromise;
}

export const isPdf = (file) => file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name ?? '');

/**
 * يرجع { image: Blob (JPEG للصفحة الأولى), text: string|null (لو الملف فيه نص), pages }
 */
export async function readPdfInvoice(file, { maxSide = 3000 } = {}) {
  const pdfjs = await loadPdfjs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  try {
    const pageCount = pdf.numPages;
    // النص من أول 3 صفحات
    const lines = [];
    for (let i = 1; i <= Math.min(3, pageCount); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      lines.push(...groupLines(content.items));
    }
    const text = normalizePdfText(lines.join('\n'));

    // صورة الصفحة الأولى
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(4, maxSide / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const image = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    return { image, text: text.usable ? text.text : null, pages: pageCount };
  } finally {
    pdf.destroy();
  }
}

/** يجمع قطع النص في أسطر حسب الارتفاع، ويحوّل الأسطر العربية من الترتيب البصري للمنطقي */
function groupLines(items) {
  const rows = [];
  for (const it of items) {
    if (!it.str) continue;
    const y = it.transform[5];
    const h = Math.abs(it.transform[3]) || it.height || 10;
    let row = rows.find((r) => Math.abs(r.y - y) < h * 0.5);
    if (!row) rows.push((row = { y, h, items: [] }));
    row.items.push({ x: it.transform[4], width: it.width, str: it.str });
  }
  rows.sort((a, b) => b.y - a.y);
  // اتجاه الصفحة: عربية لو أغلب الحروف عربية
  const pageRtl = isRtlLine(items.map((i) => i.str).join(''));
  return rows.map((r) => rowToText(r.items, r.h, pageRtl)).filter(Boolean);
}
