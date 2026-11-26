export default function ConfirmDialog({ open, title, message, confirmLabel = 'تأكيد', danger, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()} style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        <h2 className="text-lg font-bold">{title}</h2>
        {message && <p className="mt-2 text-slate-600 dark:text-slate-400">{message}</p>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="btn-secondary" onClick={onCancel}>إلغاء</button>
          <button className={danger ? 'btn bg-red-600 text-white' : 'btn-primary'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
