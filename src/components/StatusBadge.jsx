import { STATUS_LABELS } from '../lib/constants.js';

const STYLES = {
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  expiring: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  expired: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300',
  claimed: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
