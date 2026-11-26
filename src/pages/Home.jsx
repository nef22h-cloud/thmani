import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { listWarranties } from '../db/warrantyRepo.js';
import { useSettings } from '../hooks/useSettings.jsx';
import { needsBackupReminder } from '../lib/backup.js';
import { CATEGORIES, STATUS_LABELS } from '../lib/constants.js';
import { formatMoney } from '../lib/format.js';
import { getStatus, sortByExpiry, summarize } from '../lib/warranty.js';
import WarrantyCard from '../components/WarrantyCard.jsx';
import { CloudIcon, SearchIcon, ShieldIcon, XIcon } from '../components/Icons.jsx';

export default function Home() {
  const { settings, update } = useSettings();
  const warranties = useLiveQuery(listWarranties, []);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');

  const summary = useMemo(() => summarize(warranties ?? [], settings), [warranties, settings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (warranties ?? []).filter((w) => {
      if (status !== 'all' && getStatus(w, settings) !== status) return false;
      if (category !== 'all' && w.category !== category) return false;
      if (!q) return true;
      return [w.productName, w.storeName, w.storeBranch, w.serialNumber, w.barcode].some((f) => f?.toLowerCase().includes(q));
    });
    return sortByExpiry(list, settings);
  }, [warranties, settings, query, status, category]);

  const showBackupReminder = useMemo(
    () =>
      needsBackupReminder({
        count: warranties?.length ?? 0,
        lastBackupAt: settings.lastBackupAt,
        dismissedAt: settings.backupReminderDismissedAt,
        lastChangeAt: (warranties ?? []).reduce((m, w) => (w.updatedAt > m ? w.updatedAt : m), ''),
      }),
    [warranties, settings.lastBackupAt, settings.backupReminderDismissedAt]
  );

  if (warranties === undefined) return null; // يحمّل

  return (
    <div className="px-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
      <header className="mb-5 flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-brand-700 text-white dark:bg-brand-600">
          <ShieldIcon />
        </div>
        <div>
          <h1 className="text-2xl font-bold">ضماني</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">فواتيرك وضماناتك في مكان واحد</p>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-3" aria-label="ملخص">
        <Stat label="ضمان ساري" value={summary.active} tone="text-emerald-600 dark:text-emerald-400" />
        <Stat label="قرب ينتهي" value={summary.expiring} tone="text-amber-600 dark:text-amber-400" />
        <Stat label="قيمة المضمون" value={formatMoney(summary.totalValue).replace(' ر.س', '')} unit="ر.س" />
      </section>

      {showBackupReminder && (
        <BackupReminder neverBackedUp={!settings.lastBackupAt} onDismiss={() => update({ backupReminderDismissedAt: new Date().toISOString() })} />
      )}

      {warranties.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="relative mt-6">
            <SearchIcon className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث باسم المنتج أو المتجر أو الرقم التسلسلي"
              className="input pr-11"
            />
          </div>

          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip active={status === 'all'} onClick={() => setStatus('all')}>الكل</Chip>
            {Object.entries(STATUS_LABELS).map(([id, label]) => (
              <Chip key={id} active={status === id} onClick={() => setStatus(id)}>
                {id === 'claimed' ? 'مطالبة' : label}
              </Chip>
            ))}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="shrink-0 rounded-full bg-white px-3 py-2 text-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
              aria-label="التصنيف"
            >
              <option value="all">كل التصنيفات</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <section className="mt-4 space-y-3">
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-slate-500">ما فيه نتائج مطابقة</p>
            ) : (
              filtered.map((w) => <WarrantyCard key={w.id} warranty={w} settings={settings} />)
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, unit, tone = '' }) {
  return (
    <div className="card p-3 text-center">
      <p className={`num truncate text-2xl font-bold ${tone}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        {label}
        {unit && <span> ({unit})</span>}
      </p>
    </div>
  );
}

function Chip({ active, children, ...props }) {
  return (
    <button
      {...props}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? 'bg-brand-700 text-white dark:bg-brand-600'
          : 'bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="card mt-6 flex flex-col items-center px-6 py-10 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
        <ShieldIcon className="size-8" />
      </div>
      <h2 className="mt-4 text-lg font-bold">ما أضفت أي ضمان للحين</h2>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        أضف أول فاتورة، وضماني بيحسب لك المدة وينبهك قبل ما ينتهي الضمان.
      </p>
      <Link to="/add" className="btn-primary mt-6 w-full">أضف أول ضمان</Link>
    </div>
  );
}

function BackupReminder({ neverBackedUp, onDismiss }) {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-sky-50 p-3 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:ring-sky-900">
      <CloudIcon className="size-6 shrink-0 text-sky-700 dark:text-sky-300" />
      <Link to="/settings#backup" className="flex-1 text-sm text-sky-900 dark:text-sky-100">
        <span className="block font-semibold">{neverBackedUp ? 'خذ نسخة احتياطية' : 'عندك تعديلات ما انحفظت في نسخة'}</span>
        <span className="block text-sky-800/80 dark:text-sky-200/80">عشان ما تضيع فواتيرك لو غيّرت جوالك</span>
      </Link>
      <button onClick={onDismiss} className="flex size-9 items-center justify-center rounded-full text-sky-700 dark:text-sky-300" aria-label="إخفاء التذكير">
        <XIcon className="size-5" />
      </button>
    </div>
  );
}
