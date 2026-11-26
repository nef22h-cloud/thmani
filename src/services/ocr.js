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

/**
 * تحسين الصورة قبل القراءة:
 * - تكبير/تصغير لحجم مناسب للخط الصغير
 * - تسوية الإضاءة: نقدّر الخلفية (ظل، انعكاس، طيّة) بنسخة مغبّشة ونقسم عليها
 * - تمديد التباين
 */
async function preprocess(blob) {
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const longSide = Math.max(bmp.width, bmp.height);
  // صور الكاميرا: 2400–3000 بكسل (الخط في الفاتورة صغير). الصور الصغيرة (لقطات شاشة): 1200 على الأقل بدون تكبير زايد
  const target = longSide < 1600 ? Math.max(longSide, 1200) : Math.min(Math.max(longSide, 2400), 3000);
  const scale = target / longSide;
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);

  // الخلفية: تصغير شديد ثم تكبير = تغبيش رخيص يشتغل على كل المتصفحات
  const bw = Math.max(8, Math.round(w / 24));
  const bh = Math.max(8, Math.round(h / 24));
  const small = document.createElement('canvas');
  small.width = bw;
  small.height = bh;
  const sctx = small.getContext('2d');
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(canvas, 0, 0, bw, bh);
  const bg = document.createElement('canvas');
  bg.width = w;
  bg.height = h;
  const bgctx = bg.getContext('2d', { willReadFrequently: true });
  bgctx.imageSmoothingQuality = 'high';
  bgctx.drawImage(small, 0, 0, w, h);

  const img = ctx.getImageData(0, 0, w, h);
  const back = bgctx.getImageData(0, 0, w, h).data;
  const d = img.data;
  const lum = (a, i) => 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
  for (let i = 0; i < d.length; i += 4) {
    const g = lum(d, i);
    const b = Math.max(lum(back, i), 1);
    // نسبة البكسل للخلفية: الورق ≈ 1، الحبر أقل بكثير
    const r = Math.min(1.2, g / b);
    const v = Math.max(0, Math.min(255, (r - 0.35) * (255 / 0.65)));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  bmp.close?.();
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
