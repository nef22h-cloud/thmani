import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../components/PageHeader.jsx';
import ClaimItem from '../components/ClaimItem.jsx';
import { ClaimIcon } from '../components/Icons.jsx';
import { listClaims } from '../db/claimRepo.js';
import { listWarranties } from '../db/warrantyRepo.js';
import { useSettings } from '../hooks/useSettings.jsx';
import { isClaimOpen, sortClaims } from '../lib/claims.js';
import { formatMoney } from '../lib/format.js';

const FILTERS = [
  ['all', 'الكل'],
  ['open', 'المفتوحة'],
  ['closed', 'المغلقة'],
];

export default function Claims() {
  const { settings } = useSettings();
  const claims = useLiveQuery(listClaims, []);
  const warranties = useLiveQuery(listWarranties, []);
  const [filter, setFilter] = useState('all');

  const names = useMemo(() => new Map((warranties ?? []).map((w) => [w.id, w.productName])), [warranties]);
  const list = useMemo(() => {
    const all = sortClaims(claims ?? []);
    if (filter === 'open') return all.filter(isClaimOpen);
    if (filter === 'closed') return all.filter((c) => !isClaimOpen(c));
    return all;
  }, [claims, filter]);

  if (claims === undefined || warranties === undefined) return null;

  const open = claims.filter(isClaimOpen).length;
  const resolved = claims.filter((c) => c.status === 'resolved').length;
  const cost = claims.reduce((s, c) => s + (c.cost ?? 0), 0);

  return (
    <>
      <PageHeader title="سجل المطالبات" />
      <div className="space-y-4 px-4">
        {claims.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-10 text-center">
            <span className="mb-3 flex size-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <ClaimIcon className="size-8 text-slate-400" />
            </span>
            <h2 className="text-lg font-bold">ما فيه مطالبات</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              لما يخرب جهاز وتروح للمتجر أو الوكيل، افتح الضمان من الرئيسية واضغط <strong>«سجّل مطالبة»</strong> عشان تتابعها هنا.
            </p>
            <Link to="/" className="btn-secondary mt-5">
              اختر ضمان
            </Link>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-3 gap-3">
              <Stat label="مفتوحة" value={open} tone="text-amber-600 dark:text-amber-400" />
              <Stat label="انحلّت" value={resolved} tone="text-emerald-600 dark:text-emerald-400" />
              <Stat label="دفعت (ر.س)" value={formatMoney(cost).replace(' ر.س', '')} />
            </section>
            <div className="flex gap-2">
              {FILTERS.map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  aria-pressed={filter === id}
                  className={`min-h-10 rounded-full px-4 text-sm font-medium ring-1 ${filter === id ? 'bg-brand-700 text-white ring-brand-700 dark:bg-brand-600' : 'ring-slate-300 dark:ring-slate-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {list.length === 0 ? (
              <p className="py-8 text-center text-slate-500">ما فيه مطالبات بهذا التصنيف</p>
            ) : (
              <section className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
                {list.map((c) => (
                  <ClaimItem key={c.id} claim={c} product={names.get(c.warrantyId) ?? 'ضمان محذوف'} hijri={settings.showHijri} />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, tone = '' }) {
  return (
    <div className="card px-3 py-3 text-center">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
