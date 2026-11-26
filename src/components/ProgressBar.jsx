const COLORS = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-500',
};

/** شريط المتبقي من الضمان. يتناقص من اليمين لليسار */
export default function ProgressBar({ ratio, level }) {
  const pct = Math.round(ratio * 100);
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="المتبقي من الضمان"
    >
      <div className={`h-full rounded-full transition-all ${COLORS[level]}`} style={{ width: `${Math.max(pct, ratio > 0 ? 3 : 0)}%` }} />
    </div>
  );
}
