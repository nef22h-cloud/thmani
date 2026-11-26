import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSettings } from './useSettings.jsx';
import { shouldLockAfter } from '../lib/pin.js';
import LockScreen from '../components/LockScreen.jsx';

const LockContext = createContext({ lockNow: () => {} });
export const useLock = () => useContext(LockContext);

/**
 * يقفل التطبيق لو القفل مفعّل: عند الفتح، وعند الرجوع له بعد مدة (حسب الإعداد).
 * لما يكون مقفل ما نرسم التطبيق أصلاً (عشان ما يبان شي حتى في صورة مبدّل التطبيقات).
 */
export function LockGate({ children }) {
  const { settings, ready } = useSettings();
  const lock = settings.lock;
  const enabled = Boolean(lock?.enabled && lock.hash);
  const [locked, setLocked] = useState(true);
  const hiddenAt = useRef(null);
  const timeoutMin = lock?.timeoutMin ?? 0;

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        if (enabled && timeoutMin === 0) setLocked(true); // نقفل فوراً قبل ما يصوّر النظام الشاشة
      } else if (enabled && shouldLockAfter(hiddenAt.current, Date.now(), timeoutMin)) {
        setLocked(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [enabled, timeoutMin]);

  const lockNow = useCallback(() => setLocked(true), []);

  if (!ready) return null; // ننتظر الإعدادات عشان ما يبان المحتوى لحظة قبل القفل
  if (enabled && locked) return <LockScreen lock={lock} onUnlock={() => setLocked(false)} />;
  return <LockContext.Provider value={{ lockNow }}>{children}</LockContext.Provider>;
}
