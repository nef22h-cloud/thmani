import { Link } from 'react-router-dom';
import ProgressBar from './ProgressBar.jsx';
import StatusBadge from './StatusBadge.jsx';
import { categoryById } from '../lib/constants.js';
import { daysLabel } from '../lib/dates.js';
import { formatMoney } from '../lib/format.js';
import { daysUntil, getStatus, remainingRatio, urgencyLevel } from '../lib/warranty.js';

export default function WarrantyCard({ warranty: w, settings }) {
  const status = getStatus(w, settings);
  const left = daysUntil(w.expiryDate);
  const level = urgencyLevel(left, settings.expiringThresholdDays);
  const cat = categoryById(w.category);
  const returnLeft = daysUntil(w.returnDeadline);

  return (
    <Link to={`/w/${w.id}`} className="card block p-4 transition active:scale-[0.99]">
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl dark:bg-slate-800" aria-hidden>
          {cat.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-semibold">{w.productName}</h3>
            <StatusBadge status={status} />
          </div>
          <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
            {w.storeName || 'بدون متجر'}
            {w.price != null && <span className="num"> · {formatMoney(w.price)}</span>}
          </p>
        </div>
      </div>

      {status !== 'claimed' && (
        <div className="mt-4">
          <ProgressBar ratio={remainingRatio(w)} level={level} />
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className={`font-semibold ${left !== null && left < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
              {remainingText(left)}
            </span>
            {returnLeft !== null && returnLeft >= 0 && (
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                الاسترجاع: {returnLeft === 0 ? 'آخر يوم' : `باقي ${daysLabel(returnLeft)}`}
              </span>
            )}
          </div>
        </div>
      )}
    </Link>
  );
}

export function remainingText(left) {
  if (left === null) return 'بدون ضمان';
  if (left < 0) return `انتهى قبل ${daysLabel(left)}`;
  if (left === 0) return 'ينتهي اليوم';
  return `باقي ${daysLabel(left)}`;
}
