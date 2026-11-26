import { createContext, useContext, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { loadSettings, updateSettings } from '../db/settingsRepo.js';
import { DEFAULT_SETTINGS } from '../lib/constants.js';

const SettingsContext = createContext({ settings: DEFAULT_SETTINGS, update: async () => {} });

export function SettingsProvider({ children }) {
  const loaded = useLiveQuery(loadSettings, []);
  const settings = loaded ?? DEFAULT_SETTINGS;

  // تطبيق الوضع الليلي (ننتظر تحميل الإعدادات عشان ما نطبق الافتراضي ونسبب وميض)
  useEffect(() => {
    if (!loaded) return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#020617' : '#0f766e');
    };
    apply();
    try {
      localStorage.setItem('damani-theme', settings.theme);
    } catch {
      /* التخزين غير متاح */
    }
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [loaded, settings.theme]);

  return <SettingsContext.Provider value={{ settings, update: updateSettings }}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
