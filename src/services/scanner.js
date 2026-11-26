// قراءة QR والباركود من الكاميرا أو من صورة، باستخدام @zxing/browser.
// المكتبة تُحمَّل عند الحاجة فقط (dynamic import) عشان ما تكبّر التحميل الأول.

let zxingPromise;
const loadZxing = () =>
  // ملاحظة: @zxing/library فيها كلاس قديم بنفس اسم BrowserMultiFormatReader، فنخلي نسخة @zxing/browser هي الغالبة
  (zxingPromise ??= Promise.all([import('@zxing/browser'), import('@zxing/library')]).then(([browser, lib]) => ({ ...lib, ...browser })));

export const QR_FORMATS = ['QR_CODE'];
export const PRODUCT_FORMATS = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128', 'CODE_39', 'CODE_93', 'ITF', 'CODABAR'];

async function createReader(formats) {
  const z = await loadZxing();
  const hints = new Map();
  hints.set(z.DecodeHintType.POSSIBLE_FORMATS, formats.map((f) => z.BarcodeFormat[f]));
  hints.set(z.DecodeHintType.TRY_HARDER, true);
  return new z.BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
}

/**
 * يشغّل الكاميرا الخلفية ويقرأ باستمرار.
 * onResult(text, format) يُستدعى مع كل قراءة ناجحة.
 * يرجع { stop() }.
 */
export async function startCameraScan(video, formats, onResult) {
  const reader = await createReader(formats);
  const controls = await reader.decodeFromConstraints(
    {
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    },
    video,
    (result) => {
      if (result) onResult(result.getText(), result.getBarcodeFormat());
    }
  );
  return controls;
}

/**
 * يقرأ QR/باركود من ملف صورة. يرجع النص أو null.
 * صور الجوال كبيرة وفيها الكود صغير، فنجرب بالترتيب:
 * قارئ الجهاز المدمج (لو متوفر) ← الصورة كاملة بمقاسات مختلفة ← قصّات (أرباع ونص) بدقتها الأصلية.
 */
export async function scanImage(blob, formats) {
  let bmp;
  try {
    bmp = await createImageBitmap(blob);
  } catch {
    return null;
  }
  try {
    const native = await nativeDetect(bmp, formats);
    if (native) return native;
    const reader = await createReader(formats);
    const { width: W, height: H } = bmp;
    const attempts = [
      [0, 0, 1, 1, 2400],
      [0, 0, 1, 1, 1200],
      [0, 0, 1, 1, 800],
      // أرباع متداخلة (QR الفاتورة غالباً في زاوية)
      [0, 0, 0.6, 0.6, 1600],
      [0.4, 0, 0.6, 0.6, 1600],
      [0, 0.4, 0.6, 0.6, 1600],
      [0.4, 0.4, 0.6, 0.6, 1600],
      [0, 0, 1, 0.55, 2000],
      [0, 0.45, 1, 0.55, 2000],
      [0.2, 0.2, 0.6, 0.6, 1600],
    ];
    for (const [x, y, w, h, max] of attempts) {
      const canvas = crop(bmp, x * W, y * H, w * W, h * H, max);
      try {
        return reader.decodeFromCanvas(canvas).getText();
      } catch {
        /* نجرب اللي بعده */
      }
      // نعطي المتصفح فرصة يتنفس بين المحاولات
      await new Promise((r) => setTimeout(r, 0));
    }
    return null;
  } finally {
    bmp.close?.();
  }
}

function crop(bmp, sx, sy, sw, sh, max) {
  const s = Math.min(2, max / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.round(sw * s);
  c.height = Math.round(sh * s);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}

const NATIVE_FORMATS = { QR_CODE: 'qr_code', EAN_13: 'ean_13', EAN_8: 'ean_8', UPC_A: 'upc_a', UPC_E: 'upc_e', CODE_128: 'code_128', CODE_39: 'code_39', CODE_93: 'code_93', ITF: 'itf', CODABAR: 'codabar' };

/** BarcodeDetector المدمج في كروم أندرويد (أقوى مع صور الكاميرا) */
async function nativeDetect(bmp, formats) {
  if (!('BarcodeDetector' in window)) return null;
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    const wanted = formats.map((f) => NATIVE_FORMATS[f]).filter((f) => supported.includes(f));
    if (!wanted.length) return null;
    const codes = await new window.BarcodeDetector({ formats: wanted }).detect(bmp);
    return codes[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}

/** يلتقط إطار من الفيديو كصورة (نستخدمه كصورة للفاتورة/المنتج) */
export function captureFrame(video, quality = 0.85) {
  if (!video?.videoWidth) return Promise.resolve(null);
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  return new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
}

export function cameraErrorMessage(err) {
  const name = err?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'ما عندنا إذن للكاميرا. اسمح بالكاميرا من إعدادات المتصفح، أو اختر صورة من جهازك.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'ما لقينا كاميرا في الجهاز. اختر صورة بدلاً منها.';
  if (name === 'NotReadableError') return 'الكاميرا مستخدمة في تطبيق ثاني. سكّره وحاول مرة ثانية.';
  if (!window.isSecureContext) return 'الكاميرا تحتاج اتصال آمن (HTTPS).';
  return 'ما قدرنا نشغّل الكاميرا. اختر صورة بدلاً منها.';
}
