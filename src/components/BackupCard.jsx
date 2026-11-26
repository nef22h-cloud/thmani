import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db.js';
import { useSettings } from '../hooks/useSettings.jsx';
import { BackupError } from '../lib/backup.js';
import { formatDate } from '../lib/dates.js';
import { createBackupFile, markBackupDone, readBackupFile, restoreBackup, saveBackupFile } from '../services/backup.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import Toast from './Toast.jsx';
import { DownloadIcon, UploadIcon } from './Icons.jsx';

export default function BackupCard() {
  const { settings } = useSettings();
  const counts = useLiveQuery(async () => ({ warranties: await db.warranties.count(), images: await db.images.count() }), []);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(null); // 'export' | 'import'
  const [pending, setPending] = useState(null); // { data, summary } نسخة مختارة تنتظر التأكيد
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [toast, setToast] = useState(null);

  const flash = (message, tone = 'info') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3500);
  };

  async function onExport() {
    setBusy('export');
    try {
      const { file, summary } = await createBackupFile();
      const how = await saveBackupFile(file);
      if (how === 'cancelled') return;
      await markBackupDone();
      flash(`تم حفظ نسخة فيها ${countLabel(summary.warranties, 'ضمان')} و${countLabel(summary.images, 'صورة')}`);
    } catch (err) {
      console.error(err);
      flash('ما قدرنا نجهّز النسخة. حاول مرة ثانية.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPending(await readBackupFile(file));
    } catch (err) {
      flash(err instanceof BackupError ? err.message : 'ما قدرنا نقرأ الملف.', 'error');
    }
  }

  async function onRestore(mode) {
    const data = pending.data;
    setPending(null);
    setConfirmReplace(false);
    setBusy('import');
    try {
      const r = await restoreBackup(data, mode);
      const parts = [];
      if (r.added) parts.push(`أضفنا ${countLabel(r.added, 'ضمان')}`);
      if (r.updated) parts.push(`حدّثنا ${countLabel(r.updated, 'ضمان')}`);
      if (!parts.length) parts.push('كل الضمانات اللي في النسخة موجودة عندك أصلاً');
      flash(`تم الاسترجاع: ${parts.join('، ')}`);
    } catch (err) {
      console.error(err);
      flash('صار خطأ أثناء الاسترجاع وما تغيّر شي. حاول مرة ثانية.', 'error');
    } finally {
      setBusy(null);
    }
  }

  const hasData = (counts?.warranties ?? 0) > 0;

  return (
    <section className="card space-y-4 p-4">
      <div>
        <h2 className="font-bold">النسخة الاحتياطية</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          بياناتك محفوظة في هذا الجهاز بس. خذ نسخة واحفظها في الملفات أو iCloud، عشان لو غيّرت جوالك أو انمسحت بيانات المتصفح ترجّعها.
        </p>
      </div>

      <div className={`rounded-xl p-3 text-sm ${settings.lastBackupAt ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'}`}>
        {settings.lastBackupAt
          ? `آخر نسخة: ${formatDate(settings.lastBackupAt.slice(0, 10), { hijri: settings.showHijri })}`
          : hasData
            ? 'ما أخذت نسخة احتياطية للحين'
            : 'لا توجد بيانات للنسخ للحين'}
      </div>

      <button className="btn-primary w-full" onClick={onExport} disabled={!hasData || busy}>
        <DownloadIcon className="size-5" />
        {busy === 'export' ? 'نجهّز النسخة…' : 'خذ نسخة احتياطية'}
      </button>
      {hasData && (
        <p className="-mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
          {countLabel(counts.warranties, 'ضمان')} و{countLabel(counts.images, 'صورة')}
        </p>
      )}

      <button className="btn-secondary w-full" onClick={() => fileRef.current.click()} disabled={!!busy}>
        <UploadIcon className="size-5" />
        {busy === 'import' ? 'نسترجع…' : 'استرجع من نسخة'}
      </button>
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onFile} />

      {pending && !confirmReplace && (
        <RestoreDialog
          summary={pending.summary}
          hasData={hasData}
          showHijri={settings.showHijri}
          onMerge={() => onRestore('merge')}
          onReplace={() => (hasData ? setConfirmReplace(true) : onRestore('replace'))}
          onCancel={() => setPending(null)}
        />
      )}
      <ConfirmDialog
        open={confirmReplace}
        title="متأكد تبي تستبدل كل شي؟"
        message={`بنمسح ${countLabel(counts?.warranties ?? 0, 'ضمان')} الموجودة في الجهاز ونحط بدالها محتوى النسخة. ما تقدر تتراجع.`}
        confirmLabel="امسح واسترجع"
        danger
        onConfirm={() => onRestore('replace')}
        onCancel={() => {
          setConfirmReplace(false);
          setPending(null);
        }}
      />
      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </section>
  );
}

function RestoreDialog({ summary, hasData, showHijri, onMerge, onReplace, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="card w-full max-w-sm space-y-4 p-5" onClick={(e) => e.stopPropagation()} style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        <h2 className="text-lg font-bold">استرجاع النسخة</h2>
        <ul className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
          <li>• {countLabel(summary.warranties, 'ضمان')}</li>
          <li>• {countLabel(summary.images, 'صورة')}</li>
          {summary.exportedAt && <li>• تاريخ النسخة: {formatDate(summary.exportedAt.slice(0, 10), { hijri: showHijri })}</li>}
        </ul>
        {hasData ? (
          <>
            <button className="btn-primary w-full" onClick={onMerge}>
              ادمجها مع بياناتي
            </button>
            <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">نضيف الضمانات اللي مو عندك، ونحدّث اللي تعديلها في النسخة أحدث. ما نمسح شي.</p>
            <button className="btn w-full text-red-600 ring-1 ring-red-200 dark:text-red-400 dark:ring-red-900" onClick={onReplace}>
              استبدل كل البيانات
            </button>
          </>
        ) : (
          <button className="btn-primary w-full" onClick={onReplace}>
            استرجع
          </button>
        )}
        <button className="btn-secondary w-full" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </div>
  );
}

/** "ضمان واحد" / "ضمانين" / "3 ضمانات" / "11 ضمان" */
export function countLabel(n, word) {
  const forms = {
    'ضمان': ['ضمان واحد', 'ضمانين', 'ضمانات'],
    'صورة': ['صورة وحدة', 'صورتين', 'صور'],
  }[word];
  if (n === 0) return `0 ${word}`;
  if (n === 1) return forms[0];
  if (n === 2) return forms[1];
  if (n <= 10) return `${n} ${forms[2]}`;
  return `${n} ${word}`;
}
