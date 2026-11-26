import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { clearDraft, peekDraft } from '../services/draft.js';
import PageHeader from '../components/PageHeader.jsx';
import ImagePicker from '../components/ImagePicker.jsx';
import CameraScanner from '../components/CameraScanner.jsx';
import Toast from '../components/Toast.jsx';
import { QrIcon, XIcon } from '../components/Icons.jsx';
import { decodeZatcaQR } from '../lib/zatca.js';
import { zatcaToPrefill } from '../lib/prefill.js';
import { guessCategory } from '../lib/invoiceParser.js';
import { formatMoney } from '../lib/format.js';
import { QR_FORMATS } from '../services/scanner.js';
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
  barcode: '',
  vatNumber: '',
  vatAmount: null,
  invoiceTime: '',
  notes: '',
};

const SOURCE_LABELS = {
  qr: 'من QR الفاتورة الإلكترونية',
  'ocr+qr': 'من صورة الفاتورة و QR',
  pdf: 'من ملف PDF',
  'pdf+qr': 'من ملف PDF و QR',
  ocr: 'من صورة الفاتورة',
  barcode: 'من باركود المنتج',
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

  // بيانات جاية من شاشات المسح (QR / باركود / OCR)
  const [draft] = useState(() => (isEdit ? null : peekDraft()));
  useEffect(() => {
    clearDraft();
  }, []);
  const [autoFilled, setAutoFilled] = useState(() => new Set(Object.keys(draft?.prefill ?? {}).filter((k) => k !== 'vatAmount' && k !== 'invoiceTime')));
  // فاتورة فيها أكثر من صنف: المستخدم يختار، ويقدر يحفظ ويكمل للصنف اللي بعده
  const items = draft?.items?.length > 1 ? draft.items : null;
  const [itemIndex, setItemIndex] = useState(0);
  const [savedItems, setSavedItems] = useState([]);
  const [qrOpen, setQrOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const hasQr = /qr/.test(draft?.source ?? '');

  const [form, setForm] = useState(() => {
    const f = { ...EMPTY, ...(draft?.prefill ?? {}) };
    // أكثر من صنف: نبدأ بالصنف الأول وسعره (مو إجمالي الفاتورة)
    const first = draft?.items?.length > 1 ? draft.items[0] : null;
    if (first) Object.assign(f, { productName: first.name, price: first.amount ?? f.price, category: guessCategory(first.name) ?? f.category });
    return f;
  });
  const [images, setImages] = useState(() =>
    (draft?.images ?? []).map((img) => ({ ...img, key: `new-${++tempKey}` }))
  ); // [{key, kind, blob, id?}]
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

  function chooseItem(i) {
    const it = items[i];
    setItemIndex(i);
    setForm((f) => ({ ...f, productName: it.name, category: guessCategory(it.name) ?? f.category, price: it.amount ?? f.price, serialNumber: '', barcode: '' }));
    setAutoFilled((s) => new Set([...s, 'productName', 'price']));
  }

  /** بيانات QR الفاتورة (من زر "أضف QR") تغلب على اللي انقرأ من النص */
  function applyQr(prefill) {
    setForm((f) => ({ ...f, ...prefill }));
    setAutoFilled((s) => new Set([...s, ...Object.keys(prefill).filter((k) => k !== 'vatAmount' && k !== 'invoiceTime')]));
    setQrOpen(false);
    setNotice('تم: أخذنا المتجر والتاريخ والمبلغ من QR الفاتورة');
    setTimeout(() => setNotice(null), 3000);
  }

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

  async function handleSubmit(ev, { next = false } = {}) {
    ev?.preventDefault();
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
        barcode: form.barcode.trim(),
        vatNumber: form.vatNumber.trim(),
        notes: form.notes.trim(),
      };
      if (isEdit) data.id = Number(id);
      const newId = await saveWarranty(data, {
        added: images.filter((i) => !i.id).map(({ kind, blob }) => ({ kind, blob })),
        removedIds,
      });
      if (next && items) {
        // نكمل للصنف اللي بعده بنفس بيانات الفاتورة (المتجر والتاريخ والصورة)
        const done = [...savedItems, itemIndex];
        setSavedItems(done);
        const nextIndex = items.findIndex((_, i) => !done.includes(i));
        setSaving(false);
        if (nextIndex >= 0) {
          chooseItem(nextIndex);
          setNotice(`تم حفظ "${data.productName}". الحين: ${items[nextIndex].name}`);
          setTimeout(() => setNotice(null), 3500);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }
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
      <PageHeader title={isEdit ? 'تعديل الضمان' : draft ? 'مراجعة البيانات' : 'إدخال يدوي'} back />
      <form onSubmit={handleSubmit} noValidate className="space-y-5 px-4">
        {draft && <DraftBanner draft={draft} count={autoFilled.size} filled={autoFilled} />}
        {!isEdit && !hasQr && (
          <button type="button" onClick={() => setQrOpen(true)} className="card flex w-full items-center gap-3 p-3 text-start active:scale-[0.99]">
            <QrIcon className="size-7 shrink-0 text-brand-700 dark:text-brand-400" />
            <span className="flex-1">
              <span className="block font-semibold">عندك QR الفاتورة؟</span>
              <span className="block text-sm text-slate-500 dark:text-slate-400">امسحه ونعبّي المتجر والتاريخ والمبلغ بدقة</span>
            </span>
          </button>
        )}
        {items && (
          <section className="card space-y-3 p-4">
            <p className="font-semibold">الفاتورة فيها {items.length} أصناف. أي واحد تسجّل له الضمان؟</p>
            <div className="flex flex-col gap-2">
              {items.map((it, i) => {
                const active = i === itemIndex;
                const done = savedItems.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => chooseItem(i)}
                    aria-pressed={active}
                    className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start text-sm ring-1 ${active ? 'bg-brand-50 ring-brand-600 dark:bg-brand-950/40' : 'ring-slate-200 dark:ring-slate-700'}`}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{done ? '✓ ' : ''}{it.name}</span>
                    {it.amount != null && <span className="shrink-0 text-slate-500 dark:text-slate-400">{formatMoney(it.amount)}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        )}
        <Section title="المنتج">
          <Field label="اسم المنتج *" error={errors.productName} auto={autoFilled.has('productName')}>
            <input className="input" value={form.productName} onChange={set('productName')} placeholder="مثلاً: غسالة سامسونج 9 كيلو" aria-invalid={!!errors.productName} autoFocus={!isEdit && !draft?.prefill?.productName} />
          </Field>
          <Field label="التصنيف" group auto={autoFilled.has('category')}>
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="الرقم التسلسلي" auto={autoFilled.has('serialNumber')}>
              <input className="input" dir="ltr" value={form.serialNumber} onChange={set('serialNumber')} placeholder="SN-..." />
            </Field>
            <Field label="الباركود" auto={autoFilled.has('barcode')}>
              <input className="input num" dir="ltr" inputMode="numeric" value={form.barcode} onChange={set('barcode')} placeholder="628..." />
            </Field>
          </div>
        </Section>

        <Section title="الشراء">
          <div className="grid grid-cols-2 gap-3">
            <Field label="تاريخ الشراء *" error={errors.purchaseDate} auto={autoFilled.has('purchaseDate')}>
              <input type="date" className="input" value={form.purchaseDate} max={toISODate(today())} onChange={set('purchaseDate')} aria-invalid={!!errors.purchaseDate} />
            </Field>
            <Field label="السعر (ر.س)" error={errors.price} auto={autoFilled.has('price')}>
              <input type="number" inputMode="decimal" min="0" step="0.01" className="input num" value={form.price} onChange={set('price')} placeholder="0" aria-invalid={!!errors.price} />
            </Field>
          </div>
          <Field label="اسم المتجر" auto={autoFilled.has('storeName')}>
            <input className="input" value={form.storeName} onChange={set('storeName')} placeholder="مثلاً: إكسترا" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الفرع" auto={autoFilled.has('storeBranch')}>
              <input className="input" value={form.storeBranch} onChange={set('storeBranch')} placeholder="الرياض - العليا" />
            </Field>
            <Field label="رقم التواصل" auto={autoFilled.has('storePhone')}>
              <input type="tel" inputMode="tel" dir="ltr" className="input text-right" value={form.storePhone} onChange={set('storePhone')} placeholder="9200xxxxx" />
            </Field>
          </div>
          <Field label="الرقم الضريبي للمتجر" auto={autoFilled.has('vatNumber')} hint={form.vatAmount != null ? `ضريبة القيمة المضافة في الفاتورة: ${form.vatAmount} ر.س` : undefined}>
            <input className="input num" dir="ltr" inputMode="numeric" value={form.vatNumber} onChange={set('vatNumber')} placeholder="3xxxxxxxxxxxxx3" />
          </Field>
        </Section>

        <Section title="الضمان">
          <Field label="مدة الضمان *" error={errors.warrantyValue} group auto={autoFilled.has('warrantyValue')}>
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
          <Field label="مدة الاسترجاع/الاستبدال (أيام)" error={errors.returnDays} auto={autoFilled.has('returnDays')} hint="اكتب 0 لو ما فيه استرجاع">
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

        {draft?.rawText && (
          <details className="card p-4">
            <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">النص المقروء من الفاتورة</summary>
            <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 text-xs whitespace-pre-wrap dark:bg-slate-950" dir="auto">{draft.rawText}</pre>
          </details>
        )}

        <Section title="ملاحظات">
          <textarea className="input min-h-24 py-3" value={form.notes} onChange={set('notes')} placeholder="أي تفاصيل تبي تتذكرها (مثلاً: الضمان يشمل الموتور 10 سنين)" />
        </Section>

        <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent px-4 pt-4 pb-4 dark:from-slate-950 dark:via-slate-950" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
          <button type="submit" className="btn-primary w-full text-lg" disabled={saving}>
            {saving ? 'جاري الحفظ…' : isEdit ? 'حفظ التعديلات' : 'حفظ الضمان'}
          </button>
          {items && savedItems.length + 1 < items.length && (
            <button type="button" className="btn-secondary mt-2 w-full" disabled={saving} onClick={() => handleSubmit(null, { next: true })}>
              حفظ وأضف الصنف التالي
            </button>
          )}
        </div>
      </form>
      {qrOpen && <QrSheet onResult={applyQr} onClose={() => setQrOpen(false)} />}
      <Toast message={notice} tone="info" />
    </>
  );
}

/** نافذة مسح QR الفاتورة من داخل النموذج */
function QrSheet({ onResult, onClose }) {
  const [msg, setMsg] = useState(null);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-950" role="dialog" aria-modal="true" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center gap-2 px-4 py-3">
        <h2 className="flex-1 text-xl font-bold">QR الفاتورة</h2>
        <button onClick={onClose} className="flex size-11 items-center justify-center rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800" aria-label="إغلاق">
          <XIcon />
        </button>
      </div>
      <div className="px-4">
        <CameraScanner
          formats={QR_FORMATS}
          hint="وجّه الكاميرا على QR الفاتورة، أو اختر صورة له"
          onDetect={(text) => {
            const inv = decodeZatcaQR(text);
            if (!inv) {
              setMsg('هذا مو QR فاتورة إلكترونية');
              setTimeout(() => setMsg(null), 2500);
              return false;
            }
            onResult(zatcaToPrefill(inv));
            return true;
          }}
        />
      </div>
      <Toast message={msg} />
    </div>
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

function fieldsLabel(n) {
  if (n === 1) return 'حقل واحد';
  if (n === 2) return 'حقلين';
  if (n <= 10) return `${n} حقول`;
  return `${n} حقل`;
}

function DraftBanner({ draft, count, filled }) {
  const missing = [!filled.has('productName') && 'اسم المنتج', !filled.has('warrantyValue') && 'مدة الضمان'].filter(Boolean);
  const missingInvoice = !draft.images?.some((i) => i.kind === 'invoice');
  return (
    <div className="rounded-2xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900">
      <p className="font-semibold">
        {count > 0 ? `عبّينا ${fieldsLabel(count)} ${SOURCE_LABELS[draft.source] ?? ''}` : 'ما قدرنا نقرأ بيانات كافية'}
      </p>
      <p className="mt-1 text-sm">
        راجع الحقول المعلّمة بـ"تلقائي" وعدّلها لو فيها خطأ{missing.length ? `، وأكمل الباقي (${missing.join(' و')})` : ''}.
        {draft.notFound && ' ما لقينا اسم المنتج في قواعد البيانات، اكتبه بنفسك.'}
        {missingInvoice && ' لا تنسى تضيف صورة الفاتورة تحت.'}
      </p>
    </div>
  );
}

function Field({ label, error, hint, group, auto, children }) {
  // group: الحقل فيه أكثر من عنصر (أزرار) فما نستخدم <label> عشان الضغط ما يفعّل أول زر
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className="block" role={group ? 'group' : undefined} aria-label={group ? label : undefined}>
      <span className="label flex items-center gap-2">
        {label}
        {auto && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">تلقائي</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-sm text-red-600 dark:text-red-400">{error}</span>}
    </Tag>
  );
}
