import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import ImagePicker from '../components/ImagePicker.jsx';
import NotFound from './NotFound.jsx';
import { getImages, getWarranty, saveWarranty } from '../db/warrantyRepo.js';
import { useSettings } from '../hooks/useSettings.jsx';
import { CATEGORIES } from '../lib/constants.js';
import { formatDate, toISODate, today } from '../lib/dates.js';
import { computeExpiryDate, computeReturnDeadline, warrantyMonths } from '../lib/warranty.js';

const EMPTY = {
  productName: '',
  category: 'electronics',
  storeName: '',
  storeBranch: '',
  storePhone: '',
  purchaseDate: toISODate(today()),
  price: '',
  warrantyValue: 1,
  warrantyUnit: 'years',
  returnDays: 7,
  serialNumber: '',
  notes: '',
};

const QUICK_DURATIONS = [
  [6, 'months', '6 شهور'],
  [1, 'years', 'سنة'],
  [2, 'years', 'سنتين'],
  [5, 'years', '5 سنوات'],
];

let tempKey = 0;

export default function WarrantyForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { settings } = useSettings();

  const [form, setForm] = useState(EMPTY);
  const [images, setImages] = useState([]); // [{key, kind, blob, id?}]
  const [removedIds, setRemovedIds] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [missing, setMissing] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const w = await getWarranty(id);
      if (!w) {
        setMissing(true);
      } else {
        setForm({ ...EMPTY, ...w, price: w.price ?? '' });
        const imgs = await getImages(id);
        setImages(imgs.map((i) => ({ ...i, key: `db-${i.id}` })));
      }
      setLoading(false);
    })();
  }, [id, isEdit]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const expiry = useMemo(
    () => computeExpiryDate(form.purchaseDate, warrantyMonths(form.warrantyValue, form.warrantyUnit)),
    [form.purchaseDate, form.warrantyValue, form.warrantyUnit]
  );
  const returnDeadline = useMemo(() => computeReturnDeadline(form.purchaseDate, form.returnDays), [form.purchaseDate, form.returnDays]);

  function validate() {
    const e = {};
    if (!form.productName.trim()) e.productName = 'اكتب اسم المنتج';
    if (!form.purchaseDate) e.purchaseDate = 'حدد تاريخ الشراء';
    else if (form.purchaseDate > toISODate(today())) e.purchaseDate = 'تاريخ الشراء ما يصير في المستقبل';
    if (form.price !== '' && Number(form.price) < 0) e.price = 'السعر غير صحيح';
    if (!(Number(form.warrantyValue) > 0)) e.warrantyValue = 'حدد مدة الضمان';
    if (Number(form.returnDays) < 0) e.returnDays = 'المدة غير صحيحة';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) {
      document.querySelector('[aria-invalid=true]')?.focus();
      return;
    }
    setSaving(true);
    try {
      const data = {
        ...form,
        productName: form.productName.trim(),
        storeName: form.storeName.trim(),
        storeBranch: form.storeBranch.trim(),
        storePhone: form.storePhone.trim(),
        serialNumber: form.serialNumber.trim(),
        notes: form.notes.trim(),
      };
      if (isEdit) data.id = Number(id);
      const newId = await saveWarranty(data, {
        added: images.filter((i) => !i.id).map(({ kind, blob }) => ({ kind, blob })),
        removedIds,
      });
      navigate(`/w/${newId}`, { replace: true });
    } catch (err) {
      console.error(err);
      alert('صار خطأ أثناء الحفظ، حاول مرة ثانية.');
      setSaving(false);
    }
  }

  if (missing) return <NotFound message="الضمان غير موجود" />;
  if (loading) return null;

  return (
    <>
      <PageHeader title={isEdit ? 'تعديل الضمان' : 'إدخال يدوي'} back />
      <form onSubmit={handleSubmit} noValidate className="space-y-5 px-4">
        <Section title="المنتج">
          <Field label="اسم المنتج *" error={errors.productName}>
            <input className="input" value={form.productName} onChange={set('productName')} placeholder="مثلاً: غسالة سامسونج 9 كيلو" aria-invalid={!!errors.productName} autoFocus={!isEdit} />
          </Field>
          <Field label="التصنيف" group>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setForm((f) => ({ ...f, category: c.id }))}
                  className={`flex min-h-16 flex-col items-center justify-center rounded-xl p-2 text-xs font-medium ring-1 transition ${
                    form.category === c.id
                      ? 'bg-brand-50 text-brand-800 ring-2 ring-brand-600 dark:bg-brand-900/40 dark:text-brand-200 dark:ring-brand-400'
                      : 'bg-white ring-slate-200 dark:bg-slate-900 dark:ring-slate-700'
                  }`}
                  aria-pressed={form.category === c.id}
                >
                  <span className="text-xl" aria-hidden>{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="الرقم التسلسلي (Serial Number)">
            <input className="input" dir="ltr" value={form.serialNumber} onChange={set('serialNumber')} placeholder="SN-..." />
          </Field>
        </Section>

        <Section title="الشراء">
          <div className="grid grid-cols-2 gap-3">
            <Field label="تاريخ الشراء *" error={errors.purchaseDate}>
              <input type="date" className="input" value={form.purchaseDate} max={toISODate(today())} onChange={set('purchaseDate')} aria-invalid={!!errors.purchaseDate} />
            </Field>
            <Field label="السعر (ر.س)" error={errors.price}>
              <input type="number" inputMode="decimal" min="0" step="0.01" className="input num" value={form.price} onChange={set('price')} placeholder="0" aria-invalid={!!errors.price} />
            </Field>
          </div>
          <Field label="اسم المتجر">
            <input className="input" value={form.storeName} onChange={set('storeName')} placeholder="مثلاً: إكسترا" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الفرع">
              <input className="input" value={form.storeBranch} onChange={set('storeBranch')} placeholder="الرياض - العليا" />
            </Field>
            <Field label="رقم التواصل">
              <input type="tel" inputMode="tel" dir="ltr" className="input text-right" value={form.storePhone} onChange={set('storePhone')} placeholder="9200xxxxx" />
            </Field>
          </div>
        </Section>

        <Section title="الضمان">
          <Field label="مدة الضمان *" error={errors.warrantyValue} group>
            <div className="mb-2 flex flex-wrap gap-2">
              {QUICK_DURATIONS.map(([v, u, label]) => {
                const active = Number(form.warrantyValue) === v && form.warrantyUnit === u;
                return (
                  <button type="button" key={label} onClick={() => setForm((f) => ({ ...f, warrantyValue: v, warrantyUnit: u }))} className={`rounded-full px-4 py-2 text-sm font-medium ring-1 ${active ? 'bg-brand-700 text-white ring-brand-700 dark:bg-brand-600' : 'ring-slate-300 dark:ring-slate-700'}`}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" inputMode="numeric" min="1" className="input num" value={form.warrantyValue} onChange={set('warrantyValue')} aria-label="مدة الضمان" aria-invalid={!!errors.warrantyValue} />
              <select className="input" value={form.warrantyUnit} onChange={set('warrantyUnit')} aria-label="وحدة المدة">
                <option value="months">شهور</option>
                <option value="years">سنين</option>
              </select>
            </div>
          </Field>
          {expiry && (
            <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
              ينتهي الضمان في: <strong>{formatDate(expiry, { hijri: settings.showHijri })}</strong>
            </p>
          )}
          <Field label="مدة الاسترجاع/الاستبدال (أيام)" error={errors.returnDays} hint="اكتب 0 لو ما فيه استرجاع">
            <input type="number" inputMode="numeric" min="0" className="input num" value={form.returnDays} onChange={set('returnDays')} aria-invalid={!!errors.returnDays} />
          </Field>
          {returnDeadline && (
            <p className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
              آخر يوم للاسترجاع: <strong>{formatDate(returnDeadline, { hijri: settings.showHijri })}</strong>
            </p>
          )}
        </Section>

        <Section title="الصور">
          <ImagePicker
            images={images}
            onAdd={(kind, blob) => setImages((list) => [...list, { key: `new-${++tempKey}`, kind, blob }])}
            onRemove={(img) => {
              setImages((list) => list.filter((i) => i.key !== img.key));
              if (img.id) setRemovedIds((ids) => [...ids, img.id]);
            }}
          />
        </Section>

        <Section title="ملاحظات">
          <textarea className="input min-h-24 py-3" value={form.notes} onChange={set('notes')} placeholder="أي تفاصيل تبي تتذكرها (مثلاً: الضمان يشمل الموتور 10 سنين)" />
        </Section>

        <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent px-4 pt-4 pb-4 dark:from-slate-950 dark:via-slate-950" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
          <button type="submit" className="btn-primary w-full text-lg" disabled={saving}>
            {saving ? 'جاري الحفظ…' : isEdit ? 'حفظ التعديلات' : 'حفظ الضمان'}
          </button>
        </div>
      </form>
    </>
  );
}

function Section({ title, children }) {
  return (
    <fieldset className="card space-y-4 p-4">
      <legend className="sr-only">{title}</legend>
      <h2 className="font-bold text-slate-800 dark:text-slate-200">{title}</h2>
      {children}
    </fieldset>
  );
}

function Field({ label, error, hint, group, children }) {
  // group: الحقل فيه أكثر من عنصر (أزرار) فما نستخدم <label> عشان الضغط ما يفعّل أول زر
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className="block" role={group ? 'group' : undefined} aria-label={group ? label : undefined}>
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-sm text-red-600 dark:text-red-400">{error}</span>}
    </Tag>
  );
}
