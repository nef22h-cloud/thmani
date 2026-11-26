import { Link } from 'react-router-dom';
import { claimDurationDays, claimOutcomeById, claimStatusById, isClaimOpen } from '../lib/claims.js';
import { daysLabel, formatDate, toISODate, today } from '../lib/dates.js';
import { formatMoney } from '../lib/format.js';

const CHIP = {
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300',
};

export function ClaimStatusChip({ status }) {
  const s = claimStatusById(status);
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${CHIP[s.tone]}`}>{s.label}</span>;
}

/** سطر مطالبة. product = اسم المنتج (يظهر في صفحة كل المطالبات) */
export default function ClaimItem({ claim, product, hijri }) {
  const outcome = claimOutcomeById(claim.outcome);
  const days = claimDurationDays(claim, toISODate(today()));
  const meta = [
    formatDate(claim.date, { hijri }),
    isClaimOpen(claim) ? (days ? `مفتوحة من ${daysLabel(days)}` : 'مفتوحة اليوم') : outcome?.label,
    claim.cost ? formatMoney(claim.cost) : null,
  ].filter(Boolean);
  return (
    <Link to={`/claims/${claim.id}`} className="block px-4 py-3 active:bg-slate-50 dark:active:bg-slate-800/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {product && <p className="truncate text-sm font-semibold">{product}</p>}
          <p className={`line-clamp-2 ${product ? 'text-sm text-slate-600 dark:text-slate-300' : 'font-medium'}`}>{claim.issue}</p>
        </div>
        <ClaimStatusChip status={claim.status} />
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{meta.join(' · ')}</p>
      {claim.referenceNumber && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          رقم الطلب: <span dir="ltr">{claim.referenceNumber}</span>
        </p>
      )}
    </Link>
  );
}
