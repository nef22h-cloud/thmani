// قراءة QR والباركود من الكاميرا أو من صورة، باستخدام @zxing/browser.
// المكتبة تُحمَّل عند الحاجة فقط (dynamic import) عشان ما تكبّر التحميل الأول.

let zxingPromise;
const loadZxing = () =>
  (zxingPromise ??= Promise.all([import('@zxing/browser'), import('@zxing/library')]).then(([browser, lib]) => ({ ...browser, ...lib })));

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

/** يقرأ QR/باركود من ملف صورة. يرجع النص أو null */
export async function scanImage(blob, formats) {
  const reader = await createReader(formats);
  const url = URL.createObjectURL(blob);
  try {
    const result = await reader.decodeFromImageUrl(url);
    return result.getText();
  } catch {
    // محاولة ثانية بصورة مصغّرة؛ الصور الكبيرة جداً أحياناً تفشل
    try {
      const small = await downscale(blob, 1200);
      const url2 = URL.createObjectURL(small);
      try {
        return (await reader.decodeFromImageUrl(url2)).getText();
      } finally {
        URL.revokeObjectURL(url2);
      }
    } catch {
      return null;
    }
  } finally {
    URL.revokeObjectURL(url);
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

async function downscale(blob, max) {
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

export function cameraErrorMessage(err) {
  const name = err?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'ما عندنا إذن للكاميرا. اسمح بالكاميرا من إعدادات المتصفح، أو اختر صورة من جهازك.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'ما لقينا كاميرا في الجهاز. اختر صورة بدلاً منها.';
  if (name === 'NotReadableError') return 'الكاميرا مستخدمة في تطبيق ثاني. سكّره وحاول مرة ثانية.';
  if (!window.isSecureContext) return 'الكاميرا تحتاج اتصال آمن (HTTPS).';
  return 'ما قدرنا نشغّل الكاميرا. اختر صورة بدلاً منها.';
}
