import { useEffect, useRef, useState } from 'react';
import { cameraErrorMessage, captureFrame, scanImage, startCameraScan } from '../services/scanner.js';
import { compressImage } from '../lib/image.js';
import { ImageIcon } from './Icons.jsx';

/**
 * كاميرا بإطار تصويب + زر "اختر صورة".
 * onDetect(text, imageBlob) — ترجع true لو قبلت القراءة (نوقف الكاميرا)، false نكمل المسح.
 * shape: 'square' للـ QR، 'wide' للباركود
 */
export default function CameraScanner({ formats, onDetect, shape = 'square', hint }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const busyRef = useRef(false);
  const fileRef = useRef(null);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(true);
  const [fileMsg, setFileMsg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const controls = await startCameraScan(videoRef.current, formats, async (text) => {
          if (busyRef.current) return;
          busyRef.current = true;
          const frame = await captureFrame(videoRef.current);
          const accepted = await onDetect(text, frame);
          if (accepted) controlsRef.current?.stop();
          else setTimeout(() => (busyRef.current = false), 1200);
        });
        if (cancelled) controls.stop();
        else controlsRef.current = controls;
      } catch (e) {
        if (!cancelled) setError(cameraErrorMessage(e));
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileMsg('جاري القراءة…');
    const text = await scanImage(file, formats);
    if (!text) {
      setFileMsg('ما قدرنا نقرأ الرمز من الصورة. جرّب صورة أوضح وأقرب.');
      return;
    }
    busyRef.current = true;
    const accepted = await onDetect(text, await compressImage(file));
    if (accepted) controlsRef.current?.stop();
    else {
      busyRef.current = false;
      setFileMsg(null);
    }
  }

  const frame = shape === 'wide' ? 'aspect-[2.2/1] w-[85%]' : 'aspect-square w-[70%]';

  return (
    <div className="space-y-4">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-black">
        <video ref={videoRef} className="size-full object-cover" muted playsInline />
        {!error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className={`${frame} relative rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] ring-4 ring-white/90`}>
              <div className="scan-line h-0.5 w-full bg-brand-400 shadow-[0_0_12px_2px] shadow-brand-400" />
            </div>
          </div>
        )}
        {starting && !error && <p className="absolute inset-x-0 top-1/2 text-center text-white/80">جاري تشغيل الكاميرا…</p>}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-white">
            <p>{error}</p>
          </div>
        )}
        {hint && !error && (
          <p className="absolute inset-x-0 bottom-4 px-4 text-center text-sm font-medium text-white drop-shadow">{hint}</p>
        )}
      </div>

      <button type="button" className="btn-secondary w-full" onClick={() => fileRef.current.click()}>
        <ImageIcon className="size-5" />
        اختر صورة من جهازك
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      {fileMsg && <p className="text-center text-sm text-slate-600 dark:text-slate-400">{fileMsg}</p>}
    </div>
  );
}
