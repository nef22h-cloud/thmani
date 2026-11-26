// قراءة نص الفاتورة من الصورة (Tesseract.js) بالعربي والإنجليزي.
//
// أول مرة تحتاج إنترنت لتحميل ملفات اللغة (~ 10MB)، وبعدها تنحفظ في الجهاز
// (IndexedDB + كاش الـ Service Worker) وتشتغل بدون نت.

let workerPromise = null;
let progressListener = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker(['ara', 'eng'], 1, {
        logger: (m) => progressListener?.(m),
      });
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

/** تحسين الصورة قبل القراءة: تدرّج رمادي + تباين + حجم مناسب */
async function preprocess(blob) {
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const longSide = Math.max(bmp.width, bmp.height);
  const scale = longSide > 2400 ? 2400 / longSide : longSide < 1200 ? 1200 / longSide : 1;
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // تمديد التباين البسيط
    const v = Math.max(0, Math.min(255, (gray - 128) * 1.4 + 128));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * onProgress({ stage: 'loading'|'recognizing', progress: 0..1 })
 * يرجع النص المقروء
 */
export async function recognizeInvoice(blob, onProgress) {
  progressListener = (m) => {
    if (m.status === 'recognizing text') onProgress?.({ stage: 'recognizing', progress: m.progress });
    else onProgress?.({ stage: 'loading', progress: m.progress ?? 0 });
  };
  try {
    const worker = await getWorker();
    const image = await preprocess(blob);
    const { data } = await worker.recognize(image);
    return data.text ?? '';
  } finally {
    progressListener = null;
  }
}
