import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../components/PageHeader.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Thumb from '../components/Thumb.jsx';
import ImageViewer from '../components/ImageViewer.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { remainingText } from '../components/WarrantyCard.jsx';
import { ClaimIcon, EditIcon, FileIcon, PhoneIcon, ShareIcon, TrashIcon } from '../components/Icons.jsx';
import NotFound from './NotFound.jsx';
import { deleteWarranty, getImages, getWarranty, saveWarranty } from '../db/warrantyRepo.js';
import { useSettings } from '../hooks/useSettings.jsx';
import { categoryById, IMAGE_KINDS } from '../lib/constants.js';
import { daysLabel, durationLabel, formatDate } from '../lib/dates.js';
import { formatMoney } from '../lib/format.js';
import { daysUntil, getStatus, remainingRatio, urgencyLevel } from '../lib/warranty.js';

export default function WarrantyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const w = useLiveQuery(() => getWarranty(id).then((r) => r ?? null), [id]);
  const images = useLiveQuery(() => getImages(id), [id], []);
  const [viewing, setViewing] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'delete' | 'claim'

  if (w === undefined) return null;
  if (w === null) return <NotFound message="الضمان غير موجود" />;

  const hijri = settings.showHijri;
  const status = getStatus(w, settings);
  const left = daysUntil(w.expiryDate);
  const returnLeft = daysUntil(w.returnDeadline);
  const cat = categoryById(w.category);

  async function share() {
    const text = [
      `🧾 ${w.productName}`,
      w.storeName && `المتجر: ${w.storeName}${w.storeBranch ? ` - ${w.storeBranch}` : ''}`,
      `تاريخ الشراء: ${formatDate(w.purchaseDate)}`,
      w.price != null && `السعر: ${formatMoney(w.price)}`,
      `الضمان: ${durationLabel(w.warrantyMonths)} (ينتهي ${formatDate(w.expiryDate)})`,
      w.serialNumber && `الرقم التسلسلي: ${w.serialNumber}`,
    ]
      .filter(Boolean)
      .join('\n');
    const invoice = images.find((i) => i.kind === 'invoice');
    const files = invoice ? [new File([invoice.blob], `فاتورة-${w.productName}.jpg`, { type: invoice.blob.type || 'image/jpeg' })] : [];
    try {
      if (files.length && navigator.canShare?.({ files })) {
        await navigator.share({ title: w.productName, text, files });
      } else if (navigator.share) {
        await navigator.share({ title: w.productName, text });
      } else {
        await navigator.clipboard.writeText(text);
        alert('تم نسخ بيانات الفاتورة');
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
    }
  }

  async function onConfirm() {
    if (confirm === 'delete') {
      await deleteWarranty(w.id);
      navigate('/', { replace: true });
    } else if (confirm === 'claim') {
      await saveWarranty({ ...w, claimed: !w.claimed });
      setConfirm(null);
    }
  }

  return (
    <>
      <PageHeader
        title="تفاصيل الضمان"
        back
        action={
          <Link to={`/w/${w.id}/edit`} className="flex size-11 items-center justify-center rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800" aria-label="تعديل">
            <EditIcon />
          </Link>
        }
      />
      <div className="space-y-4 px-4">
        {/* البطاقة الرئيسية */}
        <section className="card p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-3xl dark:bg-slate-800" aria-hidden>
              {cat.icon}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold">{w.productName}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{cat.label}</p>
            </div>
            <StatusBadge status={status} />
          </div>
          {status !== 'claimed' && (
            <div className="mt-5">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold">{remainingText(left)}</span>
                <span className="text-sm text-slate-500">من {durationLabel(w.warrantyMonths)}</span>
              </div>
              <ProgressBar ratio={remainingRatio(w)} level={urgencyLevel(left, settings.expiringThresholdDays)} />
            </div>
          )}
          {returnLeft !== null && returnLeft >= 0 && (
            <p className="mt-4 rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
              مدة الاسترجاع/الاستبدال: <strong>{returnLeft === 0 ? 'آخر يوم اليوم' : `باقي ${daysLabel(returnLeft)}`}</strong>
            </p>
          )}
        </section>

        {/* الأزرار */}
        <section className="grid grid-cols-4 gap-2">
          <Action icon={PhoneIcon} label="اتصال" href={w.storePhone ? `tel:${w.storePhone.replace(/\s/g, '')}` : undefined} />
          <Action icon={ShareIcon} label="مشاركة" onClick={share} />
          <Action icon={FileIcon} label="PDF" soon />
          <Action icon={ClaimIcon} label={w.claimed ? 'إلغاء المطالبة' : 'سجّل مطالبة'} onClick={() => setConfirm('claim')} />
        </section>

        <section className="card divide-y divide-slate-100 dark:divide-slate-800">
          <Row label="المتجر" value={w.storeName} />
          <Row label="الفرع" value={w.storeBranch} />
          <Row label="رقم التواصل" value={w.storePhone} ltr />
          <Row label="تاريخ الشراء" value={formatDate(w.purchaseDate, { hijri })} />
          <Row label="السعر" value={w.price != null ? formatMoney(w.price) : null} />
          <Row label="مدة الضمان" value={durationLabel(w.warrantyMonths)} />
          <Row label="ينتهي الضمان" value={formatDate(w.expiryDate, { hijri })} />
          <Row label="مدة الاسترجاع" value={w.returnDays ? `${daysLabel(w.returnDays)} (حتى ${formatDate(w.returnDeadline)})` : 'لا يوجد'} />
          <Row label="الرقم التسلسلي" value={w.serialNumber} ltr />
        </section>

        {w.notes && (
          <section className="card p-4">
            <h3 className="mb-1 text-sm font-medium text-slate-500">ملاحظات</h3>
            <p className="whitespace-pre-wrap">{w.notes}</p>
          </section>
        )}

        <section className="card p-4">
          <h3 className="mb-3 font-bold">الصور</h3>
          {images.length === 0 ? (
            <p className="text-sm text-slate-500">
              ما فيه صور. <Link to={`/w/${w.id}/edit`} className="font-medium text-brand-700 dark:text-brand-400">أضف صورة الفاتورة</Link>
            </p>
          ) : (
            <div className="space-y-3">
              {IMAGE_KINDS.map((k) => {
                const list = images.filter((i) => i.kind === k.id);
                if (!list.length) return null;
                return (
                  <div key={k.id}>
                    <p className="mb-1.5 text-sm text-slate-500">{k.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {list.map((img) => (
                        <Thumb key={img.id} blob={img.blob} alt={k.label} className="size-24" onClick={() => setViewing(img.blob)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <button className="btn-danger w-full" onClick={() => setConfirm('delete')}>
          <TrashIcon className="size-5" />
          حذف الضمان
        </button>
      </div>

      <ImageViewer blob={viewing} onClose={() => setViewing(null)} />
      <ConfirmDialog
        open={confirm === 'delete'}
        title="حذف الضمان؟"
        message={`بينحذف ضمان "${w.productName}" وكل صوره نهائياً.`}
        confirmLabel="حذف"
        danger
        onConfirm={onConfirm}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'claim'}
        title={w.claimed ? 'إلغاء حالة المطالبة؟' : 'تسجيل مطالبة'}
        message={
          w.claimed
            ? 'بيرجع الضمان لحالته الطبيعية وترجع تنبيهاته.'
            : 'بيتعلّم الضمان كـ"تم استخدامه في مطالبة" وتتوقف تنبيهاته. (سجل المطالبات التفصيلي جاي في تحديث قادم)'
        }
        onConfirm={onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

function Action({ icon: Icon, label, href, onClick, soon }) {
  const disabled = soon || (!href && !onClick);
  const cls = `card flex flex-col items-center justify-center gap-1.5 py-3 text-xs font-medium ${disabled ? 'opacity-40' : 'active:scale-[0.97]'}`;
  const inner = (
    <>
      <Icon className="size-6 text-brand-700 dark:text-brand-400" />
      {label}
      {soon && <span className="text-[10px] text-slate-400">قريباً</span>}
    </>
  );
  if (href && !disabled) return <a href={href} className={cls}>{inner}</a>;
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  );
}

function Row({ label, value, ltr }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-left font-medium" dir={ltr && value ? 'ltr' : undefined}>
        {value || '—'}
      </span>
    </div>
  );
}
