import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import { BarcodeIcon, CameraIcon, EditIcon, QrIcon } from '../components/Icons.jsx';

const METHODS = [
  { to: '/add/qr', icon: QrIcon, title: 'مسح QR الفاتورة', desc: 'يقرأ بيانات الفاتورة الإلكترونية تلقائياً', soon: true },
  { to: '/add/barcode', icon: BarcodeIcon, title: 'مسح باركود المنتج', desc: 'يحفظ رقم الباركود واسم المنتج', soon: true },
  { to: '/add/ocr', icon: CameraIcon, title: 'تصوير الفاتورة', desc: 'يقرأ التاريخ والمبلغ والمتجر من الصورة', soon: true },
  { to: '/add/manual', icon: EditIcon, title: 'إدخال يدوي', desc: 'عبّي البيانات بنفسك وارفع صورة الفاتورة' },
];

export default function AddMethod() {
  return (
    <>
      <PageHeader title="إضافة ضمان" back />
      <div className="grid grid-cols-2 gap-3 px-4">
        {METHODS.map((m) => {
          const content = (
            <>
              <span className={`flex size-14 items-center justify-center rounded-2xl ${m.soon ? 'bg-slate-100 text-slate-400 dark:bg-slate-800' : 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'}`}>
                <m.icon className="size-7" />
              </span>
              <span className="mt-3 font-bold">{m.title}</span>
              <span className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{m.desc}</span>
              {m.soon && <span className="mt-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800">قريباً</span>}
            </>
          );
          const cls = 'card flex min-h-44 flex-col items-center p-4 text-center';
          return m.soon ? (
            <div key={m.to} className={`${cls} opacity-70`} aria-disabled="true">{content}</div>
          ) : (
            <Link key={m.to} to={m.to} className={`${cls} ring-2 ring-brand-600/40 transition active:scale-[0.98]`}>{content}</Link>
          );
        })}
      </div>
    </>
  );
}
