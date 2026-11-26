export default function Toast({ message, tone = 'error' }) {
  if (!message) return null;
  const cls = tone === 'error' ? 'bg-red-600' : 'bg-slate-900 dark:bg-slate-700';
  return (
    <div className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md" role="status" aria-live="polite" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
      <p className={`${cls} rounded-2xl px-4 py-3 text-center font-medium text-white shadow-lg`}>{message}</p>
    </div>
  );
}
