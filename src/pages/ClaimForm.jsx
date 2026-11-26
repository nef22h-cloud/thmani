import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../components/PageHeader.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { TrashIcon } from '../components/Icons.jsx';
import NotFound from './NotFound.jsx';
import { deleteClaim, getClaim, saveClaim } from '../db/claimRepo.js';
import { getWarranty } from '../db/warrantyRepo.js';
import { CLAIM_OUTCOMES, CLAIM_STATUS, outcomeEndsWarranty, validateClaim, normalizeClaim } from '../lib/claims.js';
import { toISODate, today } from '../lib/dates.js';

const TONES = {
  amber: 'bg-amber-500 ring-amber-500',
  sky: 'bg-sky-600 ring-sky-600',
  emerald: 'bg-emerald-600 ring-emerald-600',
  red: 'bg-red-600 ring-red-600',
};

/** /w/:id/claims/new (مطالبة جديدة) أو /claims/:cid (تعديل) */
export default function ClaimForm() {
  const { id: warrantyIdParam, cid } = useParams();
  const isEdit = Boolean(cid);
  const navigate = useNavigate();

  const claim = useLiveQuery(() => (isEdit ? getClaim(cid).then((c) => c ?? null) : Promise.resolve(undefined)), [cid]);
  const warrantyId = isEdit ? claim?.warrantyId : Number(warrantyIdParam);
  const warranty = useLiveQuery(() => (warrantyId ? getWarranty(warrantyId).then((w) => w ?? null) : undefined), [warrantyId]);

  const [form, setForm] = useState(null);
  const [markUsed, setMarkUsed] = useState(null); // null = نحددها تلقائياً من النتيجة
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // تعبئة النموذج أول ما توصل البيانات
  useEffect(() => {
    if (form || warranty === undefined) return;
    if (isEdit && !claim) return;
    setForm(
      isEdit
        ? { ...claim, cost: claim.cost ?? '', closedDate: claim.closedDate ?? '', outcome: claim.outcome ?? '' }
        : { warrantyId, date: toISODate(today()), issue: '', status: 'open', outcome: '', closedDate: '', referenceNumber: '', cost: '', notes: '' }
    );
  }, [claim, warranty, isEdit, warrantyId, form]);

  if ((isEdit && claim === null) || warranty === null) return <NotFound message="المطالبة غير موجودة" />;
  if (!form || !warranty) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const closed = form.status === 'resolved' || form.status === 'rejected';
  // الاستبدال/الاسترجاع ينهي الضمان غالباً، فنقترح تعليمه كمستخدم (والمستخدم يقدر يغيّر)
  const suggestedUsed = form.status === 'resolved' && outcomeEndsWarranty(form.outcome);
  const usedValue = markUsed ?? (suggestedUsed || Boolean(warranty.claimed));

  async function onSubmit(e) {
    e.preventDefault();
    const data = normalizeClaim(form);
    const errs = validateClaim(data);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await saveClaim(data, { markWarrantyUsed: usedValue });
      navigate(`/w/${warranty.id}`, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    await deleteClaim(claim.id);
    navigate(`/w/${warranty.id}`, { replace: true });
  }

  return (
    <>
      <PageHeader title={isEdit ? 'تعديل المطالبة' : 'مطالبة جديدة'} back />
      <form onSubmit={onSubmit} className="space-y-4 px-4" noValidate>
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm dark:bg-slate-800/70">
          ضمان: <strong>{warranty.productName}</strong>
          {warranty.storeName && <span className="text-slate-500 dark:text-slate-400"> · {warranty.storeName}</span>}
        </p>

        <section className="card space-y-4 p-4">
          <label className="block">
            <span className="label">وش المشكلة؟ *</span>
            <textarea
              className="input min-h-24 py-3"
              value={form.issue}
              onChange={set('issue')}
              placeholder="مثلاً: الشاشة ما تشتغل، الغسالة تسرّب ماء"
              aria-invalid={!!errors.issue}
              autoFocus={!isEdit}
            />
            {errors.issue && <span className="mt-1 block text-sm text-red-600">{errors.issue}</span>}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">تاريخ المطالبة *</span>
              <input type="date" className="input" value={form.date} onChange={set('date')} max={toISODate(today())} />
              {errors.date && <span className="mt-1 block text-sm text-red-600">{errors.date}</span>}
            </label>
            <label className="block">
              <span className="label">رقم الطلب/البلاغ</span>
              <input className="input" value={form.referenceNumber} onChange={set('referenceNumber')} placeholder="من المتجر أو الوكيل" dir="auto" />
            </label>
          </div>
        </section>

        <section className="card space-y-4 p-4">
          <div>
            <p className="label">حالة المطالبة</p>
            <div className="grid grid-cols-2 gap-2">
              {CLAIM_STATUS.map((s) => {
                const active = form.status === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, status: s.id }))}
                    aria-pressed={active}
                    className={`min-h-11 rounded-xl text-sm font-medium ring-1 ${active ? `${TONES[s.tone]} text-white` : 'ring-slate-300 dark:ring-slate-700'}`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {form.status === 'resolved' && (
            <div>
              <p className="label">وش صار؟</p>
              <div className="flex flex-wrap gap-2">
                {CLAIM_OUTCOMES.map((o) => {
                  const active = form.outcome === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, outcome: active ? '' : o.id }))}
                      aria-pressed={active}
                      className={`min-h-10 rounded-full px-4 text-sm font-medium ring-1 ${active ? 'bg-brand-700 text-white ring-brand-700 dark:bg-brand-600' : 'ring-slate-300 dark:ring-slate-700'}`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {closed && (
            <label className="block">
              <span className="label">تاريخ الإغلاق</span>
              <input type="date" className="input" value={form.closedDate || form.date} onChange={set('closedDate')} min={form.date} max={toISODate(today())} />
              {errors.closedDate && <span className="mt-1 block text-sm text-red-600">{errors.closedDate}</span>}
            </label>
          )}

          <label className="block">
            <span className="label">التكلفة عليك (ر.س)</span>
            <input type="number" inputMode="decimal" min="0" step="0.01" className="input" value={form.cost} onChange={set('cost')} placeholder="0 لو مجاني ضمن الضمان" />
          </label>
        </section>

        <section className="card p-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span>
              <span className="block font-medium">الضمان انتهى استخدامه</span>
              <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">
                {suggestedUsed ? 'اقتراح: الاستبدال أو الاسترجاع ينهي الضمان عادةً. ' : ''}
                يتحوّل الضمان لـ"تم استخدامه في مطالبة" وتتوقف تنبيهاته.
              </span>
            </span>
            <input type="checkbox" className="peer sr-only" checked={usedValue} onChange={(e) => setMarkUsed(e.target.checked)} />
            <span className="relative h-8 w-14 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-brand-600 after:absolute after:top-1 after:right-1 after:size-6 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:-translate-x-6 dark:bg-slate-700" />
          </label>
        </section>

        <section className="card p-4">
          <label className="block">
            <span className="label">ملاحظات</span>
            <textarea className="input min-h-20 py-3" value={form.notes} onChange={set('notes')} placeholder="اسم الموظف، وش قالوا لك، موعد الاستلام..." />
          </label>
        </section>

        {isEdit && (
          <button type="button" className="btn-danger w-full" onClick={() => setConfirmDelete(true)}>
            <TrashIcon className="size-5" />
            حذف المطالبة
          </button>
        )}

        <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent px-4 pt-6 pb-4 dark:from-slate-950 dark:via-slate-950" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
          <button type="submit" className="btn-primary w-full text-lg" disabled={saving}>
            {saving ? 'نحفظ…' : 'حفظ المطالبة'}
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title="حذف المطالبة؟"
        message="بتنحذف المطالبة من السجل نهائياً. حالة الضمان ما تتغير."
        confirmLabel="حذف"
        danger
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
