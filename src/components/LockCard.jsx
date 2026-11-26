import { useEffect, useState } from 'react';
import { useSettings } from '../hooks/useSettings.jsx';
import { isWeakPin, verifyPin } from '../lib/pin.js';
import { biometricAvailable, registerBiometric } from '../services/biometric.js';
import { changePin, disableLock, enableLock, updateLock } from '../services/lock.js';
import PinPad from './PinPad.jsx';
import { LockIcon, XIcon } from './Icons.jsx';

const TIMEOUTS = [
  [0, 'فوراً'],
  [1, 'بعد دقيقة'],
  [5, 'بعد 5 دقائق'],
  [15, 'بعد ربع ساعة'],
];

export default function LockCard() {
  const { settings } = useSettings();
  const lock = settings.lock?.enabled ? settings.lock : null;
  const [bioOk, setBioOk] = useState(false);
  const [flow, setFlow] = useState(null); // 'enable' | 'change' | 'disable'
  const [message, setMessage] = useState(null);

  useEffect(() => {
    biometricAvailable().then(setBioOk);
  }, []);

  const flash = (m) => {
    setMessage(m);
    setTimeout(() => setMessage(null), 3500);
  };

  async function toggleBiometric(on) {
    if (!on) return updateLock({ credentialId: null });
    try {
      const credentialId = await registerBiometric();
      await updateLock({ credentialId });
      flash('تم تفعيل الفتح بالبصمة / Face ID');
    } catch (e) {
      if (e?.name !== 'NotAllowedError') console.error(e);
      flash('ما تم التفعيل. تأكد إن البصمة أو Face ID مفعّلة في الجوال.');
    }
  }

  return (
    <section className="card space-y-4 p-4">
      <div>
        <h2 className="font-bold">قفل التطبيق</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">رمز سري (وبصمة أو Face ID) يمنع أي أحد يفتح فواتيرك من جوالك.</p>
      </div>

      <Toggle
        label="قفل برمز سري"
        description={lock ? `مفعّل · ${lock.pinLength} أرقام` : 'غير مفعّل'}
        checked={Boolean(lock)}
        onChange={(on) => setFlow(on ? 'enable' : 'disable')}
      />

      {lock && (
        <>
          <Toggle
            label="الفتح بالبصمة / Face ID"
            description={bioOk ? 'بدال ما تكتب الرمز كل مرة' : 'جهازك أو متصفحك ما يدعمها'}
            checked={Boolean(lock.credentialId)}
            disabled={!bioOk && !lock.credentialId}
            onChange={toggleBiometric}
          />
          <label className="block">
            <span className="label">يقفل لما تطلع من التطبيق</span>
            <select className="input" value={lock.timeoutMin ?? 0} onChange={(e) => updateLock({ timeoutMin: Number(e.target.value) })}>
              {TIMEOUTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-secondary w-full" onClick={() => setFlow('change')}>
            تغيير الرمز
          </button>
        </>
      )}

      <p className="text-xs text-slate-400">ملاحظة: القفل يحمي التطبيق من الفتح، والبيانات نفسها محفوظة في الجهاز بدون تشفير.</p>
      {message && <p className="rounded-xl bg-slate-100 px-3 py-2 text-center text-sm dark:bg-slate-800">{message}</p>}

      {flow && (
        <PinFlow
          mode={flow}
          lock={lock}
          bioOk={bioOk}
          onDone={(m) => {
            setFlow(null);
            if (m) flash(m);
          }}
          onCancel={() => setFlow(null)}
        />
      )}
    </section>
  );
}

/** خطوات إدخال الرمز: تفعيل (رمز + تأكيد + بصمة اختيارية)، تغيير (القديم + جديد + تأكيد)، إيقاف (القديم) */
function PinFlow({ mode, lock, bioOk, onDone, onCancel }) {
  const firstStep = mode === 'enable' ? 'new' : 'current';
  const [step, setStep] = useState(firstStep); // current | new | confirm | biometric
  const [length, setLength] = useState(4);
  const [first, setFirst] = useState('');
  const [error, setError] = useState(null);
  const [errorKey, setErrorKey] = useState(0);
  const [newPin, setNewPin] = useState(null);

  const fail = (m) => {
    setError(m);
    setErrorKey((k) => k + 1);
  };

  async function onComplete(pin) {
    setError(null);
    if (step === 'current') {
      if (!(await verifyPin(pin, lock))) return fail('الرمز غلط');
      if (mode === 'disable') {
        await disableLock();
        return onDone('تم إيقاف القفل');
      }
      setStep('new');
      return;
    }
    if (step === 'new') {
      if (isWeakPin(pin)) return fail('رمز سهل التخمين، اختر غيره');
      setFirst(pin);
      setStep('confirm');
      return;
    }
    if (step === 'confirm') {
      if (pin !== first) {
        setStep('new');
        return fail('الرمزين مو متطابقين، أعد المحاولة');
      }
      if (mode === 'change') {
        await changePin(pin);
        return onDone('تم تغيير الرمز');
      }
      if (bioOk) {
        setNewPin(pin);
        setStep('biometric');
        return;
      }
      await enableLock(pin);
      return onDone('تم تفعيل القفل');
    }
  }

  async function finishWithBiometric(useBio) {
    let credentialId = null;
    if (useBio) {
      try {
        credentialId = await registerBiometric();
      } catch {
        /* نكمل بالرمز بس */
      }
    }
    await enableLock(newPin, { credentialId });
    onDone(credentialId ? 'تم تفعيل القفل بالرمز والبصمة' : 'تم تفعيل القفل');
  }

  const titles = {
    current: mode === 'disable' ? 'أدخل الرمز لإيقاف القفل' : 'أدخل الرمز الحالي',
    new: mode === 'change' ? 'اختر رمز جديد' : 'اختر رمز سري',
    confirm: 'أعد كتابة الرمز للتأكيد',
    biometric: 'تبي تفتح بالبصمة / Face ID؟',
  };
  const padLength = step === 'current' ? lock?.pinLength ?? 4 : step === 'confirm' ? first.length : length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-950" role="dialog" aria-modal="true" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex justify-end p-3">
        <button onClick={onCancel} className="flex size-11 items-center justify-center rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800" aria-label="إلغاء">
          <XIcon />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10">
        <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-700 text-white dark:bg-brand-600">
          <LockIcon className="size-7" />
        </span>
        <h2 className="mb-8 text-center text-xl font-bold">{titles[step]}</h2>
        {step === 'biometric' ? (
          <div className="w-full max-w-xs space-y-3">
            <button className="btn-primary w-full" onClick={() => finishWithBiometric(true)}>
              فعّل البصمة / Face ID
            </button>
            <button className="btn-secondary w-full" onClick={() => finishWithBiometric(false)}>
              لا، الرمز يكفي
            </button>
          </div>
        ) : (
          <>
            <PinPad key={`${step}-${padLength}-${errorKey}`} length={padLength} onComplete={onComplete} error={error} />
            {step === 'new' && (
              <button type="button" className="mt-6 text-sm font-medium text-brand-700 dark:text-brand-400" onClick={() => setLength((l) => (l === 4 ? 6 : 4))}>
                {length === 4 ? 'استخدم 6 أرقام بدال 4' : 'استخدم 4 أرقام'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, description, checked, disabled, onChange }) {
  return (
    <label className={`flex items-center justify-between gap-4 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <span>
        <span className="block font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">{description}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="relative h-8 w-14 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400 after:absolute after:top-1 after:right-1 after:size-6 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:-translate-x-6 dark:bg-slate-700" />
    </label>
  );
}
