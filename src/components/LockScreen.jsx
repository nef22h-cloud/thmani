import { useEffect, useRef, useState } from 'react';
import PinPad from './PinPad.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import { FingerprintIcon, LockIcon } from './Icons.jsx';
import { lockoutSeconds, verifyPin } from '../lib/pin.js';
import { verifyBiometric } from '../services/biometric.js';
import { resetAllData } from '../services/lock.js';

const FAILS_KEY = 'damani-lock-fails';
const readFails = () => {
  try {
    return JSON.parse(localStorage.getItem(FAILS_KEY)) ?? { count: 0, until: 0 };
  } catch {
    return { count: 0, until: 0 };
  }
};
const writeFails = (v) => {
  try {
    localStorage.setItem(FAILS_KEY, JSON.stringify(v));
  } catch {
    /* */
  }
};

export default function LockScreen({ lock, onUnlock }) {
  const [error, setError] = useState(null);
  const [errorKey, setErrorKey] = useState(0);
  const [fails, setFails] = useState(readFails);
  const [now, setNow] = useState(Date.now());
  const [checking, setChecking] = useState(false);
  const [forgot, setForgot] = useState(false);
  const autoTried = useRef(false);

  const waitSec = Math.max(0, Math.ceil((fails.until - now) / 1000));
  useEffect(() => {
    if (!waitSec) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [waitSec]);

  const success = () => {
    writeFails({ count: 0, until: 0 });
    onUnlock();
  };

  async function tryBiometric() {
    if (!lock.credentialId) return;
    if (await verifyBiometric(lock.credentialId)) success();
  }

  // نجرب البصمة/Face ID تلقائياً أول ما تنفتح الشاشة (لو المتصفح يسمح بدون ضغطة)
  useEffect(() => {
    if (autoTried.current || !lock.credentialId || waitSec) return;
    autoTried.current = true;
    tryBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onPin(pin) {
    setChecking(true);
    const ok = await verifyPin(pin, lock);
    setChecking(false);
    if (ok) return success();
    const count = fails.count + 1;
    const wait = lockoutSeconds(count);
    const next = { count, until: wait ? Date.now() + wait * 1000 : 0 };
    writeFails(next);
    setFails(next);
    setNow(Date.now());
    setError(wait ? `محاولات كثيرة. انتظر ${wait} ثانية` : `الرمز غلط${count >= 3 ? ` (المحاولة ${count})` : ''}`);
    setErrorKey((k) => k + 1);
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-6 dark:bg-slate-950" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <span className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-brand-700 text-white dark:bg-brand-600">
        <LockIcon className="size-8" />
      </span>
      <h1 className="text-2xl font-bold">ضماني مقفل</h1>
      <p className="mt-1 mb-8 text-slate-500 dark:text-slate-400">{waitSec ? `حاول بعد ${waitSec} ثانية` : 'أدخل الرمز'}</p>
      <PinPad
        key={errorKey}
        length={lock.pinLength ?? 4}
        onComplete={onPin}
        error={waitSec ? null : error}
        disabled={checking || waitSec > 0}
        extraKey={
          lock.credentialId ? (
            <button type="button" onClick={tryBiometric} className="flex h-16 items-center justify-center rounded-full text-brand-700 active:bg-slate-200 dark:text-brand-400 dark:active:bg-slate-800" aria-label="افتح بالبصمة أو Face ID">
              <FingerprintIcon className="size-8" />
            </button>
          ) : null
        }
      />
      <button type="button" className="mt-8 text-sm font-medium text-slate-500 underline-offset-4 hover:underline dark:text-slate-400" onClick={() => setForgot(true)}>
        نسيت الرمز؟
      </button>
      <ConfirmDialog
        open={forgot}
        title="نسيت الرمز؟"
        message="ما نقدر نسترجع الرمز لأنه محفوظ بشكل مشفّر. الحل الوحيد إنك تمسح كل بيانات التطبيق في هذا الجهاز وتبدأ من جديد، وبعدها تقدر تسترجع من نسخة احتياطية لو عندك."
        confirmLabel="امسح كل شي"
        danger
        onConfirm={resetAllData}
        onCancel={() => setForgot(false)}
      />
    </div>
  );
}
