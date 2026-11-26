import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import BackupCard from '../components/BackupCard.jsx';
import LockCard from '../components/LockCard.jsx';
import { BellIcon } from '../components/Icons.jsx';
import { useSettings } from '../hooks/useSettings.jsx';
import { daysLabel, formatHijri, toISODate, today } from '../lib/dates.js';
import { checkReminders, notificationsSupported, requestNotificationPermission, sendTestNotification } from '../services/pwa.js';

export default function Settings() {
  const { settings, update } = useSettings();
  const [permission, setPermission] = useState(() => (notificationsSupported() ? Notification.permission : 'unsupported'));

  const { hash } = useLocation();
  useEffect(() => {
    if (hash === '#backup') document.getElementById('backup')?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);

  useEffect(() => {
    if (settings.notificationsEnabled && permission === 'granted') checkReminders();
  }, [settings.notificationsEnabled, permission]);

  async function toggleNotifications(on) {
    if (!on) return update({ notificationsEnabled: false });
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') {
      await update({ notificationsEnabled: true });
      checkReminders();
    }
  }

  return (
    <>
      <PageHeader title="الإعدادات" />
      <div className="space-y-4 px-4">
        <Card title="التنبيهات">
          <Toggle
            label="تفعيل التنبيهات"
            description={permissionHint(permission)}
            checked={settings.notificationsEnabled && permission === 'granted'}
            disabled={permission === 'unsupported' || permission === 'denied'}
            onChange={toggleNotifications}
          />
          {settings.notificationsEnabled && permission === 'granted' && (
            <>
              <DaysEditor
                label="نبّهني قبل انتهاء الضمان بـ"
                values={settings.warrantyReminderDays}
                onChange={(v) => update({ warrantyReminderDays: v })}
              />
              <DaysEditor
                label="نبّهني قبل انتهاء مدة الاسترجاع بـ"
                values={settings.returnReminderDays}
                onChange={(v) => update({ returnReminderDays: v })}
              />
              <button className="btn-secondary w-full" onClick={sendTestNotification}>
                <BellIcon className="size-5" />
                جرّب إشعار
              </button>
            </>
          )}
        </Card>

        <div id="backup" className="scroll-mt-4">
          <BackupCard />
        </div>

        <LockCard />

        <Card title="العرض">
          <div>
            <p className="label">المظهر</p>
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {[
                ['system', 'تلقائي'],
                ['light', 'فاتح'],
                ['dark', 'ليلي'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => update({ theme: id })}
                  className={`min-h-11 rounded-lg text-sm font-medium ${settings.theme === id ? 'bg-white shadow-sm dark:bg-slate-950' : 'text-slate-600 dark:text-slate-400'}`}
                  aria-pressed={settings.theme === id}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Toggle
            label="عرض التاريخ الهجري"
            description={`مثلاً: اليوم ${formatHijri(toISODate(today()))}`}
            checked={settings.showHijri}
            onChange={(v) => update({ showHijri: v })}
          />
          <label className="block">
            <span className="label">اعتبر الضمان "قرب ينتهي" إذا باقي أقل من</span>
            <select className="input" value={settings.expiringThresholdDays} onChange={(e) => update({ expiringThresholdDays: Number(e.target.value) })}>
              {[7, 14, 30, 60, 90].map((d) => (
                <option key={d} value={d}>{daysLabel(d)}</option>
              ))}
            </select>
          </label>
        </Card>


        <p className="pb-4 text-center text-xs text-slate-400">ضماني · الإصدار 1.0 · بياناتك محفوظة على جهازك فقط</p>
      </div>
    </>
  );
}

function permissionHint(p) {
  if (p === 'unsupported') return 'المتصفح ما يدعم الإشعارات. على الآيفون: ثبّت التطبيق على الشاشة الرئيسية أولاً (iOS 16.4+).';
  if (p === 'denied') return 'الإشعارات مرفوضة. فعّلها من إعدادات المتصفح للموقع.';
  return 'تنبيهات قبل انتهاء الضمان ومدة الاسترجاع';
}

function Card({ title, children }) {
  return (
    <section className="card space-y-4 p-4">
      <h2 className="font-bold">{title}</h2>
      {children}
    </section>
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

const PRESETS = [1, 3, 7, 14, 30, 60];

function DaysEditor({ label, values, onChange }) {
  const set = new Set(values);
  const toggle = (d) => {
    const next = set.has(d) ? values.filter((v) => v !== d) : [...values, d];
    onChange(next.sort((a, b) => b - a));
  };
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((d) => (
          <button
            key={d}
            onClick={() => toggle(d)}
            aria-pressed={set.has(d)}
            className={`min-h-10 rounded-full px-4 text-sm font-medium ring-1 ${set.has(d) ? 'bg-brand-700 text-white ring-brand-700 dark:bg-brand-600' : 'ring-slate-300 dark:ring-slate-700'}`}
          >
            {daysLabel(d)}
          </button>
        ))}
      </div>
    </div>
  );
}
