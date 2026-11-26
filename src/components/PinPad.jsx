import { useEffect, useState } from 'react';
import { DeleteKeyIcon } from './Icons.jsx';

/**
 * لوحة إدخال الرمز.
 * length: عدد الأرقام (لما يكتمل نستدعي onComplete)
 * extraKey: زر اختياري مكان الخانة الفاضية (مثلاً البصمة)
 */
export default function PinPad({ length = 4, onComplete, error, disabled, extraKey, resetKey }) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  // تفريغ بعد خطأ (أو لما يتغير resetKey)
  useEffect(() => {
    setPin('');
    if (error) {
      setShake(true);
      navigator.vibrate?.(120);
      const t = setTimeout(() => setShake(false), 450);
      return () => clearTimeout(t);
    }
  }, [error, resetKey]);

  const press = (d) => {
    if (disabled || pin.length >= length) return;
    const next = pin + d;
    setPin(next);
    if (next.length === length) setTimeout(() => onComplete(next), 80);
  };

  // لوحة المفاتيح الفعلية (للكمبيوتر)
  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const key = 'flex h-16 items-center justify-center rounded-full text-2xl font-semibold active:bg-slate-200 disabled:opacity-40 dark:active:bg-slate-800';
  return (
    <div className="mx-auto w-full max-w-xs">
      <div className={`mb-3 flex justify-center gap-4 ${shake ? 'animate-[pin-shake_0.4s]' : ''}`} dir="ltr" aria-label={`أدخلت ${pin.length} من ${length}`}>
        {Array.from({ length }, (_, i) => (
          <span key={i} className={`size-4 rounded-full ring-2 transition ${i < pin.length ? 'bg-brand-700 ring-brand-700 dark:bg-brand-400 dark:ring-brand-400' : 'ring-slate-300 dark:ring-slate-600'}`} />
        ))}
      </div>
      <p className="mb-4 min-h-6 text-center text-sm font-medium text-red-600 dark:text-red-400" role="alert">
        {error}
      </p>
      <div className="grid grid-cols-3 gap-3" dir="ltr">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className={key} onClick={() => press(d)} disabled={disabled}>
            {d}
          </button>
        ))}
        {extraKey ?? <span />}
        <button type="button" className={key} onClick={() => press('0')} disabled={disabled}>
          0
        </button>
        <button type="button" className={key} onClick={() => setPin((p) => p.slice(0, -1))} disabled={disabled || !pin} aria-label="مسح">
          <DeleteKeyIcon className="size-7" />
        </button>
      </div>
    </div>
  );
}
